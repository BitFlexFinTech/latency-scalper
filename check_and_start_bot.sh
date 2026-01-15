#!/bin/bash
# Bot Status Check and Start Script
# Run this on your VPS: bash check_and_start_bot.sh

echo "=========================================="
echo "LATENCY SCALPER - BOT STATUS CHECK"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check bot service status
echo "1. Checking bot service status..."
BOT_STATUS=$(systemctl is-active scalper.service 2>/dev/null || echo "inactive")
if [ "$BOT_STATUS" = "active" ]; then
    echo -e "${GREEN}✓ Bot is RUNNING${NC}"
else
    echo -e "${RED}✗ Bot is STOPPED${NC}"
fi
echo ""

# 2. Check bot service details
echo "2. Bot service details:"
systemctl status scalper.service --no-pager -l | head -n 10
echo ""

# 3. Check if bot process is running
echo "3. Checking for bot processes..."
BOT_PROCESSES=$(ps aux | grep -i scalper | grep -v grep | wc -l)
if [ "$BOT_PROCESSES" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $BOT_PROCESSES bot process(es)${NC}"
    ps aux | grep -i scalper | grep -v grep
else
    echo -e "${RED}✗ No bot processes found${NC}"
fi
echo ""

# 4. Check recent bot logs
echo "4. Recent bot logs (last 20 lines):"
echo "-----------------------------------"
journalctl -u scalper.service -n 20 --no-pager 2>/dev/null || echo "No logs found"
echo ""

# 5. Check backend API status
echo "5. Checking backend API..."
if command -v pm2 &> /dev/null; then
    PM2_STATUS=$(pm2 list | grep dashboard-api | awk '{print $10}' || echo "not found")
    if [ "$PM2_STATUS" = "online" ]; then
        echo -e "${GREEN}✓ Backend API is running${NC}"
    else
        echo -e "${RED}✗ Backend API is not running${NC}"
    fi
    pm2 list | grep dashboard-api || echo "dashboard-api not found in pm2"
else
    echo -e "${YELLOW}⚠ PM2 not found - checking if API is running on port 3001${NC}"
    if netstat -tuln 2>/dev/null | grep -q ":3001 "; then
        echo -e "${GREEN}✓ Port 3001 is open${NC}"
    else
        echo -e "${RED}✗ Port 3001 is not open${NC}"
    fi
fi
echo ""

# 6. Test API endpoints
echo "6. Testing API endpoints..."
echo "Health check:"
curl -s http://localhost:3001/api/health 2>/dev/null | jq . || echo "Failed to connect to API"
echo ""
echo "System status:"
curl -s http://localhost:3001/api/system/status 2>/dev/null | jq . || echo "Failed to connect to API"
echo ""

# 7. Check Supabase connection
echo "7. Checking Supabase connection..."
if [ -f "/opt/latency_scalper/.env" ]; then
    echo "✓ Found bot .env file"
    SUPABASE_URL=$(grep SUPABASE_URL /opt/latency_scalper/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
    if [ -n "$SUPABASE_URL" ]; then
        echo "  Supabase URL: $SUPABASE_URL"
    else
        echo -e "${YELLOW}  ⚠ SUPABASE_URL not found in .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Bot .env file not found at /opt/latency_scalper/.env${NC}"
fi
echo ""

# 8. Offer to start bot if stopped
if [ "$BOT_STATUS" != "active" ]; then
    echo "=========================================="
    echo -e "${YELLOW}BOT IS STOPPED${NC}"
    echo "=========================================="
    read -p "Do you want to start the bot? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting bot..."
        sudo systemctl start scalper.service
        sleep 2
        NEW_STATUS=$(systemctl is-active scalper.service 2>/dev/null || echo "inactive")
        if [ "$NEW_STATUS" = "active" ]; then
            echo -e "${GREEN}✓ Bot started successfully!${NC}"
        else
            echo -e "${RED}✗ Failed to start bot. Check logs:${NC}"
            journalctl -u scalper.service -n 30 --no-pager
        fi
    fi
fi

echo ""
echo "=========================================="
echo "DIAGNOSTIC COMPLETE"
echo "=========================================="
