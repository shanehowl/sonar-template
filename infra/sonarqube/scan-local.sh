#!/usr/bin/env bash
# Runs a SonarQube analysis of this repo against the local stack using the scanner Docker image.
# Usage: npm run test:coverage && SONAR_TOKEN=<project analysis token> infra/sonarqube/scan-local.sh
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/../.." && pwd)"

: "${SONAR_TOKEN:?Set SONAR_TOKEN to a project analysis token}"
[[ -f "${repo_root}/coverage/lcov.info" ]] || {
  echo "ERROR: coverage/lcov.info is missing. Run: npm run test:coverage" >&2
  exit 1
}

# The repo is mounted at /usr/src, a different absolute path from the host,
# which also proves lcov paths are repo-relative.
docker run --rm \
  --network sonarqube_default \
  -e SONAR_HOST_URL=http://sonarqube:9000 \
  -e SONAR_TOKEN \
  -v "${repo_root}:/usr/src" \
  sonarsource/sonar-scanner-cli:12.2
