#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker/docker-compose.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
RESTORE_STRICT="${RESTORE_STRICT:-true}"
BACKUP_SET=""
DRY_RUN="false"
LIST_ONLY="false"

usage() {
  echo "usage: $0 [--list] [--dry-run] <backup-set-timestamp-or-absolute-path>"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list) LIST_ONLY="true"; shift ;;
    --dry-run) DRY_RUN="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) BACKUP_SET="$1"; shift ;;
  esac
done

if [[ "$LIST_ONLY" == "true" ]]; then
  echo "[restore] available backup sets under $BACKUP_ROOT"
  if [[ -d "$BACKUP_ROOT" ]]; then
    ls -1 "$BACKUP_ROOT" | sort
  fi
  exit 0
fi

if [[ -z "$BACKUP_SET" ]]; then
  usage
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

[[ -f "$IN_DIR/meta/manifest.json" ]] || { echo "missing manifest.json"; exit 1; }
[[ -f "$IN_DIR/meta/checksums.sha256" ]] || { echo "missing checksums.sha256"; exit 1; }

if ! grep -q '"manifest_version": "2"' "$IN_DIR/meta/manifest.json"; then
  echo "unsupported manifest version, expected 2"
  exit 1
fi

echo "[restore] restoring from: $IN_DIR"

echo "[restore] validating checksums"
pushd "$IN_DIR" >/dev/null
sha256sum -c meta/checksums.sha256
popd >/dev/null

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[restore] dry-run complete (checksums + manifest validated, no writes applied)"
  exit 0
fi

if [[ "$RESTORE_STRICT" != "true" ]]; then
  echo "RESTORE_STRICT must be true for this script"
  exit 1
fi

echo "[restore] restoring postgres"
for entry in \
  "postgres documentsdb $IN_DIR/postgres/documentsdb.sql" \
  "auth-postgres authdb $IN_DIR/postgres/authdb.sql" \
  "audit-postgres auditdb $IN_DIR/postgres/auditdb.sql" \
  "search-postgres searchdb $IN_DIR/postgres/searchdb.sql"; do
  set -- $entry
  svc="$1"; db="$2"; file="$3"
  [[ -f "$file" ]] || { echo "missing file: $file"; exit 1; }
  docker compose -f "$COMPOSE_FILE" exec -T "$svc" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
  cat "$file" | docker compose -f "$COMPOSE_FILE" exec -T "$svc" psql -U postgres -d "$db" -v ON_ERROR_STOP=1

done

echo "[restore] restoring cassandra schema + data"
[[ -f "$IN_DIR/cassandra/dms_schema.cql" ]] || { echo "missing cassandra schema"; exit 1; }
[[ -f "$IN_DIR/cassandra/dms_comments.csv" ]] || { echo "missing cassandra data csv"; exit 1; }
cat "$IN_DIR/cassandra/dms_schema.cql" | docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh
docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh -e "TRUNCATE dms.comments;"
docker cp "$IN_DIR/cassandra/dms_comments.csv" cassandra:/tmp/dms_comments.csv
docker compose -f "$COMPOSE_FILE" exec -T cassandra /bin/sh -lc "cqlsh -e \"COPY dms.comments (doc_id, comment_id, content, author) FROM '/tmp/dms_comments.csv' WITH HEADER=TRUE;\""

echo "[restore] restoring minio"
[[ -f "$IN_DIR/minio/documents_bucket.tar.gz" ]] || { echo "missing minio tar"; exit 1; }
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
tar -C "$TMP_DIR" -xzf "$IN_DIR/minio/documents_bucket.tar.gz"
docker compose -f "$COMPOSE_FILE" exec -T minio /bin/sh -c 'rm -rf /data/documents/*'
docker cp "$TMP_DIR/documents_bucket/." minio:/data/documents/

echo "[restore] complete"
