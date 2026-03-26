#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test for backend /api/perfumes
# Usage: PORT=5001 bash scripts/smoke_backend.sh

PORT=${PORT:-5001}
HOST=${HOST:-localhost}

URL="http://${HOST}:${PORT}/api/perfumes"
echo "Checking ${URL} ..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}" || echo "000")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "OK: ${HTTP_CODE}"
  exit 0
else
  echo "FAIL: ${HTTP_CODE}"
  exit 2
fi
