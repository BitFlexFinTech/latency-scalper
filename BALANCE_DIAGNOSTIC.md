# Balance Diagnostic Commands

Run these on VPS to check balance data sources:

## Check balance_history (what API is currently using)
```sql
SELECT snapshot_time, exchange_breakdown, total_balance 
FROM balance_history 
ORDER BY snapshot_time DESC 
LIMIT 1;
```

## Check exchange_connections (might have current balances)
```sql
SELECT exchange_name, balance_usdt, balance, usdt_balance, total_balance, is_active, is_connected
FROM exchange_connections 
WHERE is_active = true;
```

## Check what columns exist in exchange_connections
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'exchange_connections';
```
