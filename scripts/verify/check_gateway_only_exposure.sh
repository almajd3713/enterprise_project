#!/usr/bin/env bash
set -euo pipefail

compose_file="infra/docker/docker-compose.yml"
override_file="infra/docker/docker-compose.submission.yml"

json=$(docker compose -f "$compose_file" -f "$override_file" config --format json)

violations=$(python3 - <<'PY' "$json"
import json
import sys
cfg = json.loads(sys.argv[1])
services = cfg.get("services", {})
violations = []
for name, svc in services.items():
    ports = svc.get("ports", []) or []
    if name != "gateway" and ports:
        violations.append((name, ports))
if violations:
    for name, ports in violations:
        print(f"{name}: {ports}")
PY
)

if [[ -n "$violations" ]]; then
  echo "Non-gateway services are externally exposed in submission profile:"
  echo "$violations"
  exit 1
fi

echo "OK: only gateway is externally exposed in submission profile"
