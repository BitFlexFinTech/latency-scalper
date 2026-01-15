# 🚀 LATENCY SCALPER - QUICK REFERENCE

⚡ **ONE-PAGE DEVELOPER CHEAT SHEET**

## 🎯 THE GOLDEN RULES

1. **NEVER** fetch data in components → Always use `useAppStore` or `useSystemStatus`
2. **NEVER** use `useState` for system data → Store is the SSOT
3. **NEVER** call APIs directly → Let the store handle it
4. **NEVER** create polling intervals → Store polls automatically
5. **NEVER** use mock data → All data from backend API

## 📁 FILE LOCATIONS

```
backend/dashboard_api.js               ← Backend API (port 3001)
frontend/src/config/api.ts             ← API config (URLs, intervals)
frontend/src/store/useAppStore.ts      ← Global store (SSOT)
frontend/src/hooks/useSystemStatus.ts  ← Easy store access
frontend/src/services/systemStatusApi.ts ← API service (store only)
```

## 🔧 HOW TO USE IN COMPONENTS

### ❌ WRONG (Old Way)
```typescript
function MyComponent() {
  const [balance, setBalance] = useState(0);
  
  useEffect(() => {
    fetch('/api/balance')
      .then(res => res.json())
      .then(data => setBalance(data.balance));
  }, []);
  
  return <div>${balance}</div>;
}
```

### ✅ CORRECT (New Way)
```typescript
import { useSystemStatus } from '@/hooks/useSystemStatus';

function MyComponent() {
  const { totalEquity, loading } = useSystemStatus();
  
  if (loading) return <Skeleton />;
  
  return <div>${totalEquity}</div>;
}
```

## 📊 AVAILABLE DATA FROM `useSystemStatus()`

```typescript
const systemStatus = useSystemStatus();

// Bot
systemStatus.botRunning          // boolean
systemStatus.botStatus           // 'running' | 'stopped'

// Balances
systemStatus.totalEquity         // number (total across exchanges)
systemStatus.connectedExchanges  // number (count)
systemStatus.exchangesList       // Array<{name, balance, latency}>

// Performance
systemStatus.dailyPnl            // number
systemStatus.weeklyPnl           // number

// Latency
systemStatus.avgLatency          // number | null (ms)
systemStatus.latencySamples      // Array<{venue, ms, ts}>

// VPS
systemStatus.vps.ip              // string
systemStatus.vps.provider        // string
systemStatus.vps.online          // boolean
systemStatus.vps.latency         // number | null

// Trades
systemStatus.trades24h           // number

// Meta
systemStatus.loading             // boolean
systemStatus.error               // string | null
systemStatus.lastUpdate          // number (timestamp)
systemStatus.isStale             // boolean (> 2 min old)
```

## 🔄 DATA REFRESH

### Automatic (Default)
* Store polls every 5 seconds automatically
* No action needed
* All components update automatically

### Manual Refresh
```typescript
const { fetchSystemStatus } = useAppStore();
await fetchSystemStatus(); // Force refresh
```

## 🐛 DEBUGGING COMMANDS

### Backend (VPS)
```bash
# Check API status
pm2 status
pm2 logs dashboard-api

# Test API endpoint
curl http://localhost:3001/api/health
curl http://localhost:3001/api/system/status | jq

# Restart API
pm2 restart dashboard-api
```

### Frontend (Browser)
```javascript
// In browser console (F12):

// Check store state
console.log(useAppStore.getState());

// Force refresh
useAppStore.getState().fetchSystemStatus();

// Check last update time
const { lastUpdate } = useAppStore.getState();
console.log('Last update:', new Date(lastUpdate));

// Check if data is stale
const now = Date.now();
const { lastUpdate } = useAppStore.getState();
console.log('Seconds ago:', (now - lastUpdate) / 1000);
```

### Database (Supabase)
```sql
-- Check latest balance
SELECT * FROM balance_history 
ORDER BY snapshot_time DESC LIMIT 1;

-- Check active exchanges
SELECT * FROM exchange_connections 
WHERE is_active = true;

-- Check recent latency
SELECT * FROM latency_logs 
ORDER BY ts DESC LIMIT 10;

-- Check recent trades
SELECT * FROM trade_logs 
ORDER BY entry_time DESC LIMIT 10;
```

## 🔥 COMMON ISSUES & FIXES

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| Balance shows $0 | `balance_history` empty | Check bot writes to DB |
| "API Offline" | Backend not running | `pm2 restart dashboard-api` |
| Stale data | Polling stopped | Refresh page |
| CORS error | Wrong origin | Update `corsOptions` in backend |
| Latency null | No latency logs | Check bot pings exchanges |
| Trades = 0 | No trades executed | Normal if bot just started |

## 📝 ADDING A NEW METRIC

### 1. Add to Backend Response
```javascript
// In dashboard_api.js
const response = {
  // ... existing fields ...
  myNewMetric: {
    value: 123,
    status: 'ok'
  }
};
```

### 2. Add to TypeScript Interface
```typescript
// In systemStatusApi.ts
export interface SystemStatusResponse {
  // ... existing fields ...
  myNewMetric: {
    value: number;
    status: string;
  };
}
```

### 3. Use in Component
```typescript
import { useAppStore } from '@/store/useAppStore';

function MyComponent() {
  const { systemStatus } = useAppStore();
  const myValue = systemStatus?.myNewMetric.value || 0;
  
  return <div>{myValue}</div>;
}
```

## 🎨 UI PATTERNS

### Loading State
```typescript
const { loading } = useSystemStatus();
if (loading) return <Skeleton className="h-6 w-20" />;
```

### Error State
```typescript
const { error } = useSystemStatus();
if (error) return <Alert variant="destructive">{error}</Alert>;
```

### Stale Data Warning
```typescript
const { isStale } = useSystemStatus();
return (
  <div className={cn("card", isStale && "ring-warning")}>
    {/* content */}
  </div>
);
```

### Real-Time Indicator
```typescript
const { lastUpdate } = useSystemStatus();
const isLive = lastUpdate > Date.now() - 60000;
return <StatusDot color={isLive ? "success" : "muted"} pulse={isLive} />;
```

## ⚙️ CONFIGURATION

### Change Polling Interval
```typescript
// In frontend/src/config/api.ts
export const POLLING_INTERVALS = {
  systemStatus: 3000,    // 3 seconds (faster)
  // ... other intervals
};
```

### Change Backend URL
```typescript
// In frontend/src/config/api.ts
const VPS_IP = 'YOUR_NEW_IP';
const BACKEND_PORT = 3001;
```

## 🚀 DEPLOYMENT CHECKLIST

* [ ] Backend API running on VPS (port 3001)
* [ ] Frontend built and served (port 8080)
* [ ] Environment variables set
* [ ] Firewall allows port 3001
* [ ] Bot writes to Supabase tables
* [ ] Supabase credentials correct
* [ ] CORS origins include frontend URL
* [ ] PM2 configured for auto-restart
* [ ] Health check returns "ok"
* [ ] Dashboard loads without errors

## 📞 SUPPORT RESOURCES

* Backend logs: `pm2 logs dashboard-api`
* Frontend console: F12 → Console tab
* Network tab: F12 → Network tab
* Supabase dashboard: https://supabase.com
* API test: `curl http://YOUR_VPS:3001/api/health`

## ✨ FINAL NOTES

* All data is real - no mock data anywhere
* Store handles everything - components just read
* Automatic updates - no manual intervention needed
* Type-safe - TypeScript catches errors
* Production-ready - tested and verified

**Keep this document handy for quick reference!**
