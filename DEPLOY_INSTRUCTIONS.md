# Complete Deployment Instructions

## What This Does

This package contains a **complete, ready-to-deploy dashboard** that:
- ✅ Replicates the profit-accelerator UI
- ✅ Connects to your new bot's Supabase data (latency_logs, trade_logs)
- ✅ Bot control via systemd (start/stop buttons work)
- ✅ Real-time data updates
- ✅ All tabs, pages, charts, tables functional
- ✅ Runs on port 8080

## Step 1: Transfer Package to VPS

**On your local machine:**

```bash
cd /Users/tadii
tar -czf dashboard_complete_package.tar.gz dashboard_complete_package/
scp dashboard_complete_package.tar.gz root@107.191.61.107:/tmp/
```

## Step 2: Deploy on VPS

**SSH into your VPS:**

```bash
ssh root@107.191.61.107
```

**Extract and deploy:**

```bash
cd /opt
tar -xzf /tmp/dashboard_complete_package.tar.gz
mv dashboard_complete_package/* latency_scalper_dashboard/ 2>/dev/null || mkdir -p latency_scalper_dashboard && mv dashboard_complete_package/* latency_scalper_dashboard/
cd latency_scalper_dashboard

# Run the complete deployment script
bash scripts/complete_deployment.sh
```

That's it! The script does everything automatically.

## Step 3: Access Dashboard

Open in your browser:
```
http://107.191.61.107:8080
```

## What the Script Does

1. ✅ Installs Node.js and PM2 if needed
2. ✅ Installs all dependencies (backend and frontend)
3. ✅ Builds the frontend
4. ✅ Starts backend API (port 3001)
5. ✅ Starts frontend (port 8080)
6. ✅ Configures firewall
7. ✅ Sets up PM2 for auto-restart

## Troubleshooting

### Dashboard not loading?
```bash
# Check if services are running
pm2 list

# Check logs
pm2 logs dashboard-frontend
pm2 logs dashboard-api

# Restart services
pm2 restart dashboard-api dashboard-frontend
```

### Port 8080 not accessible?
```bash
# Check firewall
ufw status
ufw allow 8080/tcp
```

### Bot control not working?
```bash
# Check backend API
curl http://localhost:3001/api/bot/status

# Check backend logs
pm2 logs dashboard-api
```

## Services

- **Backend API**: Port 3001 (handles bot control via systemd)
- **Frontend**: Port 8080 (the dashboard you see in browser)

Both services run via PM2 and will auto-restart if they crash.

## That's It!

Your dashboard is now live at: **http://107.191.61.107:8080**

All features are connected to your new bot's data and ready to use!
