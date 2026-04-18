#!/usr/bin/env bash
set -euo pipefail

# Smoke test for coupons API and role-based access.
# Usage: PORT=5000 HOST=localhost bash scripts/smoke_coupons.sh

PORT=${PORT:-5000}
HOST=${HOST:-localhost}
BASE="http://${HOST}:${PORT}"
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-admin123}

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[smoke-coupons] $*"
}

fail() {
  echo "[smoke-coupons] FAIL: $*" >&2
  exit 2
}

extract_token() {
  sed -n 's/.*"token":"\([^"]*\)".*/\1/p'
}

request() {
  local method="$1"
  local url="$2"
  local token="${3:-}"
  local body="${4:-}"
  local out_file="$5"

  if [[ -n "$token" ]]; then
    if [[ -n "$body" ]]; then
      curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "$url" \
        -H "Authorization: Bearer $token" \
        -H 'Content-Type: application/json' \
        -d "$body"
    else
      curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "$url" \
        -H "Authorization: Bearer $token"
    fi
  else
    if [[ -n "$body" ]]; then
      curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "$url" \
        -H 'Content-Type: application/json' \
        -d "$body"
    else
      curl -sS -o "$out_file" -w '%{http_code}' -X "$method" "$url"
    fi
  fi
}

assert_code() {
  local actual="$1"
  local expected="$2"
  local step="$3"
  if [[ "$actual" != "$expected" ]]; then
    fail "$step expected HTTP $expected but got $actual"
  fi
  log "$step => $actual"
}

log "Checking public validate endpoint"
code=$(request POST "$BASE/api/coupons/validate" "" '{"code":"WELCOME10","subtotal":200,"shipping":25}' "$TMP_DIR/validate.json")
assert_code "$code" "200" "public validate"
grep -q '"valid":true' "$TMP_DIR/validate.json" || fail "public validate response is not valid=true"

log "Logging in as admin"
code=$(request POST "$BASE/api/auth/login" "" "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" "$TMP_DIR/admin_login.json")
assert_code "$code" "200" "admin login"
ADMIN_TOKEN=$(extract_token < "$TMP_DIR/admin_login.json")
[[ -n "$ADMIN_TOKEN" ]] || fail "admin token missing"

log "Checking protected coupons endpoint rejects unauthenticated request"
code=$(request GET "$BASE/api/coupons" "" "" "$TMP_DIR/noauth_get.json")
assert_code "$code" "401" "unauthenticated GET /api/coupons"

TEST_CODE="SMOKE$(date +%s)"

log "Creating coupon as admin"
code=$(request POST "$BASE/api/coupons" "$ADMIN_TOKEN" "{\"code\":\"$TEST_CODE\",\"type\":\"percent\",\"amount\":20,\"title\":\"Smoke Coupon\",\"isActive\":true}" "$TMP_DIR/create_coupon.json")
assert_code "$code" "200" "admin create coupon"
grep -q "\"id\":\"$TEST_CODE\"" "$TMP_DIR/create_coupon.json" || fail "created coupon id mismatch"

log "Updating coupon as admin"
code=$(request PUT "$BASE/api/coupons/$TEST_CODE" "$ADMIN_TOKEN" '{"type":"fixed","amount":25,"title":"Smoke Updated","isActive":true}' "$TMP_DIR/update_coupon.json")
assert_code "$code" "200" "admin update coupon"

log "Creating test users for role checks"
SUF=$(date +%s)
M_USER="mgr_$SUF"
E_USER="ed_$SUF"
S_USER="sup_$SUF"
PASS='Test123!'

code=$(request POST "$BASE/api/admin/users" "$ADMIN_TOKEN" "{\"username\":\"$M_USER\",\"password\":\"$PASS\",\"role\":\"Manager\"}" "$TMP_DIR/create_manager.json")
assert_code "$code" "200" "create manager user"

code=$(request POST "$BASE/api/admin/users" "$ADMIN_TOKEN" "{\"username\":\"$E_USER\",\"password\":\"$PASS\",\"role\":\"Editor\"}" "$TMP_DIR/create_editor.json")
assert_code "$code" "200" "create editor user"

code=$(request POST "$BASE/api/admin/users" "$ADMIN_TOKEN" "{\"username\":\"$S_USER\",\"password\":\"$PASS\",\"role\":\"Support\"}" "$TMP_DIR/create_support.json")
assert_code "$code" "200" "create support user"

code=$(request POST "$BASE/api/auth/login" "" "{\"username\":\"$M_USER\",\"password\":\"$PASS\"}" "$TMP_DIR/manager_login.json")
assert_code "$code" "200" "manager login"
M_TOKEN=$(extract_token < "$TMP_DIR/manager_login.json")
[[ -n "$M_TOKEN" ]] || fail "manager token missing"

code=$(request POST "$BASE/api/auth/login" "" "{\"username\":\"$E_USER\",\"password\":\"$PASS\"}" "$TMP_DIR/editor_login.json")
assert_code "$code" "200" "editor login"
E_TOKEN=$(extract_token < "$TMP_DIR/editor_login.json")
[[ -n "$E_TOKEN" ]] || fail "editor token missing"

code=$(request POST "$BASE/api/auth/login" "" "{\"username\":\"$S_USER\",\"password\":\"$PASS\"}" "$TMP_DIR/support_login.json")
assert_code "$code" "200" "support login"
S_TOKEN=$(extract_token < "$TMP_DIR/support_login.json")
[[ -n "$S_TOKEN" ]] || fail "support token missing"

log "Verifying role-based permissions for GET /api/coupons"
code=$(request GET "$BASE/api/coupons" "$M_TOKEN" "" "$TMP_DIR/manager_get.json")
assert_code "$code" "200" "manager coupons access"

code=$(request GET "$BASE/api/coupons" "$E_TOKEN" "" "$TMP_DIR/editor_get.json")
assert_code "$code" "403" "editor coupons access"

code=$(request GET "$BASE/api/coupons" "$S_TOKEN" "" "$TMP_DIR/support_get.json")
assert_code "$code" "403" "support coupons access"

log "Deleting smoke coupon as admin"
code=$(request DELETE "$BASE/api/coupons/$TEST_CODE" "$ADMIN_TOKEN" "" "$TMP_DIR/delete_coupon.txt")
assert_code "$code" "204" "admin delete coupon"

log "PASS"