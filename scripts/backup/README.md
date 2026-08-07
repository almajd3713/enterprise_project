# Backup/Restore Workflows

This directory provides strict backup/restore workflows for both Docker Compose and Kubernetes.

## Artifact contract (manifest v2)

Each backup set contains:
- `postgres/*.sql` for `documentsdb`, `authdb`, `auditdb`, `searchdb`
- `cassandra/dms_schema.cql`
- `cassandra/dms_comments.csv`
- `minio/documents_bucket.tar.gz`
- `meta/manifest.json`
- `meta/checksums.sha256`

Restore validates checksums before any write and fails fast on any subsystem error.

## Compose

Backup:
```bash
./scripts/backup/run_backup.sh
```

List backup sets:
```bash
./scripts/backup/run_restore.sh --list
```

Validate a set without writing:
```bash
./scripts/backup/run_restore.sh --dry-run <backup-set>
```

Restore:
```bash
./scripts/backup/run_restore.sh <backup-set>
```

Verify restore:
```bash
./scripts/backup/verify_restore.sh
```

## Kubernetes

Backup:
```bash
NAMESPACE=default ./scripts/backup/k8s_backup.sh
```

List backup sets:
```bash
NAMESPACE=default ./scripts/backup/k8s_restore.sh --list
```

Validate a set without writing:
```bash
NAMESPACE=default ./scripts/backup/k8s_restore.sh --dry-run <backup-set>
```

Restore:
```bash
NAMESPACE=default ./scripts/backup/k8s_restore.sh <backup-set>
```

## Optional target overrides (k8s)

If your resource names differ, override these env vars:
- `DOCS_PG_TARGET` (default `deploy/postgres`)
- `AUTH_PG_TARGET` (default `deploy/auth-postgres`)
- `AUDIT_PG_TARGET` (default `deploy/audit-postgres`)
- `SEARCH_PG_TARGET` (default `deploy/search-postgres`)
- `CASSANDRA_POD` (auto-detected from `app=comments-cassandra`)
- `MINIO_POD` (auto-detected from `app=minio`)
