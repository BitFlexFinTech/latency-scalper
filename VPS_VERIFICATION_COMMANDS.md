# VPS Verification Commands - Corrected

## ✅ Already Completed:
- [x] File copied (14K, timestamp Jan 16 19:02)
- [x] No old code markers (grep "Step 1" returned empty)
- [x] PM2 restarted successfully

---

## Step 1: Check Logs (CORRECTED - no --no-pager flag)

**COMMAND:**
```bash
pm2 logs dashboard-api --lines 30 | tail -30
```

**OR (to see only recent logs without pager):**
```bash
pm2 logs dashboard-api --lines 30 --raw | tail -30
```

**OR (to grep for specific text):**
```bash
pm2 logs dashboard-api --lines 50 | grep -i "Fetching active exchanges\|Found balance column\|exchange_connections has no balance"
```

**EXPECTED OUTPUT (NEW CODE):**
```
[API] Fetching active exchanges from exchange_connections...
[API] Active exchanges found: 2
[API] Found balance column in exchange_connections: [COLUMN]
```
OR
```
[API] exchange_connections has no balance columns, falling back to balance_history...
```

**IF YOU SEE (OLD CODE - WRONG):**
```
[API] Step 1: Querying exchange_connections with select(*)...
```
→ Old code still running (shouldn't happen since grep showed no matches)

---

## Step 2: Check Startup Logs

**COMMAND:**
```bash
pm2 logs dashboard-api --lines 10 --raw | tail -10
```

**EXPECTED OUTPUT:**
```
[API] Dashboard API server running on port 3001
[API] Supabase: configured
[API] Listening on: http://0.0.0.0:3001
```

---

## Step 3: Test Health Endpoint

**COMMAND:**
```bash
curl http://localhost:3001/api/health
```

**EXPECTED OUTPUT:**
```json
{"status":"ok","timestamp":"2026-01-16T...","supabase":"connected"}
```

---

## Step 4: Test System Status Endpoint

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

## Step 5: Check Full Response

**COMMAND:**
```bash
curl http://localhost:3001/api/system/status | jq '{bot: .bot, exchanges: .exchanges.connected, totalBalance: [.exchanges.list[].balance] | add, balanceSource: .balanceSource}'
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

## Step 6: Monitor Logs in Real-Time (Optional)

**COMMAND:**
```bash
pm2 logs dashboard-api
```

**Then make a request:**
```bash
# In another terminal
curl http://localhost:3001/api/system/status
```

**You should see in logs:**
```
[API] ========================================
[API] Fetching system status - FRESH DATA ONLY
[API] Timestamp: 2026-01-16T...
[API] ========================================
[API] Bot status: running
[API] Fetching active exchanges from exchange_connections...
[API] Active exchanges found: 2
...
```

---

## Quick Verification Checklist

Run these commands in sequence:

```bash
# 1. Check logs show new code
pm2 logs dashboard-api --lines 30 --raw | grep -i "Fetching active exchanges"

# 2. Test health
curl http://localhost:3001/api/health

# 3. Test system status
curl http://localhost:3001/api/system/status | jq '.exchanges.list'

# 4. Check PM2 status
pm2 status
```

**All should return expected results!**

---

**END OF VERIFICATION COMMANDS**
