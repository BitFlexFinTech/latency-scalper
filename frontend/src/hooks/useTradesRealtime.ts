import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Trade {
  id: string;
  symbol: string;
  exchange: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  position_size_usd: number;
  profit_usd: number | null;
  net_profit_usd: number | null;
  status: string | null;
  entry_time: string | null;
  exit_time: string | null;
  duration_ms: number | null;
}

/**
 * useTradesRealtime - Single Source of Truth for all trade data from NEW BOT
 * 
 * CRITICAL FIX: This hook now reads from trade_logs table (NEW BOT) - NOT trade_logs (OLD BOT)
 * 
 * This hook provides:
 * - Real-time updates for INSERT, UPDATE, and DELETE events
 * - Computed values for trade counts and PnL
 * - Connection status monitoring
 * 
 * All trade panels MUST use this hook to ensure data consistency.
 */
export function useTradesRealtime() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  // CRITICAL FIX: Fetch from trade_logs table (NEW BOT) - NOT trade_logs (OLD BOT)
  const fetchTrades = useCallback(async () => {
    const { data, error } = await supabase
      .from('trade_logs')  // NEW BOT TABLE
      .select('id, symbol, exchange, side, entry_price, exit_price, position_size_usd, profit_usd, net_profit_usd, status, entry_time, exit_time, duration_ms')
      .order('entry_time', { ascending: false });
    
    if (!error && data) {
      // Map to Trade interface
      const mappedTrades: Trade[] = data.map(t => ({
        id: t.id,
        symbol: t.symbol,
        exchange: t.exchange,
        side: t.side,
        entry_price: t.entry_price,
        exit_price: t.exit_price,
        position_size_usd: t.position_size_usd,
        profit_usd: t.profit_usd,
        net_profit_usd: t.net_profit_usd,
        status: t.status,
        entry_time: t.entry_time,
        exit_time: t.exit_time,
        duration_ms: t.duration_ms
      }));
      setTrades(mappedTrades);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrades();

    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = () => {
      // CRITICAL FIX: Subscribe to trade_logs table (NEW BOT) - NOT trade_logs (OLD BOT)
      channel = supabase
        .channel('trades-ssot-unified')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'trade_logs'  // NEW BOT TABLE
        }, (payload) => {
          console.log('[useTradesRealtime] INSERT from NEW BOT:', payload.new);
          setTrades(prev => {
            const newTrade = payload.new as any;
            if (prev.some(t => t.id === newTrade.id)) return prev;
            // Map to Trade interface
            const mappedTrade: Trade = {
              id: newTrade.id,
              symbol: newTrade.symbol,
              exchange: newTrade.exchange,
              side: newTrade.side,
              entry_price: newTrade.entry_price,
              exit_price: newTrade.exit_price,
              position_size_usd: newTrade.position_size_usd,
              profit_usd: newTrade.profit_usd,
              net_profit_usd: newTrade.net_profit_usd,
              status: newTrade.status,
              entry_time: newTrade.entry_time,
              exit_time: newTrade.exit_time,
              duration_ms: newTrade.duration_ms
            };
            return [mappedTrade, ...prev];
          });
          setLastEventAt(new Date());
        })
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'trade_logs'  // NEW BOT TABLE
        }, (payload) => {
          console.log('[useTradesRealtime] UPDATE from NEW BOT:', payload.new);
          setTrades(prev => prev.map(t => {
            const updated = payload.new as any;
            if (t.id === updated.id) {
              return {
                ...t,
                exit_price: updated.exit_price,
                profit_usd: updated.profit_usd,
                net_profit_usd: updated.net_profit_usd,
                status: updated.status,
                exit_time: updated.exit_time,
                duration_ms: updated.duration_ms
              };
            }
            return t;
          }));
          setLastEventAt(new Date());
        })
        .on('postgres_changes', { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'trade_logs'  // NEW BOT TABLE
        }, (payload) => {
          console.log('[useTradesRealtime] DELETE from NEW BOT:', payload.old);
          setTrades(prev => prev.filter(t => t.id !== (payload.old as any).id));
          setLastEventAt(new Date());
        })
        .subscribe((status) => {
          console.log('[useTradesRealtime] Subscription status:', status);
          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected');
            retryCount = 0;
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionStatus('error');
            // Start polling as fallback
            if (!pollingInterval) {
              pollingInterval = setInterval(fetchTrades, 10000);
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
      if (channel) supabase.removeChannel(channel);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [fetchTrades]);

  // Computed values - single source of truth
  const totalTrades = trades.length;
  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  
  // Use net_profit_usd if available, otherwise profit_usd
  const totalPnlClosed = closedTrades.reduce((sum, t) => {
    const profit = t.net_profit_usd !== null ? t.net_profit_usd : t.profit_usd;
    return sum + (profit || 0);
  }, 0);
  
  const openCount = openTrades.length;
  const closedCount = closedTrades.length;
  
  // Today's trades
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTrades = closedTrades.filter(t => {
    const tradeDate = new Date(t.exit_time || t.entry_time || '');
    return tradeDate >= today;
  });
  const todayPnl = todayTrades.reduce((sum, t) => {
    const profit = t.net_profit_usd !== null ? t.net_profit_usd : t.profit_usd;
    return sum + (profit || 0);
  }, 0);

  return {
    trades,
    loading,
    totalTrades,
    openTrades,
    closedTrades,
    openCount,
    closedCount,
    totalPnlClosed,
    todayPnl,
    todayTrades,
    lastEventAt,
    connectionStatus,
    refetch: fetchTrades
  };
}
