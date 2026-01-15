/**
 * Compact Metrics Bar - FIXED VERSION
 * Displays key metrics in a compact horizontal layout
 * 
 * CRITICAL FIX: Now uses ONLY the global store (SSOT)
 * NO independent API calls
 * NO separate state management
 * ALL data comes from useAppStore
 */

import { TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle, Clock, Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/useAppStore';
import { useTradesRealtime } from '@/hooks/useTradesRealtime';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusDot } from '@/components/ui/StatusDot';

export function CompactMetricsBar() {
  // CRITICAL: Use SSOT store for ALL data - single source of truth
  const { 
    getTotalEquity, 
    getConnectedExchangeCount, 
    dailyPnl, 
    weeklyPnl, 
    isLoading: storeLoading,
    lastUpdate,
    systemStatus,
  } = useAppStore();
  
  // Use unified trades hook - single source of truth for trade data
  const { totalTrades, openCount, loading: tradesLoading } = useTradesRealtime();
  
  // Get current data from store
  const totalBalance = getTotalEquity();
  const exchangeCount = getConnectedExchangeCount();
  const isLive = lastUpdate > Date.now() - 60000; // Consider live if updated in last minute
  
  // Calculate data freshness
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  const secondsAgo = Math.max(0, Math.floor((now - lastUpdate) / 1000));
  const isStale = secondsAgo > 120; // Stale if > 2 minutes

  const dailyPercent = totalBalance > 0 ? (dailyPnl / totalBalance) * 100 : 0;
  const weeklyPercent = totalBalance > 0 ? (weeklyPnl / totalBalance) * 100 : 0;
  
  const hasNoExchanges = exchangeCount === 0 && !storeLoading;
  const hasNoData = totalBalance === 0 && !storeLoading && exchangeCount === 0;

  // Get infrastructure status from system status (already in store)
  const botRunning = systemStatus?.bot.running || false;
  const vpsOnline = systemStatus?.vps.online || false;
  
  // Calculate average latency from store data
  const avgLatency = systemStatus?.latency.samples.length
    ? Math.round(
        systemStatus.latency.samples
          .map(s => s.ms)
          .filter(ms => ms !== null)
          .reduce((sum, ms) => sum + ms, 0) / 
        systemStatus.latency.samples.length
      )
    : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn(
        "grid grid-cols-2 md:grid-cols-5 gap-2",
        isStale && "ring-1 ring-warning/30 rounded-lg"
      )}>
        {/* Today's P&L */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Today</span>
            <DollarSign className="w-3 h-3 text-success" />
          </div>
          {storeLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : hasNoData ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">Not Connected</span>
            </div>
          ) : dailyPnl === 0 && openCount === 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-muted-foreground">$0</span>
              <span className="text-[10px] text-muted-foreground">No trades</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${dailyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                {dailyPnl >= 0 ? '+' : ''}${Math.abs(dailyPnl).toFixed(0)}
              </span>
              <span className={`text-[10px] ${dailyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                ({dailyPercent >= 0 ? '+' : ''}{dailyPercent.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* Weekly P&L */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Week</span>
            {weeklyPnl >= 0 ? (
              <TrendingUp className="w-3 h-3 text-success" />
            ) : (
              <TrendingDown className="w-3 h-3 text-destructive" />
            )}
          </div>
          {storeLoading ? (
            <Skeleton className="h-6 w-20" />
          ) : hasNoData ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">Not Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${weeklyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                {weeklyPnl >= 0 ? '+' : ''}${Math.abs(weeklyPnl).toFixed(0)}
              </span>
              <span className={`text-[10px] ${weeklyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                ({weeklyPercent >= 0 ? '+' : ''}{weeklyPercent.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* Total Equity */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Equity</span>
              {isLive && (
                <StatusDot color="success" pulse size="xs" />
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-0.5 cursor-help",
                  isStale ? "text-warning" : "text-muted-foreground"
                )}>
                  <Clock className="w-2.5 h-2.5" />
                  <span className="text-[9px]">
                    {secondsAgo < 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)}m`}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {isStale ? `Data is stale (last update ${secondsAgo}s ago)` : `Last updated ${secondsAgo}s ago`}
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          {storeLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : hasNoExchanges ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">Connect Exchange</span>
            </div>
          ) : totalBalance === 0 && exchangeCount > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-muted-foreground">$0</span>
              <span className="text-[10px] text-muted-foreground">
                ({exchangeCount}ex)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">
                ${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({exchangeCount}ex)
              </span>
            </div>
          )}
        </div>

        {/* Active Trades */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Trades</span>
            <Activity className="w-3 h-3 text-accent" />
          </div>
          {tradesLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">{totalTrades}</span>
              <span className="text-[10px] text-muted-foreground">
                ({openCount} open)
              </span>
            </div>
          )}
        </div>

        {/* Infra Status */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Infra</span>
            <Server className="w-3 h-3 text-cyan-400" />
          </div>
          {storeLoading ? (
            <Skeleton className="h-6 w-16" />
          ) : (
            <div className="flex items-center gap-1">
              <StatusDot 
                color={botRunning && vpsOnline ? 'success' : 'warning'} 
                pulse={botRunning && vpsOnline}
                size="xs"
              />
              <span className="text-sm font-bold">Vultr</span>
              {avgLatency && (
                <span className="text-[10px] text-muted-foreground">
                  {avgLatency}ms
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
