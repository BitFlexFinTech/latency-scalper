# Supabase Migration Generator

This tool compares your live Supabase schema to the required schema and generates SQL migration files automatically.

## Usage

1. Ensure Supabase credentials are available:
   - In `/opt/latency_scalper/.env` (SUPABASE_URL and SUPABASE_ANON_KEY)
   - Or set as environment variables

2. Run:
   ```bash
   cd /opt/latency_scalper_dashboard
   bash ops/migrations/run.sh
   ```

3. SQL files will appear in:
   ```
   /opt/latency_scalper_dashboard/ops/migrations/output/
   ```

4. Apply migrations:
   - Open Supabase SQL Editor
   - Copy and paste the generated SQL
   - Execute

## What it checks

- Missing tables
- Missing columns
- Required schema defined in `requiredSchema.json`

## Required Tables

- `latency_logs` - Latency measurements (venue, ts, latency_ms)
- `trade_logs` - Trade history (symbol, exchange, entry/exit prices, etc.)
- `exchange_connections` - Exchange status (exchange_name, is_connected, balance, etc.)
- `bot_status` - Bot heartbeat (is_running, last_heartbeat)

## Why this matters

Latency-Scalper deployments must have consistent schemas across all VPS instances. This tool ensures reproducibility and auditability.
