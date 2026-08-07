#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker/docker-compose.yml}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:3333}"

echo "[verify] running database smoke checks"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d documentsdb -c "select count(*) from document;"
docker compose -f "$COMPOSE_FILE" exec -T auth-postgres psql -U postgres -d authdb -c "select count(*) from app_users;"
docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh -e "SELECT count(*) FROM dms.comments;"

echo "[verify] running API smoke checks"
curl -fsS "$GATEWAY_URL/actuator/health" >/dev/null

echo "[verify] restore verification complete"
