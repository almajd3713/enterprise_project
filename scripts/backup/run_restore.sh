#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker/docker-compose.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
BACKUP_SET="${1:-}"

if [[ -z "$BACKUP_SET" ]]; then
  echo "usage: $0 <backup-set-timestamp-or-absolute-path>"
  exit 1
fi

if [[ -d "$BACKUP_SET" ]]; then
  IN_DIR="$BACKUP_SET"
else
  IN_DIR="$BACKUP_ROOT/$BACKUP_SET"
fi

if [[ ! -d "$IN_DIR" ]]; then
  echo "backup set not found: $IN_DIR"
  exit 1
fi

echo "[restore] restoring from: $IN_DIR"

pushd "$IN_DIR" >/dev/null
sha256sum -c meta/checksums.sha256
popd >/dev/null

cat "$IN_DIR/postgres/documentsdb.sql" | docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d documentsdb || true
cat "$IN_DIR/postgres/authdb.sql" | docker compose -f "$COMPOSE_FILE" exec -T auth-postgres psql -U postgres -d authdb || true
cat "$IN_DIR/postgres/auditdb.sql" | docker compose -f "$COMPOSE_FILE" exec -T audit-postgres psql -U postgres -d auditdb || true
cat "$IN_DIR/postgres/searchdb.sql" | docker compose -f "$COMPOSE_FILE" exec -T search-postgres psql -U postgres -d searchdb || true

cat "$IN_DIR/cassandra/dms_schema.cql" | docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh || true

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
tar -C "$TMP_DIR" -xzf "$IN_DIR/minio/documents_bucket.tar.gz"
docker compose -f "$COMPOSE_FILE" exec -T minio /bin/sh -c 'rm -rf /data/documents/*'
docker cp "$TMP_DIR/documents_bucket/." minio:/data/documents/

echo "[restore] complete"
