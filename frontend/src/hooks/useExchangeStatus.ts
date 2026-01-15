import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_EXCHANGES, normalizeExchangeId } from '@/lib/supportedExchanges';
import { getSystemStatus, type SystemStatusResponse } from '@/services/systemStatusApi';

export interface ExchangeConnection {
  id: string;
  exchange_id: string; // normalized ID (e.g., 'okx')
  exchange_name: string; // display name (e.g., 'OKX')
  is_connected: boolean;
  last_ping_ms: number | null;
  balance_usdt: number | null;
  balance_updated_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  color: string;
  needsPassphrase?: boolean;
  isHyperliquid?: boolean;
}

interface ExchangeStatus {
  exchanges: ExchangeConnection[];
  connectedCount: number;
  totalBalance: number;
  isLoading: boolean;
}

export function useExchangeStatus() {
  const [status, setStatus] = useState<ExchangeStatus>({
    exchanges: [],
    connectedCount: 0,
    totalBalance: 0,
    isLoading: true
  });

  // Prevent concurrent fetches and debounce rapid updates
  const fetchingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignatureRef = useRef<string>('');

  const fetchStatus = useCallback(async () => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // SSOT FIX: Use backend API instead of direct Supabase query
      console.log('[useExchangeStatus] Fetching exchange status from backend API...');
      const systemStatus = await getSystemStatus();
      
      // Backend API provides connected exchanges in systemStatus.exchanges.list
      const backendExchanges = systemStatus.exchanges.list || [];
      
      // Create a map of backend exchanges by normalized name
      const backendMap = new Map<string, typeof backendExchanges[0]>();
      backendExchanges.forEach(exchange => {
        const normalizedId = normalizeExchangeId(exchange.name);
        backendMap.set(normalizedId, exchange);
      });

      // Merge static list with backend API data
      const mergedExchanges: ExchangeConnection[] = SUPPORTED_EXCHANGES.map(exchange => {
        const backendExchange = backendMap.get(exchange.id);
        
        if (backendExchange) {
          // Exchange is connected according to backend API
          return {
            id: `backend-${exchange.id}`,
            exchange_id: exchange.id,
            exchange_name: exchange.name,
            is_connected: true, // Backend API only returns connected exchanges
            last_ping_ms: backendExchange.latency,
            balance_usdt: backendExchange.balance,
            balance_updated_at: new Date().toISOString(), // Backend API doesn't provide updated_at, use current time
            last_error: null,
            last_error_at: null,
            color: exchange.color,
            needsPassphrase: exchange.needsPassphrase,
            isHyperliquid: exchange.isHyperliquid,
          };
        }
        
        // Exchange not in backend API response - not connected
        return {
          id: `virtual-${exchange.id}`,
          exchange_id: exchange.id,
          exchange_name: exchange.name,
          is_connected: false,
          last_ping_ms: null,
          balance_usdt: null,
          balance_updated_at: null,
          last_error: null,
          last_error_at: null,
          color: exchange.color,
          needsPassphrase: exchange.needsPassphrase,
          isHyperliquid: exchange.isHyperliquid,
        };
      });

      const connectedCount = systemStatus.exchanges.connected; // Use backend API count (SSOT)
      const totalBalance = mergedExchanges.reduce((sum, e) => sum + (e.balance_usdt || 0), 0);

      console.log('[useExchangeStatus] Backend API exchange status:', {
        connected: connectedCount,
        total: systemStatus.exchanges.total,
        exchanges: backendExchanges.map(e => e.name)
      });

      // Create signature to prevent unnecessary state updates
      // Include connected status, balance, and latency for each exchange
      const signature = mergedExchanges
        .map(e => `${e.id}:${e.is_connected}:${e.balance_usdt}:${e.last_ping_ms}:${e.last_error}:${e.balance_updated_at}`)
        .join('|');

      // Only update state if data actually changed
      if (signature !== lastSignatureRef.current) {
        lastSignatureRef.current = signature;
        setStatus({
          exchanges: mergedExchanges,
          connectedCount,
          totalBalance,
          isLoading: false
        });
      } else if (status.isLoading) {
        // Clear loading state even if data unchanged
        setStatus(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.error('[useExchangeStatus] Error fetching from backend API:', err);
      // Fallback: Return empty status on error
      setStatus({
        exchanges: SUPPORTED_EXCHANGES.map(exchange => ({
          id: `virtual-${exchange.id}`,
          exchange_id: exchange.id,
          exchange_name: exchange.name,
          is_connected: false,
          last_ping_ms: null,
          balance_usdt: null,
          balance_updated_at: null,
          last_error: null,
          last_error_at: null,
          color: exchange.color,
          needsPassphrase: exchange.needsPassphrase,
          isHyperliquid: exchange.isHyperliquid,
        })),
        connectedCount: 0,
        totalBalance: 0,
        isLoading: false
      });
    } finally {
      fetchingRef.current = false;
    }
  }, [status.isLoading]);

  // Debounced fetch to prevent rapid re-renders from realtime events
  const debouncedFetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchStatus();
    }, 500); // Increased from 300ms to 500ms to reduce update frequency
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();

    // SSOT FIX: Poll backend API instead of subscribing to Supabase changes
    // Backend API is the Single Source of Truth, so we poll it periodically
    const pollInterval = setInterval(() => {
      debouncedFetch();
    }, 5000); // Poll every 5 seconds to get updates from backend API

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearInterval(pollInterval);
    };
  }, [fetchStatus, debouncedFetch]);

  return status;
}
