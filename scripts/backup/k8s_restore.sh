#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
NAMESPACE="${NAMESPACE:-default}"
RESTORE_STRICT="${RESTORE_STRICT:-true}"
BACKUP_SET=""
DRY_RUN="false"
LIST_ONLY="false"

DOCS_PG_TARGET="${DOCS_PG_TARGET:-deploy/postgres}"
AUTH_PG_TARGET="${AUTH_PG_TARGET:-deploy/auth-postgres}"
AUDIT_PG_TARGET="${AUDIT_PG_TARGET:-deploy/audit-postgres}"
SEARCH_PG_TARGET="${SEARCH_PG_TARGET:-deploy/search-postgres}"
CASSANDRA_POD="${CASSANDRA_POD:-$(kubectl -n "$NAMESPACE" get pod -l app=comments-cassandra -o jsonpath='{.items[0].metadata.name}')}"
MINIO_POD="${MINIO_POD:-$(kubectl -n "$NAMESPACE" get pod -l app=minio -o jsonpath='{.items[0].metadata.name}')}"
CQLSH_CMD="${CQLSH_CMD:-/opt/cassandra/bin/cqlsh}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-admin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-ensia1234}"
MINIO_FORWARD_PORT="${MINIO_FORWARD_PORT:-19000}"

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
  echo "[k8s-restore] available backup sets under $BACKUP_ROOT"
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

echo "[k8s-restore] restoring from: $IN_DIR"
pushd "$IN_DIR" >/dev/null
sha256sum -c meta/checksums.sha256
popd >/dev/null

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[k8s-restore] dry-run complete (checksums + manifest validated, no writes applied)"
  exit 0
fi

if [[ "$RESTORE_STRICT" != "true" ]]; then
  echo "RESTORE_STRICT must be true for this script"
  exit 1
fi

echo "[k8s-restore] restoring postgres"
for entry in \
  "$DOCS_PG_TARGET documentsdb $IN_DIR/postgres/documentsdb.sql" \
  "$AUTH_PG_TARGET authdb $IN_DIR/postgres/authdb.sql" \
  "$AUDIT_PG_TARGET auditdb $IN_DIR/postgres/auditdb.sql" \
  "$SEARCH_PG_TARGET searchdb $IN_DIR/postgres/searchdb.sql"; do
  set -- $entry
  target="$1"; db="$2"; file="$3"
  [[ -f "$file" ]] || { echo "missing file: $file"; exit 1; }
  kubectl -n "$NAMESPACE" exec "$target" -- psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
  cat "$file" | kubectl -n "$NAMESPACE" exec -i "$target" -- psql -U postgres -d "$db" -v ON_ERROR_STOP=1

done

echo "[k8s-restore] restoring cassandra schema + data"
[[ -f "$IN_DIR/cassandra/dms_schema.cql" ]] || { echo "missing cassandra schema"; exit 1; }
[[ -f "$IN_DIR/cassandra/dms_comments.csv" ]] || { echo "missing cassandra data csv"; exit 1; }
cat "$IN_DIR/cassandra/dms_schema.cql" | kubectl -n "$NAMESPACE" exec -i "$CASSANDRA_POD" -- /bin/sh -lc "$CQLSH_CMD"
kubectl -n "$NAMESPACE" exec "$CASSANDRA_POD" -- /bin/sh -lc "$CQLSH_CMD -e \"TRUNCATE dms.comments;\""
kubectl -n "$NAMESPACE" cp "$IN_DIR/cassandra/dms_comments.csv" "$CASSANDRA_POD":/tmp/dms_comments.csv
kubectl -n "$NAMESPACE" exec "$CASSANDRA_POD" -- /bin/sh -lc "$CQLSH_CMD -e \"COPY dms.comments (doc_id, comment_id, content, author) FROM '/tmp/dms_comments.csv' WITH HEADER=TRUE;\""

echo "[k8s-restore] restoring minio"
[[ -f "$IN_DIR/minio/documents_bucket.tar.gz" ]] || { echo "missing minio tar"; exit 1; }
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
tar -C "$TMP_DIR" -xzf "$IN_DIR/minio/documents_bucket.tar.gz"
kubectl -n "$NAMESPACE" port-forward svc/minio "${MINIO_FORWARD_PORT}:9000" >/tmp/pf-minio-restore.log 2>&1 &
PF_PID=$!
trap 'rm -rf "$TMP_DIR"; kill ${PF_PID} >/dev/null 2>&1 || true' EXIT
sleep 3
docker run --rm --network host --entrypoint /bin/sh -v "$TMP_DIR/documents_bucket:/work/documents_bucket:ro" minio/mc:latest \
  -lc "mc alias set local http://127.0.0.1:${MINIO_FORWARD_PORT} \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" >/dev/null && mc rm --recursive --force local/documents >/dev/null || true; mc mirror --overwrite /work/documents_bucket local/documents >/dev/null"
kill ${PF_PID} >/dev/null 2>&1 || true

echo "[k8s-restore] complete"
