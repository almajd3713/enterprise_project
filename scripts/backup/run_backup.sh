#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/infra/docker/docker-compose.yml}"
BACKUP_ROOT="${BACKUP_ROOT:-$ROOT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$BACKUP_ROOT/$TS"

mkdir -p "$OUT_DIR"/{postgres,cassandra,minio,meta}

echo "[backup] writing backup set: $OUT_DIR"

docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres -d documentsdb > "$OUT_DIR/postgres/documentsdb.sql"
docker compose -f "$COMPOSE_FILE" exec -T auth-postgres pg_dump -U postgres -d authdb > "$OUT_DIR/postgres/authdb.sql"
docker compose -f "$COMPOSE_FILE" exec -T audit-postgres pg_dump -U postgres -d auditdb > "$OUT_DIR/postgres/auditdb.sql"
docker compose -f "$COMPOSE_FILE" exec -T search-postgres pg_dump -U postgres -d searchdb > "$OUT_DIR/postgres/searchdb.sql"

docker compose -f "$COMPOSE_FILE" exec -T cassandra nodetool snapshot dms
docker compose -f "$COMPOSE_FILE" exec -T cassandra cqlsh -e "DESCRIBE KEYSPACE dms;" > "$OUT_DIR/cassandra/dms_schema.cql"
docker compose -f "$COMPOSE_FILE" exec -T cassandra tar -C /var/lib/cassandra/data/dms -czf - . > "$OUT_DIR/cassandra/dms_snapshot.tar.gz"

docker cp minio:/data/documents "$OUT_DIR/minio/documents_bucket"
tar -C "$OUT_DIR/minio" -czf "$OUT_DIR/minio/documents_bucket.tar.gz" documents_bucket
rm -rf "$OUT_DIR/minio/documents_bucket"

find "$OUT_DIR" -type f \( -name '*.sql' -o -name '*.tar.gz' -o -name '*.cql' \) -print0 \
  | sort -z \
  | xargs -0 sha256sum > "$OUT_DIR/meta/checksums.sha256"

cat > "$OUT_DIR/meta/manifest.json" <<EOF
{
  "timestamp_utc": "$TS",
  "postgres": ["documentsdb.sql", "authdb.sql", "auditdb.sql", "searchdb.sql"],
  "cassandra": ["dms_schema.cql", "dms_snapshot.tar.gz"],
  "minio": ["documents_bucket.tar.gz"],
  "checksums_file": "checksums.sha256"
}
EOF

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
echo "[backup] complete"
