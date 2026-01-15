// System Status API Service
// Fetches comprehensive system status from backend API

import { API_URLS } from '@/config/api';

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
}

export async function getSystemStatus(): Promise<SystemStatusResponse> {
  try {
    // CRITICAL: Add cache-busting timestamp to ensure fresh data only
    const timestamp = Date.now();
    const url = `${API_URLS.systemStatus}?_t=${timestamp}`;
    console.log('[systemStatusApi] Fetching FRESH system status from:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store' // Force no caching
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('[systemStatusApi] System status received:', data);
    return data;
  } catch (error) {
    console.error('[systemStatusApi] Error fetching system status:', error);
    // Return safe defaults
    return {
      bot: { running: false, status: 'stopped' },
      exchanges: { connected: 0, total: 0, list: [] },
      latency: { recent: 0, samples: [] },
      trades: { last24h: 0 },
      vps: { online: false, status: 'inactive' }
    };
  }
}

export async function checkApiHealth(): Promise<{ status: string; timestamp: string; supabase: string }> {
  try {
    // CRITICAL: Add cache-busting timestamp to ensure fresh data only
    const timestamp = Date.now();
    const url = `${API_URLS.health}?_t=${timestamp}`;
    console.log('[systemStatusApi] Checking FRESH API health:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store' // Force no caching
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('[systemStatusApi] Health check result:', data);
    return data;
  } catch (error) {
    console.error('[systemStatusApi] Health check failed:', error);
    throw error;
  }
}
