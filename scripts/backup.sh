#!/usr/bin/env bash
# Dump the inventory database from the shared MongoDB container.
# Usage: ./scripts/backup.sh [label]   ->   backups/inventory_<timestamp>_<label>.archive.gz
#
# Env overrides: MONGO_CONTAINER (default: mongodb), RETENTION_DAYS (default: 30)

set -euo pipefail

cd "$(dirname "$0")/.."

label="${1:-manual}"
mongo_container="${MONGO_CONTAINER:-mongodb}"
retention_days="${RETENTION_DAYS:-30}"
backup_dir="backups"
file="${backup_dir}/inventory_$(date +%Y%m%d_%H%M%S)_${label}.archive.gz"

# Read MONGODB_URL from .env without sourcing it (the URL contains '&').
mongodb_url="$(grep -E '^MONGODB_URL=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | sed -E "s/^['\"]|['\"]$//g" || true)"
if [ -z "$mongodb_url" ]; then
  echo "MONGODB_URL is not set in .env" >&2
  exit 1
fi

mkdir -p "$backup_dir"
trap 'rm -f "$file"' ERR

echo "Backing up to $file"
docker exec "$mongo_container" mongodump --uri="$mongodb_url" --archive --gzip --quiet > "$file"
echo "Done ($(du -h "$file" | cut -f1))"

find "$backup_dir" -name 'inventory_*.archive.gz' -mtime +"$retention_days" -delete
