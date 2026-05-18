# DMS Data Seeder

Populate the stack with realistic demo data (users, docs, comments, search/audit activity).

## Run

From repo root:

```bash
./scripts/seed/seed_dms_data.sh
```

## Useful knobs

```bash
BASE_URL=http://localhost:3333 \
USERS_COUNT=20 \
DOCS_COUNT=150 \
COMMENTS_PER_DOC=4 \
./scripts/seed/seed_dms_data.sh
```

## Defaults

- `BASE_URL` auto-detected from:
  - `http://localhost:3333` (docker-compose)
  - `http://localhost:8080` (port-forwarded gateway)
  - `http://localhost:30090` (k8s NodePort)
  - fallback: `http://localhost:3333`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
- `USERS_COUNT=16`
- `DOCS_COUNT=120`
- `COMMENTS_PER_DOC=3`

Override detection when needed:

```bash
BASE_URL=http://localhost:8080 ./scripts/seed/seed_dms_data.sh
```

Or customize probes:

```bash
BASE_URL_CANDIDATES=http://localhost:8080,http://localhost:30090 ./scripts/seed/seed_dms_data.sh
```

## What it creates

- Departments (idempotent)
- Document categories (idempotent)
- Staff users (`staff001...`) with rotating roles
- Documents uploaded as different users
- Document descriptions included on each upload (to feed translation/search)
- Multiple comments per document by different users
- Search/audit reads to produce realistic access traces

## Notes

- Script is safe to re-run. Duplicate resources are ignored where possible.
- Generated temp files are stored under `/tmp/dms-seed-<tag>`.
- For k8s + WSL + Windows downloads, presigned URLs must use a Windows-reachable MinIO host.
  Example: set `MINIO_PUBLIC_ENDPOINT=http://localhost:19000` in `documents-service`.

## Demo-reserved entities

The seeder intentionally does **not** create these reserved demo entities:
- Departments: `Finance`, `IT`
- Categories: `General`, `Administrative`, `Training`
