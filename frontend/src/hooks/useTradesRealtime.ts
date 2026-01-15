/**
 * Real-Time Trades Hook
 * Fetches and subscribes to trade data from Supabase
 * REAL DATA ONLY - No mock data
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { POLLING_INTERVALS } from '@/config/api';

export interface Trade {
  id: string;
  entry_time: string;
  exit_time: string | null;
  venue: string;
  symbol: string;
  side: 'long' | 'short';
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  pnl: number | null;
  status: 'open' | 'closed';
}

export interface TradesData {
  totalTrades: number;
  openCount: number;
  closedCount: number;
  trades: Trade[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch and subscribe to real-time trade data
 * Subscribes to Supabase realtime changes on trade_logs table
 */
export function useTradesRealtime(): TradesData {
  const [totalTrades, setTotalTrades] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchTrades = async () => {
      try {
        console.log('[useTradesRealtime] Fetching REAL trades from trade_logs...');
        
        // Fetch all trades (or recent trades based on your needs)
        const { data: tradesData, error: tradesError, count } = await supabase
          .from('trade_logs')
          .select('*', { count: 'exact' })
          .order('entry_time', { ascending: false })
          .limit(100); // Limit to recent 100 trades for performance

        if (tradesError) {
          throw tradesError;
        }

        if (!mounted) return;

        // Count open vs closed trades
        const openTrades = tradesData?.filter(t => !t.exit_time) || [];
        const closedTrades = tradesData?.filter(t => t.exit_time) || [];

        setTrades(tradesData || []);
        setTotalTrades(count || 0);
        setOpenCount(openTrades.length);
        setClosedCount(closedTrades.length);
        setLoading(false);
        setError(null);

        console.log('[useTradesRealtime] Trades loaded:', {
          total: count || 0,
          open: openTrades.length,
          closed: closedTrades.length,
        });
      } catch (err) {
        console.error('[useTradesRealtime] Error fetching trades:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchTrades();

    // Set up realtime subscription
    console.log('[useTradesRealtime] Setting up realtime subscription...');
    const channel = supabase
      .channel('trade_logs_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'trade_logs',
        },
        (payload) => {
          console.log('[useTradesRealtime] Realtime change detected:', payload);
          // Refetch trades on any change
          fetchTrades();
        }
      )
      .subscribe((status) => {
        console.log('[useTradesRealtime] Subscription status:', status);
      });

    // Also poll periodically as backup (in case realtime fails)
    const pollInterval = setInterval(fetchTrades, POLLING_INTERVALS.trades);

    // Cleanup
    return () => {
      mounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
      console.log('[useTradesRealtime] Cleanup completed');
    };
  }, []);

  return {
    totalTrades,
    openCount,
    closedCount,
    trades,
    loading,
    error,
  };
}
