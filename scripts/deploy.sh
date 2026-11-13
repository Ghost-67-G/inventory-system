#!/usr/bin/env bash
# Deploy the latest code on the VPS: pull → back up MongoDB → build → start → wait for healthy.
# Usage: ./scripts/deploy.sh [--skip-backup]

set -euo pipefail

# Wrapped in main() so bash parses the whole file before `git pull` can change it.
main() {
  cd "$(dirname "$0")/.."

  if [ ! -f .env ]; then
    echo "Missing .env — copy .env.example to .env and fill it in." >&2
    exit 1
  fi

  local skip_backup=false
  for arg in "$@"; do
    case "$arg" in
      --skip-backup) skip_backup=true ;;
      *) echo "Unknown option: $arg" >&2; exit 1 ;;
    esac
  done

  echo ">>> Pulling latest code"
  git pull --ff-only

  if [ "$skip_backup" = false ]; then
    echo ">>> Backing up MongoDB (use --skip-backup to bypass)"
    ./scripts/backup.sh pre-deploy
  fi

  echo ">>> Building and starting containers (waits until all are healthy)"
  docker compose up -d --build --remove-orphans --wait --wait-timeout 300

  docker compose ps

  echo ">>> Removing dangling images"
  docker image prune -f

  echo ">>> Deploy complete: $(date)"
}

main "$@"
exit
