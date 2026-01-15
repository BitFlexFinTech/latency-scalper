#!/bin/bash
# ============================================
# FRESH DEPLOYMENT SCRIPT
# Deploys clean backend API to VPS
# ============================================

set -e  # Exit on error

VPS_IP="107.191.61.107"
VPS_USER="root"
BACKEND_PATH="/opt/latency_scalper_dashboard/backend"
BACKEND_FILE="dashboard_api.js"

echo "=========================================="
echo "FRESH DEPLOYMENT - Backend API"
echo "=========================================="
echo ""
echo "VPS: ${VPS_USER}@${VPS_IP}"
echo "Target: ${BACKEND_PATH}/${BACKEND_FILE}"
echo ""

# Step 1: Verify file exists locally
if [ ! -f "backend/${BACKEND_FILE}" ]; then
    echo "ERROR: backend/${BACKEND_FILE} not found!"
    echo "Current directory: $(pwd)"
    echo "Files in backend/:"
    ls -la backend/ || echo "backend/ directory not found"
    exit 1
fi

echo "✓ Local file verified: backend/${BACKEND_FILE}"
echo ""

# Step 2: Copy file to VPS
echo "Step 1: Copying ${BACKEND_FILE} to VPS..."
echo "Command: scp backend/${BACKEND_FILE} ${VPS_USER}@${VPS_IP}:${BACKEND_PATH}/${BACKEND_FILE}"
echo ""
echo "You will be prompted for VPS password..."
scp backend/${BACKEND_FILE} ${VPS_USER}@${VPS_IP}:${BACKEND_PATH}/${BACKEND_FILE}

if [ $? -eq 0 ]; then
    echo "✓ File copied successfully"
else
    echo "✗ File copy failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "NEXT STEPS (run on VPS via SSH):"
echo "=========================================="
echo ""
echo "1. SSH into VPS:"
echo "   ssh ${VPS_USER}@${VPS_IP}"
echo ""
echo "2. Verify file was copied:"
echo "   ls -lh ${BACKEND_PATH}/${BACKEND_FILE}"
echo ""
echo "3. Restart API:"
echo "   pm2 restart dashboard-api"
echo ""
echo "4. Check logs:"
echo "   pm2 logs dashboard-api --lines 30"
echo ""
echo "5. Test API:"
echo "   curl http://localhost:3001/api/health"
echo "   curl http://localhost:3001/api/system/status | jq"
echo ""
echo "=========================================="
