import { TrendingUp, TrendingDown, DollarSign, Activity, AlertCircle, Clock, Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/useAppStore';
import { useTradesRealtime } from '@/hooks/useTradesRealtime';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusDot } from '@/components/ui/StatusDot';
import { getStatusDotColor } from '@/lib/statusColors';
import { getSystemStatus } from '@/services/systemStatusApi';

interface InfraStatus {
  provider: string;
  status: string;
  region: string | null;
  latencyMs: number | null;
}

export function CompactMetricsBar() {
  // Use SSOT store for equity - single source of truth
  const { 
    getTotalEquity, 
    getConnectedExchangeCount, 
    dailyPnl, 
    weeklyPnl, 
    isLoading: storeLoading,
    lastUpdate
  } = useAppStore();
  
  // Use unified trades hook - single source of truth for trade data
  const { totalTrades, openCount, loading: tradesLoading } = useTradesRealtime();
  
  const totalBalance = getTotalEquity();
  const exchangeCount = getConnectedExchangeCount();
  const isLive = lastUpdate > Date.now() - 60000; // Consider live if updated in last minute
  
  // Infrastructure status state
  const [infraStatus, setInfraStatus] = useState<InfraStatus | null>(null);
  const [infraLoading, setInfraLoading] = useState(true);
  
  // CRITICAL: NO CACHING - Always use fresh data only
  // Removed caching to ensure frontend always displays latest balances from backend API
  
  // SSOT FIX: Fetch infrastructure status from BACKEND API (not direct Supabase queries)
  useEffect(() => {
    const fetchInfra = async () => {
      try {
        // Get comprehensive status from backend API (SSOT)
        const systemStatus = await getSystemStatus();
        
        // Extract bot status
        const botRunning = systemStatus.bot.running;
        
        // Get VPS info from backend API response
        const vpsStatus = systemStatus.vps.status;
        
        // Calculate average latency from backend API latency samples
        let avgLatency: number | null = null;
        if (systemStatus.latency.samples && systemStatus.latency.samples.length > 0) {
          const latencies = systemStatus.latency.samples
            .map(s => s.ms)
            .filter((ms): ms is number => ms !== null && ms !== undefined);
          
          if (latencies.length > 0) {
            avgLatency = Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length);
          }
        }
        
        // Try to get provider from deployment table (fallback if not in API response)
        let provider = 'vultr';
        let region = 'unknown';
        try {
          const { data: deployment } = await supabase
            .from('hft_deployments')
            .select('provider, region')
            .in('status', ['active', 'running'])
            .limit(1)
            .maybeSingle();
          
          if (deployment) {
            provider = deployment.provider || 'vultr';
            region = deployment.region || 'unknown';
          }
        } catch {
          // Use defaults
        }
        
        setInfraStatus({
          provider,
          status: botRunning ? 'running' : (vpsStatus === 'active' ? 'active' : 'inactive'),
          region,
          latencyMs: avgLatency
        });
      } catch (err) {
        console.error('[CompactMetricsBar] Error fetching infra from backend API:', err);
        setInfraStatus(null);
      } finally {
        setInfraLoading(false);
      }
    };

    fetchInfra();
    const interval = setInterval(fetchInfra, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);
  
  // CRITICAL: Always use fresh data - no caching
  const displayBalance = totalBalance;
  const displayDailyPnl = dailyPnl;
  const displayWeeklyPnl = weeklyPnl;
  
  // Calculate data freshness
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const secondsAgo = Math.max(0, Math.floor((now - lastUpdate) / 1000));
  const isStale = secondsAgo > 120; // Stale if > 2 minutes

  const dailyPercent = displayBalance > 0 ? (displayDailyPnl / displayBalance) * 100 : 0;
  const weeklyPercent = displayBalance > 0 ? (displayWeeklyPnl / displayBalance) * 100 : 0;
  
  // SSOT FIX: Check exchange count from backend API, not just store
  // Exchanges can be connected even if balance is 0/null
  const [backendExchangeCount, setBackendExchangeCount] = useState<number>(0);
  
  useEffect(() => {
    const checkExchanges = async () => {
      try {
        const systemStatus = await getSystemStatus();
        setBackendExchangeCount(systemStatus.exchanges.connected);
      } catch {
        setBackendExchangeCount(0);
      }
    };
    checkExchanges();
    const interval = setInterval(checkExchanges, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // Use backend API exchange count as source of truth
  const actualExchangeCount = backendExchangeCount > 0 ? backendExchangeCount : exchangeCount;
  const hasNoExchanges = actualExchangeCount === 0 && !storeLoading;
  const hasNoData = displayBalance === 0 && !storeLoading && actualExchangeCount === 0;
  const localLoading = tradesLoading;

  const getProviderLabel = (provider: string) => {
    const labels: Record<string, string> = {
      vultr: 'Vultr', contabo: 'Contabo', aws: 'AWS', 
      digitalocean: 'DO', gcp: 'GCP', oracle: 'Oracle',
      alibaba: 'Alibaba', azure: 'Azure'
    };
    return labels[provider.toLowerCase()] || provider;
  };

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
          ) : displayDailyPnl === 0 && openCount === 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-muted-foreground">$0</span>
              <span className="text-[10px] text-muted-foreground">No trades</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${displayDailyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                {displayDailyPnl >= 0 ? '+' : ''}${Math.abs(displayDailyPnl).toFixed(0)}
              </span>
              <span className={`text-[10px] ${displayDailyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                ({dailyPercent >= 0 ? '+' : ''}{dailyPercent.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* Weekly P&L */}
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Week</span>
            {displayWeeklyPnl >= 0 ? (
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
              <span className={`text-lg font-bold ${displayWeeklyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                {displayWeeklyPnl >= 0 ? '+' : ''}${Math.abs(displayWeeklyPnl).toFixed(0)}
              </span>
              <span className={`text-[10px] ${displayWeeklyPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
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
          ) : displayBalance === 0 && actualExchangeCount > 0 ? (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-muted-foreground">$0</span>
              <span className="text-[10px] text-muted-foreground">
                ({actualExchangeCount}ex)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold">
                ${displayBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({actualExchangeCount}ex)
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
          {localLoading ? (
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
          {infraLoading ? (
            <Skeleton className="h-6 w-16" />
          ) : infraStatus ? (
            <div className="flex items-center gap-1">
              <StatusDot 
                color={infraStatus.status === 'running' || infraStatus.status === 'active' ? 'success' : 'warning'} 
                pulse={infraStatus.status === 'running' || infraStatus.status === 'active'}
                size="xs"
              />
              <span className="text-sm font-bold">{getProviderLabel(infraStatus.provider)}</span>
              {infraStatus.latencyMs && (
                <span className="text-[10px] text-muted-foreground">
                  {infraStatus.latencyMs}ms
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">No VPS</span>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
