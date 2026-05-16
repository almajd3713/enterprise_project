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

- `BASE_URL=http://localhost:3333`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
- `USERS_COUNT=16`
- `DOCS_COUNT=120`
- `COMMENTS_PER_DOC=3`

## What it creates

- Departments (idempotent)
- Document categories (idempotent)
- Staff users (`staff001...`) with rotating roles
- Documents uploaded as different users
- Multiple comments per document by different users
- Search/audit reads to produce realistic access traces

## Notes

- Script is safe to re-run. Duplicate resources are ignored where possible.
- Generated temp files are stored under `/tmp/dms-seed-<tag>`.
