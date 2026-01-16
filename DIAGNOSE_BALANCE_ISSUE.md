# Diagnose Balance Issue - Step by Step

## Current Problem
- **Binance balance:** 1340.53885086 (WRONG - should be 0, no USDT on Binance)
- **OKX balance:** 1516.4975998837049 (need to verify if correct)
- **Root cause:** `balance_history` snapshot is 3 days old (stale data)

## The Real Issue

The code is working correctly:
1. ✅ Checks `exchange_connections` for balance columns (none found)
2. ✅ Falls back to `balance_history` (correct behavior)
3. ❌ But `balance_history` has OLD data (3 days old)

## Solution: Find Where Current Balances Are Stored

We need to find where the bot stores CURRENT balances. Options:

### Option 1: Check if Bot Updates exchange_connections with Balances

**On VPS, run:**
```bash
# Check what columns exist in exchange_connections
# We need to query Supabase directly or check the bot code
```

### Option 2: Query Exchanges Directly (Real-time)

We can add code to query exchange APIs directly for current balances, but this requires:
- API keys from bot's .env
- Exchange API client setup
- More complex implementation

### Option 3: Check Bot Code for Balance Storage

**On VPS, run:**
```bash
# Check where bot stores balances
grep -r "balance" /opt/latency_scalper/scalper.py | grep -i "supabase\|insert\|update" | head -20

# Check if bot writes to exchange_connections
grep -r "exchange_connections" /opt/latency_scalper/scalper.py | head -20
```

### Option 4: Force Bot to Create New Snapshot

**On VPS, check bot logs:**
```bash
journalctl -u scalper.service | grep -i "balance\|snapshot" | tail -20
```

## Immediate Fix: Add Stale Data Warning

I've updated the code to:
1. Check snapshot age
2. Warn if snapshot is > 1 hour old
3. Log the age so we can see the problem

## Next Steps

1. **Deploy updated code** (with stale data warning)
2. **Check bot code** to see where it stores balances
3. **Either:**
   - Fix bot to write balances to `exchange_connections`
   - OR query exchanges directly
   - OR fix bot to create fresh `balance_history` snapshots

## Commands to Run

### Check Bot Balance Storage Logic:
```bash
# On VPS
grep -r "balance_history\|exchange_connections" /opt/latency_scalper/scalper.py | head -30
```

### Check Latest Snapshot Time:
```bash
# The logs should now show snapshot age
pm2 logs dashboard-api --lines 50 --raw | grep -i "snapshot age\|Balance snapshot time"
```

### Check if Bot Writes to exchange_connections:
```bash
# On VPS
grep -r "\.from('exchange_connections')\|\.update('exchange_connections')\|\.insert('exchange_connections')" /opt/latency_scalper/scalper.py
```
