#!/bin/bash
# scripts/deploy.sh

set -euo pipefail

VERSION=${1:-latest}
COMPOSE_FILE="docker-compose.yml"
BACKUP_BEFORE_DEPLOY=true

echo "======================================"
echo "Deploying inventory SaaS v${VERSION}"
echo "======================================"

if [ "$BACKUP_BEFORE_DEPLOY" = true ]; then
  echo "Creating pre-deploy backup..."
  ./scripts/backup.sh "pre-deploy-${VERSION}"
fi

echo "Pulling images..."
APP_VERSION="$VERSION" docker compose --env-file .env.production -f "$COMPOSE_FILE" pull backend frontend

echo "Restarting backend..."
APP_VERSION="$VERSION" docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d --no-deps --build backend
sleep 10

echo "Running health check..."
if ! ./scripts/health-check.sh; then
  echo "Health check failed! Rolling back..."
  ./scripts/rollback.sh
  exit 1
fi

echo "Restarting frontend..."
APP_VERSION="$VERSION" docker compose --env-file .env.production -f "$COMPOSE_FILE" up -d --no-deps --build frontend

echo "Reloading nginx..."
docker compose --env-file .env.production -f "$COMPOSE_FILE" exec nginx nginx -s reload

echo "Cleaning up old images..."
docker image prune -f

echo ""
echo "======================================"
echo "Deploy complete!"
echo "Version: ${VERSION}"
echo "Time: $(date)"
echo "======================================"
