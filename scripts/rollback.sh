#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

if [ -f .env.production ]; then
  # shellcheck disable=SC1091
  source .env.production
fi

echo "Rolling back to previous version..."

PREVIOUS_BACKEND=$(docker images ghcr.io/${GHCR_NAMESPACE:-your-org}/inventory-backend --format "{{.Tag}}" | sed -n '2p')

if [ -z "$PREVIOUS_BACKEND" ]; then
  echo "No previous image found, cannot rollback"
  exit 1
fi

echo "Rolling back to: $PREVIOUS_BACKEND"

APP_VERSION=$PREVIOUS_BACKEND docker compose --env-file .env.production -f docker-compose.yml up -d --no-deps backend frontend

sleep 10
./scripts/health-check.sh

echo "Rollback complete"
