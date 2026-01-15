# Balance Fix Verification Steps

## Issue Identified
- **Expected:** Binance $509.92, OKX $1,525.22
- **Showing:** Binance $1,340.54, OKX $1,516.50
- **Root Cause:** API using stale data from `balance_history` table

## Fix Applied
1. ✅ Backend now checks `exchange_connections` FIRST for current balances
2. ✅ Falls back to `balance_history` only if `exchange_connections` has no balance columns
3. ✅ Improved exchange name matching (handles case variations)
4. ✅ Better logging to show which source is being used

## Verification Steps

### Step 1: Restart Backend API
**WHERE:** SSH/VPS

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

### Step 2: Check API Logs
**WHERE:** SSH/VPS

```bash
pm2 logs dashboard-api --lines 30
```

**EXPECTED OUTPUT:**
Look for these log messages:
- `[API] Found balance column in exchange_connections: balance_usdt` (or similar)
- `[API] Using balances from exchange_connections (CURRENT DATA)`
- OR `[API] exchange_connections has no balance columns, falling back to balance_history...`

**WHAT THIS TELLS YOU:**
- If you see "exchange_connections" → API is using current balances ✅
- If you see "balance_history" → API is using snapshot (might be stale) ⚠️

Press `Ctrl+C` to exit logs.

---

### Step 3: Test System Status Endpoint
**WHERE:** SSH/VPS

```bash
curl http://localhost:3001/api/system/status | jq '.exchanges.list'
```

**EXPECTED OUTPUT:**
```json
[
  {
    "name": "binance",
    "balance": 509.92,
    "latency": 7
  },
  {
    "name": "okx",
    "balance": 1525.22,
    "latency": 58
  }
]
```

**IF BALANCES ARE STILL WRONG:**
- Check which balance source is being used (from Step 2 logs)
- If using `balance_history`, the snapshot is stale
- If using `exchange_connections`, check if the balance column has correct data

---

### Step 4: Check What Balance Data Exists
**WHERE:** Supabase Dashboard (or via SQL)

Run these SQL queries in Supabase:

**Query 1: Check exchange_connections balances**
```sql
SELECT exchange_name, balance_usdt, balance, usdt_balance, total_balance, is_active
FROM exchange_connections
WHERE is_active = true;
```

**Query 2: Check balance_history (latest)**
```sql
SELECT snapshot_time, exchange_breakdown, total_balance
FROM balance_history
ORDER BY snapshot_time DESC
LIMIT 1;
```

**WHAT TO LOOK FOR:**
- If `exchange_connections` has balance columns with correct values → API should use them ✅
- If `exchange_connections` has no balance columns → API falls back to `balance_history` ⚠️
- If `balance_history` has stale data → Need to update snapshot or use different source

---

### Step 5: Verify Dashboard Shows Correct Balances
**WHERE:** Mac (Browser)

1. Open: `http://107.191.61.107:8080`
2. Check the dashboard balances
3. Should show:
   - Binance: $509.92
   - OKX: $1,525.22
   - Total: ~$2,035

**IF STILL WRONG:**
- Check browser console (F12) for errors
- Check Network tab - verify API response has correct balances
- Check if frontend is caching old data (hard refresh: Ctrl+Shift+R)

---

## Troubleshooting

### If exchange_connections has no balance columns:
The bot needs to write current balances to `exchange_connections` table. Check bot logs:
```bash
journalctl -u scalper.service -n 50 --no-pager | grep -i balance
```

### If balance_history has stale data:
The bot's balance snapshot is old. The bot should write fresh snapshots regularly. Check:
```bash
# In Supabase, check when last snapshot was created
SELECT snapshot_time, total_balance
FROM balance_history
ORDER BY snapshot_time DESC
LIMIT 5;
```

### If balances are still wrong after fix:
1. Check API logs to see which source is being used
2. Verify the balance column names match what the API is looking for
3. Check exchange name matching (case sensitivity issues)
