#!/bin/bash
# Balance Source Diagnostic Script
# Run this on VPS to check where balances are stored

echo "=========================================="
echo "BALANCE DATA SOURCE DIAGNOSTIC"
echo "=========================================="
echo ""

# Check if we can query Supabase (need to be in a script that has access)
echo "1. Checking balance_history (latest snapshot)..."
echo "Run this SQL in Supabase dashboard:"
echo "SELECT snapshot_time, exchange_breakdown, total_balance"
echo "FROM balance_history"
echo "ORDER BY snapshot_time DESC"
echo "LIMIT 1;"
echo ""

echo "2. Checking exchange_connections (current balances)..."
echo "Run this SQL in Supabase dashboard:"
echo "SELECT exchange_name, balance_usdt, balance, usdt_balance, total_balance, is_active"
echo "FROM exchange_connections"
echo "WHERE is_active = true;"
echo ""

echo "3. Check what columns exist in exchange_connections:"
echo "Run this SQL in Supabase dashboard:"
echo "SELECT column_name, data_type"
echo "FROM information_schema.columns"
echo "WHERE table_name = 'exchange_connections';"
echo ""

echo "=========================================="
echo "EXPECTED BALANCES (from user):"
echo "  Binance: \$509.92 USDT"
echo "  OKX: \$1,525.22 USDT"
echo "=========================================="
