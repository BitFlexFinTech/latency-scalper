/**
 * System Status Hook
 * Provides easy access to system status from the global store
 * Components should use this hook instead of directly accessing the store
 */

import { useAppStore } from '@/store/useAppStore';

export interface VPSInfo {
  ip: string | null;
  provider: string | null;
  region: string | null;
  latency: number | null;
  online: boolean;
}

export interface SystemStatus {
  // Bot Status
  botRunning: boolean;
  botStatus: 'running' | 'stopped';
  
  // Exchange Data
  totalEquity: number;
  connectedExchanges: number;
  exchangesList: Array<{
    name: string;
    balance: number;
    latency: number | null;
  }>;
  
  // Performance
  dailyPnl: number;
  weeklyPnl: number;
  
  // VPS Info
  vps: VPSInfo;
  
  // Latency Data
  avgLatency: number | null;
  latencySamples: Array<{
    venue: string;
    ms: number;
    ts: string;
  }>;
  
  // Trades
  trades24h: number;
  
  // Meta
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  isStale: boolean; // true if lastUpdate > 2 minutes ago
}

/**
 * Hook to access system status from the global store
 * This is the recommended way for components to access system status
 */
export function useSystemStatus(): SystemStatus {
  const store = useAppStore();
  
  // Calculate if data is stale (> 2 minutes old)
  const now = Date.now();
  const isStale = store.lastUpdate > 0 && (now - store.lastUpdate) > 120000;
  
  // Calculate average latency
  const avgLatency = store.systemStatus?.latency.samples.length
    ? Math.round(
        store.systemStatus.latency.samples
          .map(s => s.ms)
          .filter(ms => ms !== null)
          .reduce((sum, ms) => sum + ms, 0) / 
        store.systemStatus.latency.samples.length
      )
    : null;
  
  // Extract VPS info
  const vps: VPSInfo = {
    ip: '107.191.61.107', // Your VPS IP
    provider: 'vultr', // Your VPS provider
    region: 'newark', // Your VPS region
    latency: avgLatency,
    online: store.systemStatus?.vps.online || false,
  };
  
  return {
    // Bot Status
    botRunning: store.systemStatus?.bot.running || false,
    botStatus: store.systemStatus?.bot.status || 'stopped',
    
    // Exchange Data
    totalEquity: store.totalEquity,
    connectedExchanges: store.connectedExchanges.length,
    exchangesList: store.connectedExchanges,
    
    // Performance
    dailyPnl: store.dailyPnl,
    weeklyPnl: store.weeklyPnl,
    
    // VPS Info
    vps,
    
    // Latency Data
    avgLatency,
    latencySamples: store.systemStatus?.latency.samples || [],
    
    // Trades
    trades24h: store.systemStatus?.trades.last24h || 0,
    
    // Meta
    loading: store.isLoading,
    error: store.error,
    lastUpdate: store.lastUpdate,
    isStale,
  };
}
