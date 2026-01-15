# Update Backend API on VPS - Step by Step

## Problem Identified
- API is using OLD code (shows "[API] Step 1: Querying..." in logs)
- balance_history snapshot is 3 days old (2026-01-12)
- exchange_connections has no balance columns
- Need to deploy new code that checks exchange_connections first

## Solution: Deploy Updated Code

### Option 1: Copy File from Mac to VPS

**WHERE:** Mac Terminal

**COMMAND:**
```bash
scp /Users/tadii/dashboard_complete_package/backend/dashboard_api.js root@107.191.61.107:/opt/latency_scalper_dashboard/backend/dashboard_api.js
```

**EXPECTED OUTPUT:**
- File transfer progress
- "dashboard_api.js" should appear in the output

---

### Option 2: Manual Update on VPS

**WHERE:** SSH/VPS

**STEP 1: Backup current file**
```bash
cd /opt/latency_scalper_dashboard/backend
cp dashboard_api.js dashboard_api.js.backup
```

**STEP 2: Edit the file**
```bash
nano dashboard_api.js
```

**STEP 3: Find and replace the balance fetching section**
Look for line ~137 that says:
```javascript
// 2. SSOT for balances: balance_history table (latest snapshot)
```

Replace the entire section from line 137 to ~209 with the new code (see updated file).

**OR** just copy the entire new file from your Mac.

---

### Step 3: Restart API

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 restart dashboard-api
```

**EXPECTED OUTPUT:**
```
[PM2] Applying action restartProcessId on app [dashboard-api]
[PM2] [dashboard-api] Restarting
[PM2] [dashboard-api] Restarted
```

---

### Step 4: Verify New Code is Running

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 logs dashboard-api --lines 30 | grep -i "balance\|exchange_connections"
```

**EXPECTED OUTPUT (NEW CODE):**
- `[API] Fetching active exchanges with all columns...`
- `[API] Found balance column in exchange_connections: balance_usdt` (if exists)
- `[API] Using balances from exchange_connections (CURRENT DATA)` (if found)
- OR `[API] exchange_connections has no balance columns, falling back to balance_history...` (if not found)

**OLD CODE OUTPUT (WRONG):**
- `[API] Step 1: Querying exchange_connections with select(*)...`
- `[API] DISCOVERED COLUMNS:`

If you see "Step 1" or "DISCOVERED COLUMNS", the old code is still running.

---

### Step 5: Test API

**WHERE:** SSH/VPS

**COMMAND:**
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

---

## If Balances Are Still Wrong

The issue is that:
1. `exchange_connections` has no balance columns → API falls back to `balance_history`
2. `balance_history` snapshot is 3 days old (2026-01-12)

**Solutions:**
1. **Force bot to create new balance snapshot** - Bot should write to `balance_history` regularly
2. **Check if bot writes balances elsewhere** - Maybe a different table
3. **Query exchanges directly** - If bot has API access, query real-time balances

**Check when bot last wrote balance snapshot:**
```sql
SELECT snapshot_time, total_balance
FROM balance_history
ORDER BY snapshot_time DESC
LIMIT 5;
```

If the latest is from 3 days ago, the bot isn't writing new snapshots. Check bot logs:
```bash
journalctl -u scalper.service | grep -i "balance\|snapshot"
```
