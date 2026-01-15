#!/bin/bash
# Healthcheck script - auto-restarts failed services

SERVICES=("dashboard-api" "dashboard-frontend")

for SERVICE in "${SERVICES[@]}"; do
  STATUS=$(pm2 jlist 2>/dev/null | grep -A 5 "\"name\":\"$SERVICE\"" | grep '"status"' | cut -d'"' -f4 || echo "unknown")
  
  if [ "$STATUS" != "online" ]; then
    echo "$(date) - $SERVICE is DOWN (status: $STATUS). Restarting..."
    pm2 restart $SERVICE 2>/dev/null || pm2 start $SERVICE 2>/dev/null
  else
    echo "$(date) - $SERVICE is healthy."
  fi
done
