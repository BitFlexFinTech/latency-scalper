#!/bin/bash
# Deploy Balance Fix to VPS
# Run this from your Mac to copy the fixed backend API to VPS

echo "=========================================="
echo "DEPLOYING BALANCE FIX TO VPS"
echo "=========================================="
echo ""

VPS_IP="107.191.61.107"
VPS_USER="root"
BACKEND_PATH="/opt/latency_scalper_dashboard/backend"

echo "1. Copying fixed dashboard_api.js to VPS..."
scp backend/dashboard_api.js ${VPS_USER}@${VPS_IP}:${BACKEND_PATH}/dashboard_api.js

echo ""
echo "2. SSH into VPS and run these commands:"
echo "   ssh ${VPS_USER}@${VPS_IP}"
echo "   cd ${BACKEND_PATH}"
echo "   pm2 restart dashboard-api"
echo "   pm2 logs dashboard-api --lines 20"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3001/api/system/status | jq '.exchanges.list'"
echo ""
echo "=========================================="
