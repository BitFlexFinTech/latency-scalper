#!/bin/bash
# Pre-deployment checks

echo "[DEPLOY] Running pre-deployment checks..."

# Check Git
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "[ERROR] Not inside a Git repository."
  exit 1
fi

# Check PM2
if ! command -v pm2 &> /dev/null; then
  echo "[ERROR] PM2 not installed."
  exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
  echo "[ERROR] Node.js not installed."
  exit 1
fi

# Check jq (for JSON parsing)
if ! command -v jq &> /dev/null; then
  echo "[WARNING] jq not installed. Some health checks may fail."
fi

# Check backend health
STATUS=$(curl -s http://localhost:3001/api/health 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")

if [ "$STATUS" != "ok" ]; then
  echo "[WARNING] Backend is not reporting healthy. Proceed with caution."
else
  echo "[DEPLOY] Backend healthy."
fi

echo "[DEPLOY] Precheck complete."
