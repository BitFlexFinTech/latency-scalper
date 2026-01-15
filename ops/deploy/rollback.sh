#!/bin/bash
# Rollback script - restores previous working version

set -e

echo "[ROLLBACK] Restoring previous version..."

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "[ERROR] Not in a Git repository. Cannot rollback."
  exit 1
fi

# Reset to previous commit
git reset --hard HEAD~1

echo "[ROLLBACK] Rebuilding frontend..."
cd frontend
npm install --silent
npm run build
cd ..

echo "[ROLLBACK] Reinstalling backend..."
cd backend
npm install --silent
cd ..

echo "[ROLLBACK] Reloading services..."
pm2 reload dashboard-api || pm2 restart dashboard-api
pm2 reload dashboard-frontend || pm2 restart dashboard-frontend

echo "[ROLLBACK] Rollback complete."
