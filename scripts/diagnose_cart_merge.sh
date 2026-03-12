#!/usr/bin/env bash
set -euo pipefail

echo "== Direct backend /api/perfumes check =="
curl -sS -I http://localhost:5000/api/perfumes || true

echo "\n== Frontend proxy /api/cart/init =="
# init and save headers + cookie jar
curl -sS -D /tmp/cart_headers.txt -c /tmp/cart_cookies.txt -o /tmp/cart_body.json -X POST http://localhost:3000/api/cart/init -H "Content-Type: application/json" -d '{}' || true

echo "-- headers --"
sed -n '1,200p' /tmp/cart_headers.txt || true

echo "\n-- cookies (jar) --"
if [ -f /tmp/cart_cookies.txt ]; then
  sed -n '1,200p' /tmp/cart_cookies.txt || true
else
  echo "no cookie jar found"
fi

# extract tokens from headers (fallback)
xsrf=$(sed -n "s/Set-Cookie: XSRF-TOKEN=\([^;]*\).*/\1/p" /tmp/cart_headers.txt || true)
cid=$(sed -n "s/Set-Cookie: cartId=\([^;]*\).*/\1/p" /tmp/cart_headers.txt || true)

echo "\nExtracted: XSRF=$xsrf"
echo "Extracted: cartId=$cid"

echo "\nBody from init:"
sed -n '1,200p' /tmp/cart_body.json || true

echo "\n== POST /api/cart/merge via frontend proxy =="
# perform merge using cookie jar and XSRF header
curl -sS -i -b /tmp/cart_cookies.txt -H "X-XSRF-TOKEN: $xsrf" -H "Content-Type: application/json" -X POST http://localhost:3000/api/cart/merge -d "{\"cartId\":\"$cid\",\"items\":[{\"perfumeId\":1,\"name\":\"Test\",\"price\":10.0,\"quantity\":1}] }" -o /tmp/merge_resp.txt || true

sed -n '1,200p' /tmp/merge_resp.txt || true

echo "\n== backend listening/processes =="
lsof -i :5000 -sTCP:LISTEN -P -n || true
ps aux | grep dotnet | grep -v grep || true
