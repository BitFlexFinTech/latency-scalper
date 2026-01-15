# SSH Commands for Bot Management

## Quick Start

1. **SSH into your VPS:**
   ```bash
   ssh root@107.191.61.107
   # Or use your SSH key if configured
   ```

2. **Run the diagnostic script:**
   ```bash
   # Copy the script to VPS first, then:
   bash check_and_start_bot.sh
   ```

## Manual Commands

### Check Bot Status
```bash
# Check if bot service is running
systemctl status scalper.service

# Quick check (active/stopped)
systemctl is-active scalper.service

# Check if bot process is running
ps aux | grep scalper
```

### Start/Stop Bot
```bash
# Start bot
sudo systemctl start scalper.service

# Stop bot
sudo systemctl stop scalper.service

# Restart bot
sudo systemctl restart scalper.service
```

### View Bot Logs
```bash
# Last 50 lines
journalctl -u scalper.service -n 50 --no-pager

# Follow logs in real-time
journalctl -u scalper.service -f

# Logs from last hour
journalctl -u scalper.service --since "1 hour ago" --no-pager
```

### Check Backend API
```bash
# Check PM2 status
pm2 status

# View API logs
pm2 logs dashboard-api --lines 50

# Restart API
pm2 restart dashboard-api

# Test API endpoints
curl http://localhost:3001/api/health
curl http://localhost:3001/api/system/status | jq
```

### Check Database Connection
```bash
# Check if bot can connect to Supabase
# (This depends on your bot's logging)
journalctl -u scalper.service | grep -i supabase

# Check bot's .env file
cat /opt/latency_scalper/.env | grep SUPABASE
```

### Common Issues

**Bot won't start:**
```bash
# Check service file
cat /etc/systemd/system/scalper.service

# Check for errors
journalctl -u scalper.service -n 100 --no-pager | grep -i error

# Check permissions
ls -la /opt/latency_scalper/
```

**API not responding:**
```bash
# Check if port is open
netstat -tuln | grep 3001

# Check firewall
sudo ufw status
sudo ufw allow 3001/tcp

# Check PM2
pm2 list
pm2 logs dashboard-api
```

**No data in dashboard:**
```bash
# Check if bot is writing to Supabase
# (Check bot logs for database writes)
journalctl -u scalper.service | grep -i "balance\|trade\|latency"

# Test API directly
curl http://localhost:3001/api/system/status | jq '.exchanges'
```
