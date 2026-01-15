# 🔥 LATENCY SCALPER - COMPLETE FIX INSTRUCTIONS FOR CURSOR

⚠️ **CRITICAL: READ THIS FIRST**

This document contains the COMPLETE, PERMANENT FIX for all data syncing issues in the Latency Scalper dashboard. Follow these instructions EXACTLY to eliminate all mock data, stale data, and ensure real-time sync across all components.

## 📋 OVERVIEW OF FIXES

### Problems Identified:
1. ❌ Multiple components fetching data independently (no SSOT)
2. ❌ Duplicate state management across components
3. ❌ No centralized data store
4. ❌ Inconsistent polling intervals
5. ❌ Backend API complexity with fallback strategies
6. ❌ Missing API configuration file
7. ❌ No proper cache-busting
8. ❌ Incomplete error handling

### Solutions Implemented:
1. ✅ Single Source of Truth (SSOT) - Zustand global store
2. ✅ Centralized API configuration
3. ✅ Simplified backend API logic
4. ✅ Consistent data fetching patterns
5. ✅ Proper cache-busting at all levels
6. ✅ Real-time subscriptions for trades
7. ✅ Unified system status hook
8. ✅ Complete type safety

## 🚀 STEP 1: CREATE NEW FILES

Copy these files EXACTLY as provided in the artifacts. Do not modify.

### 1.1 Frontend Configuration
**`frontend/src/config/api.ts`**
✅ This is the SSOT for all API URLs and request configuration.

### 1.2 Global Store (Zustand)
**`frontend/src/store/useAppStore.ts`**
✅ This is the SSOT for all application state. All components read from here.

### 1.3 API Services
- **`frontend/src/services/systemStatusApi.ts`**
- **`frontend/src/services/botControlApi.ts`**
✅ These handle all backend API communication. Only called by the store.

### 1.4 Hooks
- **`frontend/src/hooks/useTradesRealtime.ts`**
- **`frontend/src/hooks/useSystemStatus.ts`**
✅ These provide convenient access to store data for components.

### 1.5 Supabase Client
**`frontend/src/integrations/supabase/client.ts`**
✅ Single Supabase client configuration.

## 🔧 STEP 2: REPLACE EXISTING FILES

Replace these files with the fixed versions provided:

### 2.1 Components
- **`frontend/src/components/dashboard/panels/CompactMetricsBar.tsx`**
- **`frontend/src/components/dashboard/DashboardLayout.tsx`**
✅ These now use the global store only. No independent API calls.

### 2.2 Backend API
**`backend/dashboard_api.js`**
✅ Simplified logic, removed complex fallback strategies, uses balance_history as SSOT.

## 🗑️ STEP 3: DELETE OLD/CONFLICTING FILES

**CRITICAL:** Remove these files if they exist. They contain mock/stale data:

```bash
# Delete any mock data files
rm -f frontend/src/lib/mockData.ts
rm -f frontend/src/lib/sampleData.ts
rm -f frontend/src/data/mockExchanges.ts
rm -f frontend/src/data/sampleBalances.ts

# Delete any old API service files that aren't in the new structure
# (Only if they exist and aren't part of new structure)
# rm -f frontend/src/services/exchangeApi.ts
# rm -f frontend/src/services/balanceApi.ts

# Delete duplicate store files if they exist
# rm -f frontend/src/store/exchangeStore.ts
# rm -f frontend/src/store/balanceStore.ts
# rm -f frontend/src/store/tradeStore.ts

# Only keep useAppStore.ts as the single store
```

## 📝 STEP 4: UPDATE ENVIRONMENT VARIABLES

### 4.1 Backend (VPS)
Create/update `/opt/latency_scalper/.env`:
```
SUPABASE_URL=https://iibdlazwkossyelyroap.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYmRsYXp3a29zc3llbHlyb2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzQzNDUsImV4cCI6MjA4MzIxMDM0NX0.xZ0VbkoKzrFLYpbKrUjcvTY-qs-n-A3ynHU-SAluOUQ4
```

### 4.2 Frontend
Create/update `frontend/.env`:
```
VITE_SUPABASE_URL=https://iibdlazwkossyelyroap.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYmRsYXp3a29zc3llbHlyb2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzQzNDUsImV4cCI6MjA4MzIxMDM0NX0.xZ0VbkoKzrFLYpbKrUjcvTY-qs-n-A3ynHU-SAluOUQ4
```

## 🔄 STEP 5: VERIFY API CONFIGURATION

### 5.1 Check VPS IP in `frontend/src/config/api.ts`
```typescript
const VPS_IP = '107.191.61.107'; // ← Verify this is YOUR VPS IP
```

### 5.2 Check Backend Port
```typescript
const BACKEND_PORT = 3001; // ← Should match dashboard_api.js PORT
```

## 🏗️ STEP 6: UPDATE ALL OTHER COMPONENTS

Any component that currently:
* Calls `fetch()` directly
* Uses `useState` for system data
* Calls Supabase directly for system status
* Has its own polling intervals

Should be updated to:
```typescript
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { useAppStore } from '@/store/useAppStore';

// In component:
const systemStatus = useSystemStatus();
const { totalEquity, dailyPnl } = useAppStore();

// Use systemStatus.botRunning, systemStatus.totalEquity, etc.
```

## 🧪 STEP 7: TESTING & VERIFICATION

### 7.1 Backend Verification
```bash
# SSH to VPS
ssh root@107.191.61.107

# Check bot status
sudo systemctl status scalper.service

# Restart backend API
cd /opt/latency_scalper_dashboard/backend
pm2 restart dashboard-api
pm2 logs dashboard-api

# Test API endpoint
curl http://localhost:3001/api/health
curl http://localhost:3001/api/system/status
```

**Expected output:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T...",
  "supabase": "connected"
}
```

### 7.2 Frontend Verification
```bash
# In frontend directory
npm run dev

# Open browser console (F12)
# Look for these logs:
# [Store] Started polling system status every 5000 ms
# [Store] System status updated: {...}
# [systemStatusApi] System status received: {...}
```

### 7.3 Data Flow Verification
1. Open dashboard at `http://107.191.61.107:8080`
2. Open browser DevTools → Network tab
3. Filter by "status"
4. You should see requests every 5 seconds to `/api/system/status`
5. Check response contains REAL data (not zeros)

### 7.4 Real-Time Verification
1. Execute a trade on an exchange
2. Within 3-5 seconds, dashboard should update
3. Check balance changes reflect immediately
4. Verify latency values are real (changing, not static)

## 🐛 STEP 8: DEBUGGING COMMON ISSUES

### Issue 1: "API offline" or "VPS offline"
**Cause:** Backend API not running or firewall blocking port 3001

**Fix:**
```bash
# Check if API is running
pm2 list

# Check if port is open
sudo netstat -tulpn | grep 3001

# Check firewall
sudo ufw status
sudo ufw allow 3001/tcp

# Restart API
pm2 restart dashboard-api
```

### Issue 2: Balance showing $0 but exchanges connected
**Cause:** `balance_history` table empty or no recent snapshot

**Fix:**
```sql
-- In Supabase SQL editor, check:
SELECT * FROM balance_history ORDER BY snapshot_time DESC LIMIT 1;

-- If empty, your bot needs to write balance snapshots
-- Check bot logs to ensure it's writing to balance_history
```

### Issue 3: Latency showing "null" or no data
**Cause:** `latency_logs` table empty

**Fix:**
```sql
-- Check latency logs:
SELECT * FROM latency_logs ORDER BY ts DESC LIMIT 10;

-- If empty, bot is not logging latency
-- Verify bot is running and pinging exchanges
```

### Issue 4: Trades showing 0
**Cause:** `trade_logs` table empty or no recent trades

**Fix:**
```sql
-- Check trade logs:
SELECT * FROM trade_logs ORDER BY entry_time DESC LIMIT 10;

-- If empty but bot is running, check bot's trade logging logic
```

### Issue 5: "CORS error" in browser console
**Cause:** Frontend origin not in backend CORS allowlist

**Fix:** In `backend/dashboard_api.js`:
```javascript
const corsOptions = {
  origin: [
    'http://107.191.61.107:8080',  // Your VPS
    'http://localhost:8080',       // Local dev
    'http://127.0.0.1:8080'        // Local dev
  ],
  // ... rest of config
};
```

## ✅ STEP 9: FINAL CHECKLIST

Before marking as complete, verify:

* [ ] All new files created in correct locations
* [ ] All old/conflicting files deleted
* [ ] Backend API restarted with new code
* [ ] Frontend rebuilt (`npm run build`)
* [ ] Environment variables set correctly
* [ ] API health check returns "ok"
* [ ] System status endpoint returns real data
* [ ] Dashboard loads without errors
* [ ] Balance displays correctly (not $0)
* [ ] Bot status shows correct state
* [ ] Latency values are real and updating
* [ ] Trade count shows real trades
* [ ] All tabs load without errors
* [ ] No console errors in browser
* [ ] Data updates within 5 seconds of backend changes

## 🎯 EXPECTED FINAL STATE

### Data Flow:
```
VPS/Exchanges → Supabase Tables → Backend API → Frontend Store → UI Components
```

### Key Principles:
1. **Single Source of Truth:** All data lives in `useAppStore`
2. **No Direct Fetching:** Components NEVER call APIs directly
3. **Centralized Polling:** Store handles all polling (5s intervals)
4. **Real-Time Subscriptions:** Trades use Supabase realtime
5. **Cache-Busting:** Every request has fresh timestamp
6. **Type Safety:** All interfaces match backend responses
7. **Error Handling:** Graceful fallbacks, never silent failures

### Performance:
* Initial load: < 2 seconds
* Data refresh: Every 5 seconds automatically
* Latency shown: Real values from exchanges (< 100ms typical)
* UI updates: Instant on data changes (React reactivity)

## 📞 SUPPORT

If issues persist after following this guide:

1. Check backend API logs: `pm2 logs dashboard-api`
2. Check browser console for errors (F12)
3. Verify Supabase tables have data
4. Confirm bot is actually running and logging data
5. Test API endpoints directly with `curl`

## 🔐 SECURITY NOTES

1. The Supabase keys shown are from your existing code
2. For production, move these to environment variables only
3. Never commit `.env` files to git
4. Consider using Supabase RLS policies for additional security

## 🚀 DEPLOYMENT

### Backend (VPS):
```bash
cd /opt/latency_scalper_dashboard/backend
npm install
pm2 start dashboard_api.js --name dashboard-api
pm2 save
pm2 startup
```

### Frontend (VPS):
```bash
cd /opt/latency_scalper_dashboard/frontend
npm install
npm run build
pm2 start npm --name dashboard-frontend -- start
pm2 save
```

## ✨ RESULT

After implementing all fixes:

* ✅ Dashboard shows ONLY real data from VPS, exchanges, Supabase
* ✅ No mock data anywhere
* ✅ All cards use single source of truth
* ✅ Real-time updates work correctly
* ✅ Balances accurate across all components
* ✅ Latency values are live and updating
* ✅ Trade counts reflect actual trades
* ✅ Bot status is accurate
* ✅ No stale data issues
* ✅ All tabs synchronized
* ✅ System is production-ready

**You now have a fully functional, real-time HFT dashboard with zero mock data.**
