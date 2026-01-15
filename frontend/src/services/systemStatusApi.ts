/**
 * System Status API Service - FIXED VERSION
 * Fetches comprehensive system status from backend API
 * This is the ONLY place that should call the backend system status endpoint
 */

import { API_URLS, apiFetch, API_TIMEOUTS } from '@/config/api';

export interface SystemStatusResponse {
  bot: {
    running: boolean;
    status: 'running' | 'stopped';
  };
  exchanges: {
    connected: number;
    total: number;
    list: Array<{
      name: string;
      latency: number | null;
      balance: number | null;
    }>;
  };
  latency: {
    recent: number;
    samples: Array<{
      venue: string;
      ms: number;
      ts: string;
    }>;
  };
  trades: {
    last24h: number;
  };
  vps: {
    online: boolean;
    status: 'active' | 'inactive' | 'idle';
  };
  timestamp: string;
  responseTime: number;
}

/**
 * Fetch system status from backend API
 * This is the SINGLE SOURCE OF TRUTH for all system status data
 * 
 * CRITICAL: This function should ONLY be called by the Zustand store
 * All components should read from the store, not call this directly
 */
export async function getSystemStatus(): Promise<SystemStatusResponse> {
  try {
    console.log('[systemStatusApi] Fetching FRESH system status from backend API...');
    
    const data = await apiFetch<SystemStatusResponse>(
      API_URLS.systemStatus,
      {
        method: 'GET',
        signal: AbortSignal.timeout(API_TIMEOUTS.default),
      }
    );
    
    // Validate response structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format from backend API');
    }
    
    if (!data.bot || !data.exchanges || !data.latency || !data.trades || !data.vps) {
      throw new Error('Incomplete response from backend API');
    }
    
    console.log('[systemStatusApi] System status received:', {
      botRunning: data.bot.running,
      exchangesConnected: data.exchanges.connected,
      latencySamples: data.latency.recent,
      trades24h: data.trades.last24h,
      vpsOnline: data.vps.online,
      timestamp: data.timestamp,
    });
    
    return data;
  } catch (error) {
    console.error('[systemStatusApi] Error fetching system status:', error);
    
    // Return safe defaults but preserve error information
    // The store will handle the error state
    throw error;
  }
}

/**
 * Check API health
 * Used to verify backend API is responsive
 */
export async function checkApiHealth(): Promise<{
  status: string;
  timestamp: string;
  supabase: string;
}> {
  try {
    console.log('[systemStatusApi] Checking backend API health...');
    
    const data = await apiFetch<{
      status: string;
      timestamp: string;
      supabase: string;
    }>(
      API_URLS.health,
      {
        method: 'GET',
        signal: AbortSignal.timeout(API_TIMEOUTS.health),
      }
    );
    
    console.log('[systemStatusApi] Health check result:', data);
    return data;
  } catch (error) {
    console.error('[systemStatusApi] Health check failed:', error);
    throw error;
  }
}
