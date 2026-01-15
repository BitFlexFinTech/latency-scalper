#!/bin/bash
# Complete Automated Deployment Script
# This script does EVERYTHING - just run it on the VPS
# Usage: bash complete_deployment.sh

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Don't exit on error - we'll handle it manually
set +e

echo "=========================================="
echo "Complete Dashboard Deployment"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root${NC}"
    exit 1
fi

# Install Node.js if needed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo -e "${GREEN}Node.js installed${NC}"
fi

# Install PM2 if needed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    npm install -g pm2
    echo -e "${GREEN}PM2 installed${NC}"
fi

# Create dashboard directory
DASHBOARD_DIR="/opt/latency_scalper_dashboard"
echo -e "${YELLOW}Setting up dashboard in: $DASHBOARD_DIR${NC}"
mkdir -p $DASHBOARD_DIR
cd $DASHBOARD_DIR

# Install backend dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd $DASHBOARD_DIR/backend
if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}Backend dependencies installed${NC}"
else
    echo -e "${RED}Backend package.json not found${NC}"
    exit 1
fi

# Install frontend dependencies - CRITICAL SECTION
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd $DASHBOARD_DIR/frontend

if [ ! -f "package.json" ]; then
    echo -e "${RED}Frontend package.json not found${NC}"
    exit 1
fi

# Complete clean - remove everything
echo -e "${YELLOW}Cleaning old installation...${NC}"
rm -rf node_modules package-lock.json .npm
npm cache clean --force 2>/dev/null || true

# Install ALL dependencies from package.json
echo -e "${YELLOW}Installing all dependencies from package.json...${NC}"
npm install --legacy-peer-deps 2>&1 | tee /tmp/npm_install.log

# Now explicitly install and verify CRITICAL packages one by one
echo -e "${YELLOW}Installing and verifying critical packages...${NC}"

install_and_verify() {
    local pkg=$1
    local version=$2
    echo -e "${YELLOW}Installing $pkg@$version...${NC}"
    npm install "${pkg}@${version}" --save --legacy-peer-deps --force 2>&1 | grep -v "npm WARN" || true
    if [ ! -d "node_modules/$pkg" ]; then
        echo -e "${RED}FAILED: $pkg not found in node_modules${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $pkg installed${NC}"
        return 0
    fi
}

# Install and verify each critical package
FAILED=0
install_and_verify "tailwindcss-animate" "^1.0.7" || FAILED=1
install_and_verify "embla-carousel-react" "^8.6.0" || FAILED=1
install_and_verify "xterm" "^5.3.0" || FAILED=1

if [ $FAILED -eq 1 ]; then
    echo -e "${RED}CRITICAL ERROR: Failed to install required packages${NC}"
    echo -e "${YELLOW}Attempting one more time with different approach...${NC}"
    cd $DASHBOARD_DIR/frontend
    npm install tailwindcss-animate embla-carousel-react xterm --save --legacy-peer-deps --force
    # Verify one final time
    if [ ! -d "node_modules/tailwindcss-animate" ] || [ ! -d "node_modules/embla-carousel-react" ] || [ ! -d "node_modules/xterm" ]; then
        echo -e "${RED}FATAL: Still missing required packages${NC}"
        echo "Missing packages:"
        [ ! -d "node_modules/tailwindcss-animate" ] && echo "  - tailwindcss-animate"
        [ ! -d "node_modules/embla-carousel-react" ] && echo "  - embla-carousel-react"
        [ ! -d "node_modules/xterm" ] && echo "  - xterm"
        exit 1
    fi
fi

echo -e "${GREEN}All critical packages verified${NC}"

# Build frontend with increased memory limit
echo -e "${YELLOW}Building frontend...${NC}"

# Check available memory and create swap if needed
AVAILABLE_MEM=$(free -m | awk '/^Mem:/{print $7}')
if [ "$AVAILABLE_MEM" -lt 2048 ]; then
    echo -e "${YELLOW}Low memory detected (${AVAILABLE_MEM}MB available). Creating swap space...${NC}"
    # Create 2GB swap file if it doesn't exist
    if [ ! -f /swapfile ]; then
        fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
        echo -e "${GREEN}Swap file created and activated${NC}"
    else
        swapon /swapfile 2>/dev/null || true
    fi
fi

# Increase Node.js memory limit to handle large builds
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
BUILD_STATUS=$?
if [ $BUILD_STATUS -ne 0 ]; then
    echo -e "${RED}Build failed with exit code $BUILD_STATUS${NC}"
    if [ $BUILD_STATUS -eq 134 ] || [ $BUILD_STATUS -eq 137 ]; then
        echo -e "${RED}Memory error detected. The build requires more memory.${NC}"
        echo -e "${YELLOW}Try: export NODE_OPTIONS='--max-old-space-size=6144' && npm run build${NC}"
    fi
    exit 1
fi
echo -e "${GREEN}Frontend built successfully${NC}"

# Stop existing PM2 processes if any
echo -e "${YELLOW}Stopping existing services...${NC}"
pm2 stop dashboard-api dashboard-frontend 2>/dev/null || true
pm2 delete dashboard-api dashboard-frontend 2>/dev/null || true

# Start backend API
echo -e "${YELLOW}Starting backend API...${NC}"
cd $DASHBOARD_DIR/backend
pm2 start dashboard_api.js --name dashboard-api
echo -e "${GREEN}Backend API started${NC}"

# Start frontend
echo -e "${YELLOW}Starting frontend...${NC}"
cd $DASHBOARD_DIR/frontend
pm2 start npm --name dashboard-frontend -- start
echo -e "${GREEN}Frontend started${NC}"

# Save PM2 configuration
pm2 save

# Configure firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw allow 8080/tcp 2>/dev/null || true
ufw allow 3001/tcp 2>/dev/null || true
echo -e "${GREEN}Firewall configured${NC}"

echo ""
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Dashboard is now running at:"
echo -e "${GREEN}http://107.191.61.107:8080${NC}"
echo ""
echo "Services status:"
pm2 list
echo ""
echo "To view logs:"
echo "  pm2 logs dashboard-api"
echo "  pm2 logs dashboard-frontend"
echo ""
echo "To restart services:"
echo "  pm2 restart dashboard-api dashboard-frontend"
