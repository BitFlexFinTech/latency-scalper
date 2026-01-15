# Latency-Scalper Ops Pack

This folder contains all operational tooling for production deployments.

## Architecture

- **Backend API**: Node.js Express API on port 3001
- **Frontend**: Vite/React application on port 8080
- **PM2 Services**: `dashboard-api` and `dashboard-frontend`
- **Supabase**: Real-time data source (latency_logs, trade_logs, exchange_connections)

## Components

### 1. PM2 Services
One-command deployment for backend API and frontend.

**Services:**
- `dashboard-api` - Backend API server (port 3001)
- `dashboard-frontend` - Frontend application (port 8080)

**Deployment:**
```bash
cd /opt/latency_scalper_dashboard
pm2 start backend/dashboard_api.js --name dashboard-api
cd frontend
pm2 start npm --name dashboard-frontend -- start
pm2 save
pm2 startup
```

### 2. Healthcheck Script
Auto-restarts any service that goes offline.

**Location:** `scripts/healthcheck.sh` (to be created)

**Manual Health Check:**
```bash
pm2 ls
pm2 restart dashboard-api dashboard-frontend
```

**Location:** `ops/healthcheck.sh`

**Features:**
- Checks PM2 service status
- Auto-restarts failed services
- Logs all restart events

**Setup Cron:**
```bash
(crontab -l 2>/dev/null; echo "*/2 * * * * /bin/bash /opt/latency_scalper_dashboard/ops/healthcheck.sh >> /var/log/latency-health.log 2>&1") | crontab -
```

### 3. Supabase Schema Validator
Ensures required tables and columns exist.

**Required Tables:**
- `latency_logs` - Columns: venue, ts, latency_ms
- `trade_logs` - Columns: id, symbol, exchange, entry_time, exit_time, etc.
- `exchange_connections` - Columns: exchange_name, is_connected, is_active, etc.

**Backend validates connectivity via:**
- `GET /api/health` - Returns Supabase connection status

**Location:** `ops/migrations/`

**Features:**
- Compares live Supabase schema to required schema
- Generates SQL migration files automatically
- Ensures schema consistency across all VPS instances

**Usage:**
```bash
cd /opt/latency_scalper_dashboard
bash ops/migrations/run.sh
```

### 4. Backend Diagnostics Endpoint
Self-diagnostic JSON endpoint for monitoring and debugging.

**Endpoints:**
- `GET /api/health` - Health check with Supabase status
- `GET /api/system/status` - Comprehensive system status (bot, exchanges, latency, trades, VPS)
- `GET /api/bot/status` - Bot service status

**Location:** `backend/dashboard_api.js`

**Test:**
```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/system/status | jq
```

### 5. Frontend Debug Overlay
Real-time API connection status display.

**Location:** `frontend/src/components/dashboard/panels/ConnectionStatusIndicator.tsx`

**Features:**
- Supabase connection status (green dot when connected)
- Backend API connection status (green dot when connected)
- Exchange count display
- Trade count display (24h)
- Latency samples count

**Visible in:** Dashboard header (connection status indicators)

## Deployment

```bash
cd /opt/latency_scalper_dashboard
bash scripts/complete_deployment.sh
```

Or manually:

```bash
# Start services
pm2 start backend/dashboard_api.js --name dashboard-api
cd frontend
pm2 start npm --name dashboard-frontend -- start
pm2 save
pm2 startup
```

## 📁 Ops Pack Structure

```
/ops
  ├── healthcheck.sh              # Auto-restart failed services
  ├── watchdog/                   # Latency watchdog (connector auto-recovery)
  │   ├── latencyWatchdog.js
  │   ├── config.js
  │   ├── run.sh
  │   └── README.md
  ├── migrations/                 # Supabase migration generator
  │   ├── generateMigration.js
  │   ├── requiredSchema.json
  │   ├── run.sh
  │   └── README.md
  ├── deploy/                     # Zero-downtime deployment
  │   ├── deploy.sh
  │   ├── precheck.sh
  │   ├── rollback.sh
  │   └── README.md
  └── monitoring/                 # Grafana + Prometheus (optional)
      ├── docker-compose.yml
      ├── prometheus.yml
      ├── backend_exporter.js
      └── README.md
```

## Healthcheck Cron

For automated health monitoring, create a cron job:

```bash
# Create healthcheck script (if not exists)
cat > /opt/latency_scalper_dashboard/scripts/healthcheck.sh << 'EOF'
#!/bin/bash
SERVICES=("dashboard-api" "dashboard-frontend")
for SERVICE in "${SERVICES[@]}"; do
  STATUS=$(pm2 jlist | grep -A 5 "\"name\":\"$SERVICE\"" | grep '"status"' | cut -d'"' -f4)
  if [ "$STATUS" != "online" ]; then
    echo "$(date) - $SERVICE is DOWN. Restarting..."
    pm2 restart $SERVICE
  fi
done
EOF

chmod +x /opt/latency_scalper_dashboard/scripts/healthcheck.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "*/2 * * * * /bin/bash /opt/latency_scalper_dashboard/scripts/healthcheck.sh >> /var/log/latency-health.log 2>&1") | crontab -

### 5. Deployment Verification Checklist
Comprehensive verification checklist for deployment validation.

**Location:** `DEPLOYMENT_VERIFICATION_CHECKLIST.md`

## Deployment

### Quick Deploy
```bash
cd /opt/latency_scalper_dashboard
bash scripts/complete_deployment.sh
```

### Manual Deploy

**1. Install dependencies:**
```bash
cd backend
npm install
cd ../frontend
npm install
```

**2. Build frontend:**
```bash
cd frontend
npm run build
```

**3. Start services with PM2:**
```bash
cd /opt/latency_scalper_dashboard
pm2 start backend/dashboard_api.js --name dashboard-api
cd frontend
pm2 start npm --name dashboard-frontend -- start
pm2 save
```

**4. Configure firewall:**
```bash
ufw allow 3001/tcp
ufw allow 8080/tcp
ufw reload
```

### Verify Deployment
```bash
pm2 ls
curl http://localhost:3001/api/health
```

## Configuration

### Backend Configuration
- **Port**: 3001
- **CORS**: Configured for http://107.191.61.107:8080
- **Supabase**: Credentials loaded from `/opt/latency_scalper/.env`

### Frontend Configuration
- **Port**: 8080
- **API URL**: Auto-detected (http://107.191.61.107:3001 on VPS)
- **Build**: Production build with Vite

## Monitoring

### Check Service Status
```bash
pm2 ls
pm2 status
```

### View Logs
```bash
pm2 logs dashboard-api --lines 50
pm2 logs dashboard-frontend --lines 50
```

### Restart Services
```bash
pm2 restart dashboard-api dashboard-frontend
```

### Stop Services
```bash
pm2 stop dashboard-api dashboard-frontend
```

### Delete Services
```bash
pm2 delete dashboard-api dashboard-frontend
```

## Health Checks

### Backend Health
```bash
curl http://localhost:3001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-14T...",
  "supabase": "connected"
}
```

### System Status
```bash
curl http://localhost:3001/api/system/status | jq
```

Expected response:
```json
{
  "bot": { "running": true, "status": "running" },
  "exchanges": { "connected": 2, "total": 2, "list": [...] },
  "latency": { "recent": 10, "samples": [...] },
  "trades": { "last24h": 5 },
  "vps": { "online": true, "status": "active" },
  "timestamp": "...",
  "responseTime": 150
}
```

## Troubleshooting

### Services Not Starting
```bash
pm2 logs dashboard-api --err
pm2 logs dashboard-frontend --err
```

### Port Already in Use
```bash
sudo lsof -i :3001
sudo lsof -i :8080
```

### CORS Errors
Check CORS configuration in `backend/dashboard_api.js`:
- Ensure frontend origin (http://107.191.61.107:8080) is in allowed origins
- Restart backend: `pm2 restart dashboard-api`

### API Not Reachable
1. Check firewall: `ufw status`
2. Check services: `pm2 ls`
3. Check logs: `pm2 logs dashboard-api`
4. Test locally: `curl http://localhost:3001/api/health`

### Frontend Not Loading
1. Check build: `ls -la frontend/dist`
2. Check services: `pm2 ls`
3. Check logs: `pm2 logs dashboard-frontend`
4. Rebuild: `cd frontend && npm run build`

## Directory Structure

```
dashboard_complete_package/
├── backend/
│   ├── dashboard_api.js          # Backend API server
│   └── package.json              # Backend dependencies
├── frontend/
│   ├── src/                      # Frontend source code
│   ├── dist/                     # Built frontend (generated)
│   └── package.json              # Frontend dependencies
├── scripts/
│   └── complete_deployment.sh    # Deployment script
└── README.md                     # This file
```

## Server Information

- **Server IP**: 107.191.61.107
- **Backend Port**: 3001
- **Frontend Port**: 8080
- **Dashboard URL**: http://107.191.61.107:8080
- **Backend API URL**: http://107.191.61.107:3001

## Support

For deployment issues, refer to:
- `DEPLOYMENT_VERIFICATION_CHECKLIST.md` - Comprehensive verification steps
- `AUDIT_REPORT.md` - Full audit report and fixes
- PM2 logs - Service-specific error logs
- Browser console - Frontend error logs
