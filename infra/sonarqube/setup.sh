#!/usr/bin/env bash
# Starts the local SonarQube Community Build stack and waits until it is ready.
# Safe to re-run: an existing .env (database password) is never overwritten.
set -euo pipefail

cd "$(dirname "$0")"

SONAR_URL="http://localhost:9000"
REQUIRED_MAP_COUNT=524288
MIN_MEM_BYTES=$((4 * 1024 * 1024 * 1024))
RECOMMENDED_MEM_BYTES=$((6 * 1024 * 1024 * 1024))
TIMEOUT_SECONDS=300

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v docker >/dev/null || fail "docker not found. Install Docker Desktop first."
docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop and retry."

# Docker Desktop ships the "docker compose" plugin; Colima/Homebrew setups often only have "docker-compose".
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null; then
  compose() { docker-compose "$@"; }
else
  fail "Docker Compose not found. Install Docker Desktop (or: brew install docker-compose)."
fi

mem_bytes=$(docker info --format '{{.MemTotal}}')
mem_mib=$((mem_bytes / 1024 / 1024))
if ((mem_bytes < MIN_MEM_BYTES)); then
  fail "Docker has ${mem_mib} MiB of memory; SonarQube needs at least 4 GiB. Raise it in Docker Desktop > Settings > Resources."
elif ((mem_bytes < RECOMMENDED_MEM_BYTES)); then
  echo "WARNING: Docker has ${mem_mib} MiB of memory; 6 GiB or more is recommended."
fi

# Elasticsearch inside SonarQube needs a high mmap count in the Docker VM's kernel.
map_count=$(docker run --rm alpine:3 sysctl -n vm.max_map_count)
if ((map_count < REQUIRED_MAP_COUNT)); then
  echo "Raising vm.max_map_count in the Docker VM from ${map_count} to ${REQUIRED_MAP_COUNT} (resets when Docker restarts)."
  docker run --rm --privileged alpine:3 sysctl -w "vm.max_map_count=${REQUIRED_MAP_COUNT}" >/dev/null
fi

if [[ ! -f .env ]]; then
  sed "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env.example >.env
  echo "Created .env with a random database password."
fi

# Port 9000 must be free unless it is this stack that already holds it (re-run).
if [[ -z "$(compose ps --status running -q sonarqube 2>/dev/null)" ]] && (echo >/dev/tcp/127.0.0.1/9000) 2>/dev/null; then
  fail "Port 9000 is already in use (another SonarQube?). Stop it first, e.g. docker ps | grep 9000 then docker stop <name>."
fi

compose up -d

printf 'Waiting for SonarQube at %s ' "$SONAR_URL"
deadline=$((SECONDS + TIMEOUT_SECONDS))
until curl -fs "$SONAR_URL/api/system/status" 2>/dev/null | grep -q '"status":"UP"'; do
  ((SECONDS < deadline)) || fail "SonarQube is not UP after ${TIMEOUT_SECONDS}s. Check: cd infra/sonarqube && docker compose logs sonarqube"
  printf '.'
  sleep 5
done
echo ' UP'

cat <<NEXT

SonarQube is running at ${SONAR_URL}

Next steps (docs/runbook-runner-mac.md, sections 3-5):
  1. Log in as admin / admin and set a new password.
  2. Import the GitHub repo as a project, and make sure its key matches
     sonar.projectKey in sonar-project.properties.
  3. Create a project analysis token and store it: gh secret set SONAR_TOKEN
  4. Register this Mac as a self-hosted runner.
NEXT
