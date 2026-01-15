# Complete Dashboard Setup Guide

## Overview
This guide will help you set up the complete dashboard on your VPS (107.191.61.107) on port 8080, with all tabs, pages, and buttons connected to your new bot's data.

## Prerequisites
- VPS access (107.191.61.107)
- Node.js 20+ installed
- Your profit-accelerator repo at `/Users/tadii/profit-accelerator`
- Supabase credentials (already configured)

## Step 1: Transfer Package to VPS

From your local machine:
```bash
# Create a tarball of the package
cd /Users/tadii
tar -czf dashboard_complete_package.tar.gz dashboard_complete_package/

# Transfer to VPS
scp dashboard_complete_package.tar.gz root@107.191.61.107:/tmp/
```

## Step 2: Setup on VPS

SSH into your VPS:
```bash
ssh root@107.191.61.107
```

Extract and setup:
```bash
cd /opt
tar -xzf /tmp/dashboard_complete_package.tar.gz
cd dashboard_complete_package

# Run setup script
bash scripts/setup_on_vps.sh
```

## Step 3: Install Dependencies

```bash
# Install backend dependencies
cd /opt/dashboard_complete_package/backend
npm install

# Install frontend dependencies
cd /opt/dashboard_complete_package/frontend
npm install
```

## Step 4: Copy UI Components from profit-accelerator

You need to copy the UI components from your local profit-accelerator repo. The key directories to copy are:

```bash
# On your local machine, from /Users/tadii/profit-accelerator:
# Copy these directories to VPS:

# 1. All dashboard components
src/components/dashboard/* → frontend/src/components/dashboard/

# 2. All UI components
src/components/ui/* → frontend/src/components/ui/

# 3. All pages
src/pages/* → frontend/src/pages/

# 4. All hooks (will need modifications)
src/hooks/* → frontend/src/hooks/

# 5. All lib files
src/lib/* → frontend/src/lib/

# 6. Store
src/store/* → frontend/src/store/

# 7. Config files
package.json, vite.config.ts, tailwind.config.ts, tsconfig.json, etc.
```

## Step 5: Key Modifications Needed

After copying files, you need to modify them to connect to your new bot:

### 5.1 Data Tables
Replace all references:
- `trading_journal` → `trade_logs`
- `exchange_latency_history` → `latency_logs`
- Any other old table names → new bot's table names

### 5.2 Bot Control
Update UnifiedControlBar and any bot control components:
- Replace Supabase edge function calls with `botControlApi` service
- Use `startBot()`, `stopBot()`, `getBotStatus()` from `src/services/botControlApi.ts`

### 5.3 Data Hooks
Ensure all hooks use:
- `trade_logs` table for trades
- `latency_logs` table for latency data
- Real-time subscriptions to these tables

## Step 6: Start Services

```bash
# Start backend API
cd /opt/dashboard_complete_package/backend
pm2 start dashboard_api.js --name dashboard-api

# Build and start frontend
cd /opt/dashboard_complete_package/frontend
npm run build
pm2 start npm --name dashboard -- start

# Save PM2 configuration
pm2 save
```

## Step 7: Configure Systemd (Optional)

Create systemd services for auto-start:

```bash
# Backend API service
cat > /etc/systemd/system/dashboard-api.service << 'EOF'
[Unit]
Description=Dashboard Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dashboard_complete_package/backend
ExecStart=/usr/bin/node dashboard_api.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
cat > /etc/systemd/system/dashboard-frontend.service << 'EOF'
[Unit]
Description=Dashboard Frontend
After=network.target dashboard-api.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dashboard_complete_package/frontend
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable dashboard-api dashboard-frontend
systemctl start dashboard-api dashboard-frontend
```

## Step 8: Access Dashboard

Open in browser: `http://107.191.61.107:8080`

## Troubleshooting

1. **Backend API not working**: Check if port 3001 is accessible
2. **Bot control not working**: Ensure backend API has sudo permissions for systemctl
3. **Data not showing**: Verify Supabase connection and table names
4. **Port 8080 not accessible**: Check firewall rules

## Next Steps

I'll create a script to help automate the file copying and modifications.
