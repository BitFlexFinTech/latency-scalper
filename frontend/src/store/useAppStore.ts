import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

interface ExchangeBalance {
  total: number;
  available: number;
  pnl24h: number;
  isConnected: boolean;
  lastUpdate: Date | null;
}

interface VpsStatus {
  status: 'healthy' | 'warning' | 'error' | 'offline';
  latencyMs: number;
  cpuPercent: number;
  memoryPercent: number;
  publicIp: string | null;
  region: string;
  lastHealthCheck: Date | null;
}

interface ExchangePulse {
  status: 'green' | 'yellow' | 'red';
  latencyMs: number;
  lastPing: Date | null;
}

interface ActiveVPS {
  id: string;
  provider: string;
  ipAddress: string | null;
  region: string | null;
  botStatus: string;
}

interface AppState {
  // Exchange Balances (from connected exchanges only)
  exchangeBalances: Record<string, ExchangeBalance>;
  
  // VPS Status (from real cloud providers)
  vpsStatus: Record<string, VpsStatus>;
  
  // Exchange Pulse (11 exchanges)
  exchangePulse: Record<string, ExchangePulse>;
  
  // PnL data
  dailyPnl: number;
  weeklyPnl: number;
  
  // Last global update timestamp
  lastUpdate: number;
  isLoading: boolean;
  
  // Connection status
  connectionStatus: 'connected' | 'disconnected' | 'error';
  
  // Internal flag for initial load
  _hasInitialized: boolean;
  
  // VPS State (single source of truth for active VPS)
  activeVPS: ActiveVPS | null;
  
  // Theme state - includes new Dark Flat theme
  theme: 'colorful' | 'bw' | 'light' | 'flat' | 'dark-flat';
  setTheme: (theme: 'colorful' | 'bw' | 'light' | 'flat' | 'dark-flat') => void;
  
  // COMPUTED SELECTORS (single source of truth calculations)
  getTotalEquity: () => number;
  getTotalPnL24h: () => number;
  getConnectedExchangeCount: () => number;
  getExchangeStatus: (id: string) => 'green' | 'yellow' | 'red';
  getVpsStatusLevel: (provider: string) => 'healthy' | 'warning' | 'error';
  getMeshHealth: () => { healthy: number; total: number };
  getPortfolioBreakdown: () => Array<{
    exchange: string;
    balance: number;
    percentage: number;
    color: string;
  }>;
  getActiveVPS: () => ActiveVPS | null;
  
  // ACTIONS (update state from real data sources)
  setExchangeBalance: (exchange: string, balance: ExchangeBalance) => void;
  setVpsStatus: (provider: string, status: VpsStatus) => void;
  setExchangePulse: (exchange: string, pulse: ExchangePulse) => void;
  setPnlData: (daily: number, weekly: number) => void;
  syncFromDatabase: () => Promise<void>;
  setConnectionStatus: (status: 'connected' | 'disconnected' | 'error') => void;
  setActiveVPS: (vps: ActiveVPS | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state - empty, no mock data
  exchangeBalances: {},
  vpsStatus: {},
  exchangePulse: {},
  dailyPnl: 0,
  weeklyPnl: 0,
  lastUpdate: 0,
  isLoading: true,
  connectionStatus: 'connected',
  _hasInitialized: false,
  
  // VPS state
  activeVPS: null,
  
  // Theme state - includes new Dark Flat theme
  theme: (typeof window !== 'undefined' && localStorage.getItem('app-theme') as 'colorful' | 'bw' | 'light' | 'flat' | 'dark-flat') || 'colorful',
  
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-theme', theme);
      // Remove all theme classes and attributes first
      document.documentElement.classList.remove('theme-bw', 'theme-light', 'theme-flat', 'theme-dark-flat');
      document.documentElement.removeAttribute('data-theme');
      // Add the appropriate theme class
      if (theme === 'bw') {
        document.documentElement.classList.add('theme-bw');
      } else if (theme === 'light') {
        document.documentElement.classList.add('theme-light');
      } else if (theme === 'flat') {
        document.documentElement.classList.add('theme-flat');
      } else if (theme === 'dark-flat') {
        document.documentElement.classList.add('theme-dark-flat');
      }
    }
    set({ theme });
  },
  
  // COMPUTED SELECTORS
  getTotalEquity: () => {
    const { exchangeBalances } = get();
    // SSOT FIX: Sum all balances from connected exchanges, treating null/undefined as 0
    // This allows exchanges to show as connected even if balance data is not available
    return Object.values(exchangeBalances)
      .filter(b => b.isConnected)
      .reduce((sum, b) => sum + (b.total || 0), 0);
  },
  
  getTotalPnL24h: () => {
    const { exchangeBalances } = get();
    return Object.values(exchangeBalances)
      .filter(b => b.isConnected)
      .reduce((sum, b) => sum + b.pnl24h, 0);
  },
  
  getConnectedExchangeCount: () => {
    const { exchangeBalances } = get();
    return Object.values(exchangeBalances).filter(b => b.isConnected).length;
  },
  
  getExchangeStatus: (id: string) => {
    const { exchangePulse } = get();
    return exchangePulse[id]?.status || 'red';
  },
  
  getVpsStatusLevel: (provider: string) => {
    const { vpsStatus } = get();
    const status = vpsStatus[provider]?.status;
    if (status === 'offline') return 'error';
    return status || 'error';
  },
  
  getMeshHealth: () => {
    const { vpsStatus } = get();
    const statuses = Object.values(vpsStatus);
    const healthy = statuses.filter(s => s.status === 'healthy').length;
    return { healthy, total: statuses.length };
  },
  
  getPortfolioBreakdown: () => {
    const { exchangeBalances } = get();
    
    const COLORS: Record<string, string> = {
      Binance: '#F0B90B',
      OKX: '#6366F1',
      Bybit: '#F97316',
      Bitget: '#22C55E',
      MEXC: '#3B82F6',
      'Gate.io': '#8B5CF6',
      KuCoin: '#06B6D4',
      Kraken: '#A855F7',
      BingX: '#EC4899',
      Hyperliquid: '#14B8A6',
      Nexo: '#10B981'
    };
    
    const total = Object.values(exchangeBalances)
      .filter(b => b.isConnected && b.total > 0)
      .reduce((sum, b) => sum + b.total, 0);
    
    if (total === 0) return [];
    
    return Object.entries(exchangeBalances)
      .filter(([_, b]) => b.isConnected && b.total > 0)
      .map(([exchange, b]) => ({
        exchange,
        balance: b.total,
        percentage: (b.total / total) * 100,
        color: COLORS[exchange] || '#64748B'
      }))
      .sort((a, b) => b.balance - a.balance);
  },
  
  getActiveVPS: () => get().activeVPS,
  
  // ACTIONS
  setExchangeBalance: (exchange, balance) => {
    set(state => ({
      exchangeBalances: { ...state.exchangeBalances, [exchange]: balance },
      lastUpdate: Date.now()
    }));
  },
  
  setVpsStatus: (provider, status) => {
    set(state => ({
      vpsStatus: { ...state.vpsStatus, [provider]: status },
      lastUpdate: Date.now()
    }));
  },
  
  setExchangePulse: (exchange, pulse) => {
    set(state => ({
      exchangePulse: { ...state.exchangePulse, [exchange]: pulse },
      lastUpdate: Date.now()
    }));
  },
  
  setPnlData: (daily, weekly) => {
    set({ dailyPnl: daily, weeklyPnl: weekly, lastUpdate: Date.now() });
  },
  
  setConnectionStatus: (status) => {
    set({ connectionStatus: status });
  },
  
  setActiveVPS: (vps) => {
    set({ activeVPS: vps, lastUpdate: Date.now() });
  },
  
  syncFromDatabase: async () => {
    const { _hasInitialized } = get();
    
    try {
      // Only show loading state on INITIAL load - prevents flickering on updates
      if (!_hasInitialized) {
        set({ isLoading: true });
      }
      set({ connectionStatus: 'connected' });
      
      // CRITICAL: Always fetch FRESH data - no caching
      // SSOT FIX: Get exchange balances from backend API instead of direct Supabase query
      try {
        const { getSystemStatus } = await import('@/services/systemStatusApi');
        // Force fresh fetch with timestamp
        const systemStatus = await getSystemStatus();
        console.log('[useAppStore] FRESH system status received at:', new Date().toISOString());
        
        // SSOT FIX: Map backend API exchange data to store format
        // Handle null balances gracefully - exchanges are still connected even if balance is null
        const balances: Record<string, ExchangeBalance> = {};
        systemStatus.exchanges.list.forEach(ex => {
          const balanceValue = ex.balance !== null && ex.balance !== undefined ? ex.balance : 0;
          balances[ex.name] = {
            total: balanceValue,
            available: balanceValue,
            pnl24h: 0,
            isConnected: true, // Backend API only returns connected exchanges
            lastUpdate: new Date() // Backend API doesn't provide updated_at
          };
        });
        console.log('[useAppStore] Updated exchange balances from backend API:', balances);
        set({ exchangeBalances: balances });
      } catch (apiError) {
        console.error('[useAppStore] Error fetching exchange balances from backend API:', apiError);
        // Fallback: empty balances
        set({ exchangeBalances: {} });
      }
      
      // CRITICAL FIX: Remove exchange_pulse (OLD BOT) - NEW BOT uses latency_logs
      // Exchange pulse data is no longer used - latency comes from latency_logs
      set({ exchangePulse: {} });
      
      // CRITICAL FIX: Remove vps_config, vps_metrics (OLD BOT) - NEW BOT uses bot_status and latency_logs
      // VPS status is now determined from bot_status.is_running and latency_logs
      // For now, we'll set empty VPS status - it's handled by useSystemStatus hook
      set({ vpsStatus: {} });
      
      // Calculate PnL from ACTUAL TRADES in trade_logs
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);

      // CRITICAL FIX: Get today's closed trades PnL from trade_logs (NEW BOT) - NOT trade_logs (OLD BOT)
      const { data: todayTrades } = await supabase
        .from('trade_logs')
        .select('profit_usd, net_profit_usd, exit_time, entry_time, status')
        .eq('status', 'closed')
        .gte('entry_time', todayStart.toISOString());

      const dailyPnl = todayTrades?.length 
        ? todayTrades.reduce((sum, t) => {
            const profit = t.net_profit_usd !== null ? t.net_profit_usd : t.profit_usd;
            return sum + (profit || 0);
          }, 0) 
        : 0;

      // CRITICAL FIX: Get this week's closed trades PnL from trade_logs (NEW BOT) - NOT trade_logs (OLD BOT)
      const { data: weekTrades } = await supabase
        .from('trade_logs')
        .select('profit_usd, net_profit_usd, exit_time, entry_time, status')
        .eq('status', 'closed')
        .gte('entry_time', weekStart.toISOString());

      const weeklyPnl = weekTrades?.length 
        ? weekTrades.reduce((sum, t) => {
            const profit = t.net_profit_usd !== null ? t.net_profit_usd : t.profit_usd;
            return sum + (profit || 0);
          }, 0) 
        : 0;
      
      console.log(`[SSOT] Daily PnL: $${dailyPnl} from ${todayTrades?.length || 0} closed trades`);
      
      set({ dailyPnl, weeklyPnl });

      // Fetch active VPS deployment
      const { data: activeDeployment } = await supabase
        .from('hft_deployments')
        .select('id, server_id, ip_address, provider, region, bot_status')
        .in('status', ['active', 'running'])
        .limit(1)
        .single();

      if (activeDeployment) {
        set({
          activeVPS: {
            id: activeDeployment.id,
            provider: activeDeployment.provider,
            ipAddress: activeDeployment.ip_address,
            region: activeDeployment.region,
            botStatus: activeDeployment.bot_status || 'stopped',
          }
        });
      }
      
      set({ isLoading: false, lastUpdate: Date.now(), _hasInitialized: true });
    } catch (error) {
      console.error('[useAppStore] Sync error:', error);
      set({ isLoading: false, connectionStatus: 'error', _hasInitialized: true });
    }
  }
}));

// Debounce timer for realtime updates
let realtimeDebounceTimer: NodeJS.Timeout | null = null;
const REALTIME_DEBOUNCE_MS = 500;

// Debounced sync to prevent flickering from rapid updates
const debouncedSync = () => {
  if (realtimeDebounceTimer) {
    clearTimeout(realtimeDebounceTimer);
  }
  realtimeDebounceTimer = setTimeout(() => {
    useAppStore.getState().syncFromDatabase();
  }, REALTIME_DEBOUNCE_MS);
};

// Idempotency guard to prevent duplicate initialization
let storeInitialized = false;

// Initialize store and set up realtime subscriptions
export function initializeAppStore() {
  // STRICT RULE: Prevent duplicate initialization
  if (storeInitialized) {
    console.warn('[useAppStore] Already initialized - skipping duplicate call');
    return () => {}; // Return no-op cleanup
  }
  storeInitialized = true;
  console.log('[useAppStore] Initializing app store (single instance)');
  
  const store = useAppStore.getState();
  
  // Initial sync
  store.syncFromDatabase();
  
  let retryCount = 0;
  const maxRetries = 3;
  let retryTimeout: NodeJS.Timeout | null = null;
  let pollingInterval: NodeJS.Timeout | null = null;
  let channel: ReturnType<typeof supabase.channel> | null = null;
  
  const setupSubscription = () => {
    // Subscribe to realtime updates with debouncing
    channel = supabase
      .channel('app-store-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exchange_connections' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exchange_pulse' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vps_config' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vps_instances' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_snapshots' }, debouncedSync)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'balance_history' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_logs' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hft_deployments' }, debouncedSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_config' }, debouncedSync)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useAppStore] Realtime connected');
          retryCount = 0;
          // Clear polling if realtime works
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('[useAppStore] Channel error - falling back to polling');
          // Start polling as fallback (sync every 15 seconds)
          if (!pollingInterval) {
            pollingInterval = setInterval(() => {
              store.syncFromDatabase();
            }, 15000);
          }
          // Retry subscription with backoff
          if (retryCount < maxRetries) {
            retryCount++;
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
            retryTimeout = setTimeout(() => {
              if (channel) supabase.removeChannel(channel);
              setupSubscription();
            }, backoffMs);
          }
        }
      });
  };
  
  setupSubscription();

  return () => {
    if (realtimeDebounceTimer) {
      clearTimeout(realtimeDebounceTimer);
    }
    if (retryTimeout) clearTimeout(retryTimeout);
    if (pollingInterval) clearInterval(pollingInterval);
    if (channel) supabase.removeChannel(channel);
  };
}
