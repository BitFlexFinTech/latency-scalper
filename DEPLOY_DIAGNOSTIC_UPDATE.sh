#!/bin/bash
# Deploy diagnostic update to see what columns are in exchange_connections

VPS_IP="107.191.61.107"
VPS_USER="root"
BACKEND_PATH="/opt/latency_scalper_dashboard/backend"

echo "Deploying diagnostic update..."
scp backend/dashboard_api.js ${VPS_USER}@${VPS_IP}:${BACKEND_PATH}/dashboard_api.js

echo ""
echo "Now run on VPS:"
echo "  pm2 restart dashboard-api"
echo "  pm2 logs dashboard-api --lines 50 --raw | grep -i 'All columns\|Sample exchange data\|snapshot age'"
