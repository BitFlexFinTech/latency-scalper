# Required Modifications Guide

After copying UI components from profit-accelerator, you need to make these modifications to connect to your new bot.

## 1. Data Table References

### Replace in ALL files:
- `trading_journal` → `trade_logs`
- `exchange_latency_history` → `latency_logs`
- Any other old table names → new bot's table names

### Files that likely need updates:
- All hooks in `src/hooks/`
- All panels in `src/components/dashboard/panels/`
- All tabs in `src/components/dashboard/tabs/`

## 2. Bot Control Modifications

### UnifiedControlBar.tsx
Replace Supabase edge function calls with backend API:

**Before:**
```typescript
const { data, error } = await supabase.functions.invoke('bot-lifecycle', {
  body: { action: 'start' }
});
```

**After:**
```typescript
import { startBot, stopBot, getBotStatus } from '@/services/botControlApi';

// Start bot
const result = await startBot();

// Stop bot
const result = await stopBot();

// Get status
const status = await getBotStatus();
```

### Bot Status Fetching
Replace bot status queries:

**Before:**
```typescript
const { data: botStatus } = await supabase
  .from('bot_status')
  .select('is_running, last_heartbeat')
```

**After:**
Keep Supabase queries for bot_status table (this is fine), but for actual control use the API:
```typescript
import { getBotStatus } from '@/services/botControlApi';
const status = await getBotStatus();
```

## 3. Data Hooks Modifications

### useTradesRealtime.ts
Already uses `trade_logs` - verify it's correct.

### Latency Hooks
Ensure all latency hooks use `latency_logs` table:
- Check `useVPSHealthPolling.ts`
- Check any latency-related hooks

## 4. Panel Modifications

### RecentTradesPanel
Should already use `trade_logs` - verify.

### LatencyHistoryChart
Update to use `latency_logs`:
- Change table name from `exchange_latency_history` to `latency_logs`
- Update column names if needed (check your schema)

### TradeActivityTerminal
Should already use `trade_logs` - verify.

## 5. Exchange References

Your bot uses:
- `binance` (lowercase)
- `okx` (lowercase)

Ensure all exchange references match these names.

## 6. Column Name Mappings

Check your Supabase schema and ensure column names match:

### trade_logs table:
- `symbol` (not `pair` or `instrument`)
- `venue` or `exchange` (verify which one your bot uses)
- `entry_px` or `entry_price` (verify)
- `exit_px` or `exit_price` (verify)
- `pnl` or `profit_usd` (verify)
- `ts` or `entry_time` (verify)

### latency_logs table:
- `venue` (binance, okx)
- `latency_ms`
- `ts` (timestamp)

## 7. Real-time Subscriptions

Ensure all Supabase subscriptions use:
- Table: `trade_logs` for trades
- Table: `latency_logs` for latency

## 8. Backend API Configuration

The backend API runs on port 3001. If you need to change this:
1. Update `backend/dashboard_api.js` port
2. Update `frontend/src/services/botControlApi.ts` API_BASE_URL

## Quick Check Script

Run this to find files that might need updates:
```bash
cd frontend/src
grep -r "trading_journal\|exchange_latency_history" . --include="*.ts" --include="*.tsx"
grep -r "bot-lifecycle\|hft-deployments" . --include="*.ts" --include="*.tsx"
```

## Testing Checklist

After modifications:
- [ ] Bot start/stop buttons work
- [ ] Trades display from trade_logs
- [ ] Latency data displays from latency_logs
- [ ] Real-time updates work
- [ ] All charts show data
- [ ] All tables populate
- [ ] Navigation works
- [ ] All tabs load
