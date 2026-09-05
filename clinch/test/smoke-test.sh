#!/usr/bin/env bash
# Smoke test for Clinch reporting backend.
# Starts the server, hits every endpoint, checks HTTP 200, then shuts down.
set -e

PORT="${PORT:-4000}"
BASE="http://localhost:${PORT}"
cd "$(dirname "$0")/.."

echo "Starting server on port $PORT..."
PORT=$PORT node server.js > /tmp/clinch-smoke-test.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 1

ENDPOINTS=(
  "/"
  "/api/reports/deal-health-summary"
  "/api/reports/stalled-deals"
  "/api/reports/at-risk-deals"
  "/api/reports/sales-rep-discount-history"
  "/api/reports/deal-status-distribution"
  "/api/reports/dashboard"
  "/api/customers"
  "/api/sales-reps"
  "/api/products"
  "/api/warehouses"
  "/api/deals"
  "/api/deals/DEMO-DEAL-002"
)

FAIL=0
for ep in "${ENDPOINTS[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${ep}")
  if [ "$CODE" == "200" ]; then
    echo "  OK  $CODE  GET $ep"
  else
    echo "  FAIL $CODE  GET $ep"
    FAIL=1
  fi
done

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/api/admin/reset-seed")
if [ "$CODE" == "200" ]; then
  echo "  OK  $CODE  POST /api/admin/reset-seed"
else
  echo "  FAIL $CODE  POST /api/admin/reset-seed"
  FAIL=1
fi

if [ "$FAIL" == "0" ]; then
  echo "All endpoints OK."
else
  echo "Some endpoints FAILED. See /tmp/clinch-smoke-test.log"
  exit 1
fi
