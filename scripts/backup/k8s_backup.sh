#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
NAMESPACE="${NAMESPACE:-default}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$BACKUP_ROOT/$TS-k8s"
MANIFEST_VERSION="2"

CASSANDRA_POD="${CASSANDRA_POD:-$(kubectl -n "$NAMESPACE" get pod -l app=comments-cassandra -o jsonpath='{.items[0].metadata.name}')}"
DOCS_PG_TARGET="${DOCS_PG_TARGET:-deploy/postgres}"
AUTH_PG_TARGET="${AUTH_PG_TARGET:-deploy/auth-postgres}"
AUDIT_PG_TARGET="${AUDIT_PG_TARGET:-deploy/audit-postgres}"
SEARCH_PG_TARGET="${SEARCH_PG_TARGET:-deploy/search-postgres}"
MINIO_POD="${MINIO_POD:-$(kubectl -n "$NAMESPACE" get pod -l app=minio -o jsonpath='{.items[0].metadata.name}')}"
CQLSH_CMD="${CQLSH_CMD:-/opt/cassandra/bin/cqlsh}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-admin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-ensia1234}"
MINIO_FORWARD_PORT="${MINIO_FORWARD_PORT:-19000}"

mkdir -p "$OUT_DIR"/{postgres,cassandra,minio,meta}

echo "[k8s-backup] writing backup set: $OUT_DIR"

echo "[k8s-backup] postgres dumps"
kubectl -n "$NAMESPACE" exec "$DOCS_PG_TARGET" -- pg_dump -U postgres -d documentsdb > "$OUT_DIR/postgres/documentsdb.sql"
kubectl -n "$NAMESPACE" exec "$AUTH_PG_TARGET" -- pg_dump -U postgres -d authdb > "$OUT_DIR/postgres/authdb.sql"
kubectl -n "$NAMESPACE" exec "$AUDIT_PG_TARGET" -- pg_dump -U postgres -d auditdb > "$OUT_DIR/postgres/auditdb.sql"
kubectl -n "$NAMESPACE" exec "$SEARCH_PG_TARGET" -- pg_dump -U postgres -d searchdb > "$OUT_DIR/postgres/searchdb.sql"

echo "[k8s-backup] cassandra schema + data export"
kubectl -n "$NAMESPACE" exec "$CASSANDRA_POD" -- /bin/sh -lc "$CQLSH_CMD -e \"DESCRIBE KEYSPACE dms;\"" > "$OUT_DIR/cassandra/dms_schema.cql"
kubectl -n "$NAMESPACE" exec "$CASSANDRA_POD" -- /bin/sh -lc "$CQLSH_CMD -e \"COPY dms.comments (doc_id, comment_id, content, author) TO '/tmp/dms_comments.csv' WITH HEADER=TRUE;\""
kubectl -n "$NAMESPACE" cp "$CASSANDRA_POD":/tmp/dms_comments.csv "$OUT_DIR/cassandra/dms_comments.csv"

echo "[k8s-backup] minio bucket"
kubectl -n "$NAMESPACE" port-forward svc/minio "${MINIO_FORWARD_PORT}:9000" >/tmp/pf-minio-backup.log 2>&1 &
PF_PID=$!
trap 'kill ${PF_PID} >/dev/null 2>&1 || true' EXIT
sleep 3
docker run --rm --network host --entrypoint /bin/sh -v "$OUT_DIR/minio:/work" minio/mc:latest \
  -lc "mc alias set local http://127.0.0.1:${MINIO_FORWARD_PORT} \"$MINIO_ROOT_USER\" \"$MINIO_ROOT_PASSWORD\" >/dev/null && mc mirror local/documents /work/documents_bucket >/dev/null"
tar -C "$OUT_DIR/minio" -czf "$OUT_DIR/minio/documents_bucket.tar.gz" documents_bucket
kill ${PF_PID} >/dev/null 2>&1 || true

find "$OUT_DIR" -type f \( -name '*.sql' -o -name '*.tar.gz' -o -name '*.cql' -o -name '*.csv' \) -print0 \
  | sort -z \
  | xargs -0 sha256sum > "$OUT_DIR/meta/checksums.sha256"

cat > "$OUT_DIR/meta/manifest.json" <<EOF
{
  "manifest_version": "$MANIFEST_VERSION",
  "timestamp_utc": "$TS",
  "source": "k8s",
  "namespace": "$NAMESPACE",
  "postgres": ["documentsdb.sql", "authdb.sql", "auditdb.sql", "searchdb.sql"],
  "cassandra": ["dms_schema.cql", "dms_comments.csv"],
  "minio": ["documents_bucket.tar.gz"],
  "checksums_file": "checksums.sha256"
}
EOF

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
echo "[k8s-backup] complete"
