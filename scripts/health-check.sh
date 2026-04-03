#!/bin/bash
# scripts/health-check.sh

set -euo pipefail

HEALTH_URL="https://apistock.devsdesk.site/health"
MAX_RETRIES=10
RETRY_INTERVAL=5

echo "Checking application health at $HEALTH_URL ..."

for i in $(seq 1 "$MAX_RETRIES"); do
  RESPONSE=$(curl -sk -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

  if [ "$RESPONSE" = "200" ]; then
    echo "Health check passed (attempt $i/$MAX_RETRIES)"

    BODY=$(curl -sk "$HEALTH_URL")
    echo "Service status: $BODY"

    MONGO=$(echo "$BODY" | grep -o '"mongodb":"[^"]*"' | cut -d'"' -f4 || true)
    REDIS=$(echo "$BODY" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4 || true)

    if [ "$MONGO" != "ok" ] || [ "$REDIS" != "ok" ]; then
      echo "Critical service degraded! MongoDB: $MONGO, Redis: $REDIS"
      exit 1
    fi

    echo "All critical services healthy"
    exit 0
  fi

  echo "Attempt $i/$MAX_RETRIES failed (HTTP $RESPONSE). Retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "Health check failed after $MAX_RETRIES attempts"
exit 1
