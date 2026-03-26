#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test for frontend root page
# Usage: PORT=3000 bash scripts/smoke_frontend.sh

PORT=${PORT:-3000}
HOST=${HOST:-localhost}

URL="http://${HOST}:${PORT}/"
echo "Checking ${URL} ..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}" || echo "000")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "OK: ${HTTP_CODE}"
  exit 0
else
  echo "FAIL: ${HTTP_CODE}"
  exit 2
fi
