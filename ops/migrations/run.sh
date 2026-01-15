#!/bin/bash
# Supabase Migration Generator Runner

cd /opt/latency_scalper_dashboard/ops/migrations || exit 1

# Try to read Supabase credentials from bot's .env
if [ -f "/opt/latency_scalper/.env" ]; then
  export SUPABASE_URL=$(grep "^SUPABASE_URL=" /opt/latency_scalper/.env | cut -d'=' -f2)
  export SUPABASE_ANON_KEY=$(grep "^SUPABASE_ANON_KEY=" /opt/latency_scalper/.env | cut -d'=' -f2)
fi

# Run migration generator
node generateMigration.js
