#!/bin/bash
# Script to apply modifications to copied UI components
# This updates data table references and bot control

set -e

FRONTEND_DIR="/Users/tadii/dashboard_complete_package/frontend/src"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Error: Frontend directory not found. Run copy_and_modify_ui.sh first."
    exit 1
fi

echo "Applying modifications to UI components..."

# Find and replace data table references
echo "Updating data table references..."

# Replace trading_journal with trade_logs
find "$FRONTEND_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak 's/trading_journal/trade_logs/g' {} \;

# Replace exchange_latency_history with latency_logs
find "$FRONTEND_DIR" -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak 's/exchange_latency_history/latency_logs/g' {} \;

# Clean up backup files
find "$FRONTEND_DIR" -name "*.bak" -delete

echo ""
echo "Modifications applied!"
echo ""
echo "IMPORTANT: You still need to manually:"
echo "1. Update UnifiedControlBar to use botControlApi instead of edge functions"
echo "2. Verify all data hooks use correct table names"
echo "3. Check that all real-time subscriptions use correct tables"
echo ""
echo "See MODIFICATIONS_NEEDED.md for detailed instructions"
