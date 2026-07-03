#!/bin/bash
# scripts/deploy.sh
# Usage: ./scripts/deploy.sh [--skip-backup] [--skip-frontend] [--skip-backend]

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
COMPOSE="docker compose --env-file .env.production"
HEALTH_URL="https://apistock.devsdesk.site/health"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$PROJECT_DIR"

if [ -f .env.production ]; then
  # shellcheck disable=SC1091
  source .env.production
fi

if [ -z "${MONGO_ROOT_PASSWORD:-}" ]; then
  echo "MONGO_ROOT_PASSWORD is required in .env.production"
  exit 1
fi

SKIP_BACKUP=false
SKIP_FRONTEND=false
SKIP_BACKEND=false

for arg in "$@"; do
  case $arg in
    --skip-backup)   SKIP_BACKUP=true ;;
    --skip-frontend) SKIP_FRONTEND=true ;;
    --skip-backend)  SKIP_BACKEND=true ;;
  esac
done

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "======================================"
echo "  Inventory System Deploy"
echo "  Time: $(date)"
echo "======================================"

# ─── Step 1: Git Pull ─────────────────────────────────────────────────────────
echo ""
echo ">>> Step 1: Pulling latest code..."
git pull

# ─── Step 2: Pre-deploy Backup ────────────────────────────────────────────────
if [ "$SKIP_BACKUP" = false ]; then
  echo ""
  echo ">>> Step 2: Creating pre-deploy backup..."
  ./scripts/backup.sh "pre-deploy-${TIMESTAMP}" || echo "WARNING: Backup failed, continuing deploy..."
else
  echo ""
  echo ">>> Step 2: Skipping backup (--skip-backup)"
fi

# ─── Step 3: Build ────────────────────────────────────────────────────────────
echo ""
echo ">>> Step 3: Building images (--no-cache)..."

if [ "$SKIP_BACKEND" = false ] && [ "$SKIP_FRONTEND" = false ]; then
  $COMPOSE build --no-cache backend frontend
elif [ "$SKIP_BACKEND" = false ]; then
  $COMPOSE build --no-cache backend
elif [ "$SKIP_FRONTEND" = false ]; then
  $COMPOSE build --no-cache frontend
else
  echo "Both skipped, nothing to build."
fi

# ─── Step 4: Down + Up ────────────────────────────────────────────────────────
echo ""
echo ">>> Step 4: Stopping all services..."
$COMPOSE down --remove-orphans

echo ""
echo ">>> Step 5: Starting all services..."
$COMPOSE up -d

# ─── Step 5.1: Ensure Mongo replica set is initialized ──────────────────────
echo ""
echo ">>> Step 5.1: Ensuring Mongo replica set (rs0) is initialized..."

$COMPOSE exec -T mongodb mongosh \
  --username "${MONGO_ROOT_USERNAME:-admin}" \
  --password "${MONGO_ROOT_PASSWORD}" \
  --authenticationDatabase admin \
  --eval '
try {
  const st = rs.status();
  if (st.ok === 1) {
    print("Replica set already initialized");
  }
} catch (e) {
  rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "mongodb:27017" }] });
  print("Replica set initiated");
}
'

# Wait for primary election after initiate/restart
for i in $(seq 1 12); do
  IS_PRIMARY=$($COMPOSE exec -T mongodb mongosh \
    --quiet \
    --username "${MONGO_ROOT_USERNAME:-admin}" \
    --password "${MONGO_ROOT_PASSWORD}" \
    --authenticationDatabase admin \
    --eval 'try { db.hello().isWritablePrimary ? "yes" : "no" } catch (e) { "no" }')

  if [ "$IS_PRIMARY" = "yes" ]; then
    echo "Mongo primary is ready"
    break
  fi

  if [ "$i" = "12" ]; then
    echo "Mongo replica set primary election timed out"
    exit 1
  fi

  sleep 3
done

# ─── Step 6: Health Check ─────────────────────────────────────────────────────
echo ""
echo ">>> Step 6: Waiting for services to start..."
sleep 15

echo "Running health check..."
MAX_RETRIES=10
RETRY_INTERVAL=5

for i in $(seq 1 "$MAX_RETRIES"); do
  RESPONSE=$(curl -sk -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")

  if [ "$RESPONSE" = "200" ]; then
    BODY=$(curl -sk "$HEALTH_URL")
    echo "Health check passed (attempt $i/$MAX_RETRIES)"
    echo "  $BODY"
    break
  fi

  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "Health check FAILED after $MAX_RETRIES attempts!"
    echo "Check logs: $COMPOSE logs backend --tail 50"
    exit 1
  fi

  echo "  Attempt $i/$MAX_RETRIES (HTTP $RESPONSE). Retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

# ─── Step 7: Status ───────────────────────────────────────────────────────────
echo ""
echo ">>> Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "inventory|reverse"

# ─── Step 8: Cleanup ──────────────────────────────────────────────────────────
echo ""
echo ">>> Cleaning up old images..."
docker image prune -f

echo ""
echo "======================================"
echo "  Deploy complete!"
echo "  Time: $(date)"
echo "  Frontend: https://stock.devsdesk.site"
echo "  API:      https://apistock.devsdesk.site/health"
echo "======================================"
