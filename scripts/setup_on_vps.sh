#!/bin/bash
# Complete VPS Setup Script
# Run this on your VPS: bash setup_on_vps.sh

set -e

echo "=========================================="
echo "Setting up Dashboard on VPS"
echo "=========================================="

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Create dashboard directory
DASHBOARD_DIR="/opt/latency_scalper_dashboard"
mkdir -p $DASHBOARD_DIR
cd $DASHBOARD_DIR

echo "Dashboard directory: $DASHBOARD_DIR"
echo ""
echo "Next steps:"
echo "1. Copy all files from dashboard_complete_package to $DASHBOARD_DIR"
echo "2. Run: cd $DASHBOARD_DIR && npm install"
echo "3. Run: cd $DASHBOARD_DIR/backend && npm install"
echo "4. Start backend: pm2 start backend/dashboard_api.js --name dashboard-api"
echo "5. Build frontend: cd $DASHBOARD_DIR && npm run build"
echo "6. Start frontend: pm2 start npm --name dashboard -- start"
echo "7. Save PM2: pm2 save"
