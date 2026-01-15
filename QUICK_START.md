# Quick Start Guide

## What You Have

A complete dashboard package that replicates the profit-accelerator UI but connects to your new bot's data.

## What's Included

✅ Project structure with all dependencies  
✅ Backend API for bot control (systemd)  
✅ Supabase client (already configured)  
✅ Bot control API service  
✅ Setup scripts  
✅ Modification guides  

## What You Need to Do

### Step 1: Copy UI Components (Local Machine)

```bash
cd /Users/tadii/dashboard_complete_package
bash scripts/copy_and_modify_ui.sh
bash scripts/apply_modifications.sh
```

### Step 2: Manual Modifications

Review `MODIFICATIONS_NEEDED.md` and update:
- UnifiedControlBar to use botControlApi
- Verify all data hooks use correct tables
- Check column name mappings

### Step 3: Transfer to VPS

```bash
cd /Users/tadii
tar -czf dashboard_complete_package.tar.gz dashboard_complete_package/
scp dashboard_complete_package.tar.gz root@107.191.61.107:/tmp/
```

### Step 4: Setup on VPS

```bash
ssh root@107.191.61.107
cd /opt
tar -xzf /tmp/dashboard_complete_package.tar.gz
cd dashboard_complete_package
bash scripts/setup_on_vps.sh
```

### Step 5: Install Dependencies

```bash
# Backend
cd /opt/dashboard_complete_package/backend
npm install

# Frontend
cd /opt/dashboard_complete_package/frontend
npm install
```

### Step 6: Start Services

```bash
# Start backend API
cd /opt/dashboard_complete_package/backend
pm2 start dashboard_api.js --name dashboard-api

# Build and start frontend
cd /opt/dashboard_complete_package/frontend
npm run build
pm2 start npm --name dashboard -- start

pm2 save
```

### Step 7: Access Dashboard

Open: `http://107.191.61.107:8080`

## Important Notes

1. **Backend API** must run on port 3001 (for bot control)
2. **Frontend** runs on port 8080
3. **Bot control** requires sudo permissions for systemctl
4. **Data tables**: All components use `trade_logs` and `latency_logs`

## Troubleshooting

- **Port 8080 not accessible**: Check firewall: `ufw allow 8080`
- **Bot control not working**: Check backend API is running: `pm2 list`
- **No data showing**: Verify Supabase connection and table names

## Full Documentation

See `COMPLETE_SETUP_GUIDE.md` for detailed instructions.
