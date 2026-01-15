# FRESH DEPLOYMENT GUIDE
## Complete Step-by-Step Instructions

This guide provides **exact commands** to run on both **Mac** and **VPS** to deploy the clean, fresh backend API.

---

## PRE-DEPLOYMENT CHECKLIST

### On Mac (Local Machine)

**1. Verify you're in the correct directory:**
```bash
cd /Users/tadii/dashboard_complete_package
pwd
```

**EXPECTED OUTPUT:**
```
/Users/tadii/dashboard_complete_package
```

**2. Verify the backend file exists:**
```bash
ls -lh backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
```
-rw-r--r--  1 tadii  staff  [SIZE] [DATE] backend/dashboard_api.js
```

**3. Check file size (should be ~8-10KB):**
```bash
wc -l backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
```
      [~300-400] lines
```

---

## STEP 1: COPY FILE TO VPS (Mac Terminal)

**WHERE:** Mac Terminal (new terminal window)

**COMMAND:**
```bash
cd /Users/tadii/dashboard_complete_package
scp backend/dashboard_api.js root@107.191.61.107:/opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**WHAT YOU'LL SEE:**
- Password prompt: `root@107.191.61.107's password:`
- Enter your VPS password
- File transfer progress: `dashboard_api.js 100% [SIZE] [SPEED] [TIME]`

**EXPECTED OUTPUT:**
```
dashboard_api.js                                   100%  [SIZE]  [SPEED]  [TIME]
```

**IF YOU SEE ERRORS:**
- `Permission denied` → Check password or SSH key
- `No such file or directory` → VPS path doesn't exist, create it first
- `Connection refused` → VPS is down or IP is wrong

---

## STEP 2: VERIFY FILE ON VPS (SSH/VPS)

**WHERE:** SSH session to VPS (keep your existing SSH session open)

**COMMAND:**
```bash
ls -lh /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
```
-rw-r--r-- 1 root root [SIZE] [DATE] /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**VERIFY FILE SIZE MATCHES:**
```bash
wc -l /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
```
      [~300-400] lines
```

**VERIFY FILE CONTENT (check first few lines):**
```bash
head -20 /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
```
#!/usr/bin/env node
// Backend API for dashboard bot control
// This service handles systemd commands for bot start/stop
// Run on VPS with: node dashboard_api.js

import express from 'express';
import { exec } from 'child_process';
import cors from 'cors';
...
```

**VERIFY NO OLD CODE (check for "Step 1" which was in old code):**
```bash
grep -n "Step 1" /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
```
(empty - no matches)
```

**IF YOU SEE MATCHES:**
- Old code is still there → File didn't copy correctly, repeat Step 1

---

## STEP 3: BACKUP OLD FILE (SSH/VPS)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
cd /opt/latency_scalper_dashboard/backend
cp dashboard_api.js dashboard_api.js.old_backup_$(date +%Y%m%d_%H%M%S)
ls -lh dashboard_api.js*
```

**EXPECTED OUTPUT:**
```
-rw-r--r-- 1 root root [SIZE] [DATE] dashboard_api.js
-rw-r--r-- 1 root root [SIZE] [DATE] dashboard_api.js.old_backup_[TIMESTAMP]
```

---

## STEP 4: RESTART API (SSH/VPS)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 restart dashboard-api
```

**EXPECTED OUTPUT:**
```
[PM2] Applying action restartProcessId on app [dashboard-api](ids: [ 0 ])
[PM2] [dashboard-api](0) ✓
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ dashboard-api      │ fork     │ [N]  │ online    │ 0%       │ [SIZE]mb │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

**CHECK STATUS:**
```bash
pm2 status
```

**EXPECTED OUTPUT:**
- `dashboard-api` should show `online` status
- Restart count (`↺`) should increment

---

## STEP 5: VERIFY NEW CODE IS RUNNING (SSH/VPS)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 logs dashboard-api --lines 30 --no-pager | grep -i "Fetching active exchanges\|Found balance column\|exchange_connections has no balance"
```

**EXPECTED OUTPUT (NEW CODE - CORRECT):**
```
[API] Fetching active exchanges from exchange_connections...
[API] Found balance column in exchange_connections: [COLUMN_NAME]
```
OR
```
[API] exchange_connections has no balance columns, falling back to balance_history...
```

**IF YOU SEE (OLD CODE - WRONG):**
```
[API] Step 1: Querying exchange_connections with select(*)...
[API] DISCOVERED COLUMNS:
```
→ **Old code is still running** → Check if file was copied correctly, restart PM2 again

**CHECK STARTUP LOGS:**
```bash
pm2 logs dashboard-api --lines 10 --no-pager
```

**EXPECTED OUTPUT:**
```
[API] Dashboard API server running on port 3001
[API] Supabase: configured
[API] Listening on: http://0.0.0.0:3001
```

---

## STEP 6: TEST API ENDPOINTS (SSH/VPS)

**WHERE:** SSH/VPS

**TEST 1: Health Check**
```bash
curl http://localhost:3001/api/health
```

**EXPECTED OUTPUT:**
```json
{"status":"ok","timestamp":"2026-01-15T...","supabase":"connected"}
```

**TEST 2: System Status**
```bash
curl http://localhost:3001/api/system/status | jq '.exchanges.list[] | {name: .name, balance: .balance}'
```

**EXPECTED OUTPUT:**
```json
{
  "name": "binance",
  "balance": 509.92
}
{
  "name": "okx",
  "balance": 1525.22
}
```

**TEST 3: Full System Status**
```bash
curl http://localhost:3001/api/system/status | jq '{bot: .bot, exchanges: .exchanges.connected, totalBalance: [.exchanges.list[].balance] | add}'
```

**EXPECTED OUTPUT:**
```json
{
  "bot": {
    "running": true,
    "status": "running"
  },
  "exchanges": 2,
  "totalBalance": 2035.14
}
```

---

## STEP 7: VERIFY LOGS SHOW CORRECT BEHAVIOR (SSH/VPS)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 logs dashboard-api --lines 50 --no-pager | tail -30
```

**EXPECTED OUTPUT (NEW CODE):**
```
[API] ========================================
[API] Fetching system status - FRESH DATA ONLY
[API] Timestamp: 2026-01-15T...
[API] ========================================
[API] Bot status: running
[API] Fetching active exchanges from exchange_connections...
[API] Active exchanges found: 2
[API] Found balance column in exchange_connections: [COLUMN]
[API] Balance from exchange_connections: binance = 509.92
[API] Balance from exchange_connections: okx = 1525.22
[API] Using balances from exchange_connections (CURRENT DATA)
[API] Fetching latency data...
[API] Response summary: { ... }
[API] ========================================
```

**OR (if exchange_connections has no balance columns):**
```
[API] exchange_connections has no balance columns, falling back to balance_history...
[API] Balance snapshot time: 2026-01-15T...
[API] Balance from balance_history: binance = 509.92
[API] Balance from balance_history: okx = 1525.22
[API] Balances loaded from balance_history: [ ... ]
```

---

## VERIFICATION CHECKLIST

After deployment, verify:

- [ ] File copied to VPS successfully
- [ ] File size matches local file
- [ ] No "Step 1" or "DISCOVERED COLUMNS" in logs (old code markers)
- [ ] PM2 shows API as `online`
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] System status endpoint returns exchange balances
- [ ] Logs show "Fetching active exchanges from exchange_connections..."
- [ ] Logs show either "Found balance column" OR "falling back to balance_history"

---

## TROUBLESHOOTING

### Issue: File copy fails
**Solution:**
```bash
# Check SSH connection
ssh root@107.191.61.107 "echo 'Connection OK'"

# Check if directory exists
ssh root@107.191.61.107 "ls -ld /opt/latency_scalper_dashboard/backend"
```

### Issue: PM2 restart fails
**Solution:**
```bash
# Check PM2 status
pm2 status

# Check if process exists
pm2 describe dashboard-api

# Try stop then start
pm2 stop dashboard-api
pm2 start dashboard-api
```

### Issue: API returns errors
**Solution:**
```bash
# Check full error logs
pm2 logs dashboard-api --err --lines 50

# Check if port is in use
netstat -tulpn | grep 3001

# Test Supabase connection
curl http://localhost:3001/api/health
```

### Issue: Old code still running
**Solution:**
```bash
# Force reload PM2
pm2 reload dashboard-api

# Or stop and start
pm2 stop dashboard-api
pm2 start dashboard-api

# Verify file was updated
ls -lh /opt/latency_scalper_dashboard/backend/dashboard_api.js
head -20 /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

---

## ROLLBACK (If Needed)

If something goes wrong, rollback to old file:

```bash
# On VPS
cd /opt/latency_scalper_dashboard/backend
cp dashboard_api.js.old_backup_* dashboard_api.js
pm2 restart dashboard-api
```

---

## SUCCESS CRITERIA

✅ Deployment is successful when:
1. File copied to VPS
2. PM2 restarted successfully
3. Health endpoint returns OK
4. System status shows correct balances
5. Logs show new code markers (no "Step 1")
6. No errors in PM2 logs

---

**END OF DEPLOYMENT GUIDE**
