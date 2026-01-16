# Check Balance Sources - Diagnostic Commands

## Problem
- Binance shows balance: 1340.53885086 (WRONG - should be 0)
- OKX shows balance: 1516.4975998837049 (need to verify if correct)
- balance_history snapshot is 3 days old (stale data)

## Diagnostic Commands to Run on VPS

### 1. Check balance_history snapshot time
```bash
# Connect to Supabase and check latest snapshot
# Or check via API logs
pm2 logs dashboard-api --lines 100 --raw | grep -i "Balance snapshot time"
```

### 2. Check if exchange_connections has any balance-related columns
```bash
# We need to query Supabase directly or check the bot code
# The bot might be storing balances somewhere else
```

### 3. Check bot code for where it stores balances
```bash
# Check scalper.py for balance storage logic
grep -r "balance" /opt/latency_scalper/scalper.py | head -20
```

### 4. Check if bot writes balances to a different table
```bash
# Check all Supabase tables that might have balances
# We need to query: exchange_connections, balance_history, and any other tables
```

## Solution Options

### Option 1: Query Exchanges Directly (Real-time)
- Use exchange API to get current balances
- Most accurate but requires API keys

### Option 2: Find Where Bot Stores Current Balances
- Check if bot writes to a different table
- Check if bot updates exchange_connections with balances

### Option 3: Force Bot to Create New balance_history Snapshot
- Bot should be writing new snapshots regularly
- Check why it stopped 3 days ago
