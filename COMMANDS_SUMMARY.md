# COMMANDS SUMMARY - Quick Reference

## 🚀 DEPLOYMENT COMMANDS

### MAC TERMINAL (Copy File to VPS)

```bash
cd /Users/tadii/dashboard_complete_package
scp backend/dashboard_api.js root@107.191.61.107:/opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**What you'll see:**
- Password prompt → Enter VPS password
- File transfer progress
- `dashboard_api.js 100% [SIZE] [SPEED] [TIME]`

---

### VPS SSH (Verify File Copied)

```bash
ls -lh /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**Expected:**
```
-rw-r--r-- 1 root root [SIZE] [DATE] dashboard_api.js
```

---

### VPS SSH (Backup Old File)

```bash
cd /opt/latency_scalper_dashboard/backend
cp dashboard_api.js dashboard_api.js.old_backup_$(date +%Y%m%d_%H%M%S)
```

---

### VPS SSH (Restart API)

```bash
pm2 restart dashboard-api
```

**Expected:**
```
[PM2] [dashboard-api](0) ✓
```

---

### VPS SSH (Check Logs - Verify New Code)

```bash
pm2 logs dashboard-api --lines 30 --no-pager | grep -i "Fetching active exchanges\|Found balance column\|exchange_connections has no balance"
```

**Expected (NEW CODE):**
```
[API] Fetching active exchanges from exchange_connections...
[API] Found balance column in exchange_connections: [COLUMN]
```
OR
```
[API] exchange_connections has no balance columns, falling back to balance_history...
```

**If you see (OLD CODE - WRONG):**
```
[API] Step 1: Querying exchange_connections with select(*)...
```
→ File didn't copy correctly, repeat copy command

---

### VPS SSH (Test Health Endpoint)

```bash
curl http://localhost:3001/api/health
```

**Expected:**
```json
{"status":"ok","timestamp":"...","supabase":"connected"}
```

---

### VPS SSH (Test System Status)

```bash
curl http://localhost:3001/api/system/status | jq '.exchanges.list[] | {name: .name, balance: .balance}'
```

**Expected:**
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

---

## 🔍 VERIFICATION COMMANDS

### Check File Has New Code (No Old Markers)

```bash
# On VPS
grep -n "Step 1" /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**Expected:** (empty - no matches)

### Check File Size

```bash
# On VPS
wc -l /opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**Expected:** ~371 lines

### Check PM2 Status

```bash
pm2 status
```

**Expected:** `dashboard-api` shows `online`

### Check Full Logs

```bash
pm2 logs dashboard-api --lines 50 --no-pager
```

**Expected:** Should show startup messages and API requests

---

## 📋 COMPLETE DEPLOYMENT SEQUENCE

**Copy-paste this entire sequence:**

### On Mac:
```bash
cd /Users/tadii/dashboard_complete_package
scp backend/dashboard_api.js root@107.191.61.107:/opt/latency_scalper_dashboard/backend/dashboard_api.js
```

### On VPS (SSH):
```bash
# 1. Verify file
ls -lh /opt/latency_scalper_dashboard/backend/dashboard_api.js

# 2. Backup old
cd /opt/latency_scalper_dashboard/backend
cp dashboard_api.js dashboard_api.js.old_backup_$(date +%Y%m%d_%H%M%S)

# 3. Restart API
pm2 restart dashboard-api

# 4. Check logs
pm2 logs dashboard-api --lines 30 --no-pager | tail -20

# 5. Test health
curl http://localhost:3001/api/health

# 6. Test system status
curl http://localhost:3001/api/system/status | jq '.exchanges.list'
```

---

## ✅ SUCCESS CHECKLIST

After running all commands, verify:

- [ ] File copied successfully (no errors)
- [ ] File size matches (~371 lines)
- [ ] PM2 shows `online` status
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] System status returns exchange data
- [ ] Logs show "Fetching active exchanges..." (new code)
- [ ] No "Step 1" in logs (old code marker)

---

## 🆘 TROUBLESHOOTING

### File Copy Fails
```bash
# Test SSH connection
ssh root@107.191.61.107 "echo 'Connection OK'"
```

### PM2 Restart Fails
```bash
# Check PM2 status
pm2 describe dashboard-api

# Try stop/start
pm2 stop dashboard-api
pm2 start dashboard-api
```

### API Returns Errors
```bash
# Check error logs
pm2 logs dashboard-api --err --lines 50

# Check if port in use
netstat -tulpn | grep 3001
```

---

**END OF COMMANDS SUMMARY**
