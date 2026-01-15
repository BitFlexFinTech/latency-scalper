/**
 * Global Application Store - SINGLE SOURCE OF TRUTH
 * All components MUST read data from this store
 * NO component should fetch data independently
 */

import { create } from 'zustand';
import { getSystemStatus, SystemStatusResponse } from '@/services/systemStatusApi';
import { POLLING_INTERVALS } from '@/config/api';

export interface Exchange {
  name: string;
  balance: number;
  latency: number | null;
  connected: boolean;
}

export interface AppState {
  // System Status Data (from backend API)
  systemStatus: SystemStatusResponse | null;
  
  // Derived Computed Values (calculated from systemStatus)
  totalEquity: number;
  dailyPnl: number;
  weeklyPnl: number;
  connectedExchanges: Exchange[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
  
  // Theme state - preserved from old store
  theme: 'colorful' | 'bw' | 'light' | 'flat' | 'dark-flat';
  setTheme: (theme: 'colorful' | 'bw' | 'light' | 'flat' | 'dark-flat') => void;
  
  // Actions
  fetchSystemStatus: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  
  // Getters (for convenience)
  getTotalEquity: () => number;
  getConnectedExchangeCount: () => number;
  getBotStatus: () => boolean;
}

let pollingInterval: NodeJS.Timeout | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  systemStatus: null,
  totalEquity: 0,
  dailyPnl: 0,
  weeklyPnl: 0,
  connectedExchanges: [],
  isLoading: true,
  error: null,
  lastUpdate: 0,

  // Theme state - preserved from old store
  theme: (typeof window !== 'undefined' && localStorage.getItem('app-theme') as 'colorful' | 'bw' | 'light' | 'flat' | 'dark-flat') || 'colorful',
  
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-theme', theme);
      document.documentElement.classList.remove('theme-bw', 'theme-light', 'theme-flat', 'theme-dark-flat');
      document.documentElement.removeAttribute('data-theme');
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

  // Fetch system status from backend API (SSOT)
  fetchSystemStatus: async () => {
    try {
      console.log('[Store] Fetching FRESH system status...');
      const status = await getSystemStatus();
      
      // Calculate total equity from exchanges
      const totalEquity = status.exchanges.list.reduce((sum, ex) => {
        return sum + (ex.balance || 0);
      }, 0);
      
      // Map exchanges with computed connected flag
      const connectedExchanges: Exchange[] = status.exchanges.list.map(ex => ({
        name: ex.name,
        balance: ex.balance || 0,
        latency: ex.latency,
        connected: true, // If in list, it's connected
      }));
      
      // TODO: Calculate PnL from trade logs
      // For now, these remain at 0 until we implement trade log fetching
      const dailyPnl = 0;
      const weeklyPnl = 0;
      
      set({
        systemStatus: status,
        totalEquity,
        dailyPnl,
        weeklyPnl,
        connectedExchanges,
        isLoading: false,
        error: null,
        lastUpdate: Date.now(),
      });
      
      console.log('[Store] System status updated:', {
        totalEquity,
        exchangeCount: connectedExchanges.length,
        botRunning: status.bot.running,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Store] Error fetching system status:', errorMessage);
      
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  // Start automatic polling
  startPolling: () => {
    const { fetchSystemStatus, stopPolling } = get();
    
    // Stop any existing polling
    stopPolling();
    
    // Fetch immediately
    fetchSystemStatus();
    
    // Start new polling interval
    pollingInterval = setInterval(() => {
      fetchSystemStatus();
    }, POLLING_INTERVALS.systemStatus);
    
    console.log('[Store] Started polling system status every', POLLING_INTERVALS.systemStatus, 'ms');
  },

  // Stop automatic polling
  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      console.log('[Store] Stopped polling system status');
    }
  },

  // Convenience getters
  getTotalEquity: () => get().totalEquity,
  getConnectedExchangeCount: () => get().connectedExchanges.length,
  getBotStatus: () => get().systemStatus?.bot.running || false,
}));

// Auto-start polling when store is created
// This ensures data starts flowing immediately
if (typeof window !== 'undefined') {
  // Only in browser environment
  useAppStore.getState().startPolling();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    useAppStore.getState().stopPolling();
  });
}
