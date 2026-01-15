#!/bin/bash
# Zero-downtime deployment script

set -e

echo "[DEPLOY] Starting zero-downtime deployment..."

# Run precheck
bash ops/deploy/precheck.sh

echo "[DEPLOY] Pulling latest code..."
git pull origin main || git pull origin master || echo "[WARNING] Git pull failed or not in a git repo"

echo "[DEPLOY] Building frontend..."
cd frontend
npm install --silent
npm run build
cd ..

echo "[DEPLOY] Installing backend dependencies..."
cd backend
npm install --silent
cd ..

echo "[DEPLOY] Reloading services gracefully..."
pm2 reload dashboard-api || pm2 restart dashboard-api
pm2 reload dashboard-frontend || pm2 restart dashboard-frontend

echo "[DEPLOY] Running post-deployment health check..."
sleep 3

STATUS=$(curl -s http://localhost:3001/api/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")

if [ "$STATUS" != "ok" ]; then
  echo "[ERROR] Deployment failed. Rolling back..."
  bash ops/deploy/rollback.sh
  exit 1
fi

echo "[DEPLOY] Deployment successful and healthy."
