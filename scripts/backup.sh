#!/bin/bash
# scripts/backup.sh
# Usage: ./scripts/backup.sh [label]

set -euo pipefail

LABEL=${1:-manual}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${BACKUP_DIR}/inventory_${TIMESTAMP}_${LABEL}.gz"
RETENTION_DAYS=30
COMPOSE="docker-compose --env-file .env.production"

if [ -f .env.production ]; then
  # shellcheck disable=SC1091
  source .env.production
fi

if [ -z "${MONGO_ROOT_PASSWORD:-}" ]; then
  echo "MONGO_ROOT_PASSWORD must be set (export it or define it in .env.production)"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Starting backup: $BACKUP_FILE"

$COMPOSE exec -T mongodb mongodump \
  --uri="mongodb://${MONGO_ROOT_USERNAME:-admin}:${MONGO_ROOT_PASSWORD}@localhost:27017/inventory?authSource=admin" \
  --archive \
  --gzip \
  > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "Backup complete: $BACKUP_FILE ($SIZE)"

find "$BACKUP_DIR" -name "*.gz" -mtime +"$RETENTION_DAYS" -delete
echo "Cleaned up backups older than ${RETENTION_DAYS} days"
