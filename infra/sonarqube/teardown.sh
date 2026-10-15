#!/usr/bin/env bash
# Stops the SonarQube stack. Pass --wipe to also delete all SonarQube and Postgres data.
set -euo pipefail

cd "$(dirname "$0")"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

# Docker Desktop ships the "docker compose" plugin; Colima/Homebrew setups often only have "docker-compose".
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null; then
  compose() { docker-compose "$@"; }
else
  fail "Docker Compose not found. Install Docker Desktop (or: brew install docker-compose)."
fi

if [[ "${1:-}" == "--wipe" ]]; then
  compose down -v
  echo "Stopped SonarQube and deleted all data volumes."
else
  compose down
  echo "Stopped SonarQube. Data kept; run with --wipe to delete it."
fi
