import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getSystemStatus } from '@/services/systemStatusApi';

interface SystemStatus {
  ai: { isActive: boolean; model: string | null };
  exchanges: { connected: number; total: number; balanceUsdt: number };
  vps: { 
    status: string; 
    region: string; 
    ip: string | null; 
    provider: string | null;
    botStatus: string;
    healthStatus: string;
  };
  isFullyOperational: boolean;
  isLoading: boolean;
  lastHealthCheck: Date | null;
  isHealthChecking: boolean;
}

const initialStatus: SystemStatus = {
  ai: { isActive: false, model: null },
  exchanges: { connected: 0, total: 2, balanceUsdt: 0 }, // NEW BOT: Only OKX and Binance
  vps: { status: 'inactive', region: 'unknown', ip: null, provider: null, botStatus: 'idle', healthStatus: 'unknown' },
  isFullyOperational: false,
  isLoading: true,
  lastHealthCheck: null,
  isHealthChecking: false,
};

// Polling intervals
const HEALTHY_POLL_INTERVAL = 60000; // 60 seconds when healthy
const ERROR_POLL_INTERVAL = 30000;   // 30 seconds after error
const MAX_RETRIES = 3;
const MAX_CONSECUTIVE_FAILURES = 5;

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>(initialStatus);
  const prevStatusRef = useRef<SystemStatus | null>(null);
  const [healthCheckDisabled, setHealthCheckDisabled] = useState(false);

  // Use refs to avoid closure/dependency issues
  const fetchingRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryCountRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const currentIntervalRef = useRef(HEALTHY_POLL_INTERVAL);

      // CRITICAL FIX: Use backend API endpoint /api/system/status instead of direct Supabase queries
      // This ensures data comes from the backend which has proper access to Supabase
      const fetchStatus = useCallback(async () => {
    if (fetchingRef.current || !mountedRef.current) return;
    fetchingRef.current = true;

    try {
      // Use backend API endpoint for comprehensive system status
      let systemStatusData;
      let isBotRunning = false;
      let botStatusText = 'stopped';
      let exchangeCount = 0;
      let totalBalance = 0;
      let hasRecentLatency = false;
      let vpsStatus = 'inactive';
      let vpsIp: string | null = null;
      let vpsProvider: string | null = null;
      let vpsRegion: string | null = null;

      try {
        // Call backend API endpoint /api/system/status
        systemStatusData = await getSystemStatus();
        
        // Extract data from backend API response
        isBotRunning = systemStatusData.bot.running;
        botStatusText = systemStatusData.bot.status;
        exchangeCount = systemStatusData.exchanges.connected;
        
        // Calculate total balance from exchange list
        totalBalance = systemStatusData.exchanges.list.reduce((sum: number, e: { balance: number | null }) => {
          return sum + (Number(e.balance) || 0);
        }, 0);

        // Check if we have recent latency (within last 5 minutes)
        const latestLatencySample = systemStatusData.latency.samples?.[0];
        if (latestLatencySample) {
          const latencyAge = Date.now() - new Date(latestLatencySample.ts).getTime();
          hasRecentLatency = latencyAge < 300000; // 5 minutes
        }

        // Determine VPS status from backend response
        vpsStatus = systemStatusData.vps.status;
        
        // Try to get VPS info from deployment (fallback if not in API response)
        try {
          const { data: deployment } = await supabase
            .from('hft_deployments')
            .select('ip_address, provider, region')
            .in('status', ['active', 'running'])
            .limit(1)
            .maybeSingle();

          if (deployment) {
            vpsIp = deployment.ip_address;
            vpsProvider = deployment.provider;
            vpsRegion = deployment.region;
          } else {
            // If no deployment found, use VPS IP from known server
            vpsIp = '107.191.61.107';
          }
        } catch (deploymentError) {
          console.warn('[useSystemStatus] Error fetching deployment info:', deploymentError);
          // Use known VPS IP as fallback
          vpsIp = '107.191.61.107';
        }

        console.log('[useSystemStatus] System status from backend API:', {
          bot: isBotRunning,
          exchanges: exchangeCount,
          latency: systemStatusData.latency.recent,
          trades: systemStatusData.trades.last24h,
          vps: vpsStatus
        });
      } catch (apiError) {
        console.error('[useSystemStatus] Backend API error:', apiError);
        // SSOT FIX: Don't fallback to direct Supabase queries - use safe defaults instead
        // This maintains SSOT (backend API) even when it fails
        isBotRunning = false;
        botStatusText = 'stopped';
        exchangeCount = 0;
        totalBalance = 0;
        hasRecentLatency = false;
        vpsStatus = 'inactive';
        vpsIp = '107.191.61.107';
        
        console.warn('[useSystemStatus] Backend API unavailable, using safe defaults');
      }

      if (!mountedRef.current) return;

      const newStatus: SystemStatus = {
        ai: {
          isActive: false, // NEW BOT doesn't use AI - set to false
          model: null,
        },
        exchanges: {
          connected: exchangeCount,
          total: 2, // NEW BOT: Only OKX and Binance
          balanceUsdt: totalBalance,
        },
        vps: {
          status: vpsStatus,
          region: vpsRegion || 'unknown',
          ip: vpsIp,
          provider: vpsProvider,
          botStatus: botStatusText,
          healthStatus: (isBotRunning && hasRecentLatency) ? 'healthy' : 'unknown',
        },
        isFullyOperational: 
          exchangeCount > 0 && 
          isBotRunning &&
          hasRecentLatency,
        isLoading: false,
        lastHealthCheck: status.lastHealthCheck,
        isHealthChecking: status.isHealthChecking,
      };

      // Show toast notifications for important state changes
      if (prevStatusRef.current && !prevStatusRef.current.isLoading) {
        const prevVps = prevStatusRef.current.vps;
        
        // Bot started
        if (prevVps.botStatus !== 'running' && botStatusText === 'running') {
          toast.success('Trading bot started');
        }
        
        // Bot stopped
        if (prevVps.botStatus === 'running' && botStatusText === 'stopped') {
          toast.info('Trading bot stopped');
        }
      }

      prevStatusRef.current = newStatus;
      setStatus(newStatus);
    } catch (err) {
      console.error('[useSystemStatus] Error fetching:', err);
      if (mountedRef.current) {
        setStatus(prev => ({ ...prev, isLoading: false }));
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [status.lastHealthCheck, status.isHealthChecking]);

  const checkVpsHealth = useCallback(async () => {
    if (!mountedRef.current || healthCheckDisabled) return;
    
    setStatus(prev => ({ ...prev, isHealthChecking: true }));
    
    let success = false;
    let retries = 0;
    
    // Retry logic with exponential backoff - silent failures
    while (retries < MAX_RETRIES && !success && mountedRef.current) {
      try {
        // CRITICAL FIX: Use backend API /api/system/status for health check
        try {
          const systemStatus = await getSystemStatus();
          // VPS is healthy if bot is running and we have recent latency data
          success = systemStatus.bot.running && systemStatus.latency.recent > 0;
        } catch (apiError) {
          // Fallback: Check bot health via backend API first, then bot_status table
          try {
            const { getBotStatus } = await import('@/services/botControlApi');
            const apiStatus = await getBotStatus();
            success = apiStatus.isRunning;
          } catch (botApiError) {
            // Final fallback: bot_status table
            const { data: botStatus } = await supabase
              .from('bot_status')
              .select('is_running, last_heartbeat')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (botStatus) {
              // Check if heartbeat is recent (within last 5 minutes) or bot is running
              if (botStatus.is_running) {
                success = true;
              } else if (botStatus.last_heartbeat) {
                const heartbeatAge = Date.now() - new Date(botStatus.last_heartbeat).getTime();
                success = heartbeatAge < 300000; // 5 minutes
              }
            }
          }
        }
        
        if (success) {
          retryCountRef.current = 0;
          consecutiveFailuresRef.current = 0;
        } else {
          retries++;
          if (retries < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
          }
        }
      } catch {
        retries++;
        if (retries < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
        }
      }
    }
    
    if (mountedRef.current) {
      const now = new Date();
      setStatus(prev => ({ 
        ...prev, 
        lastHealthCheck: now,
        isHealthChecking: false 
      }));
      
      // Track consecutive failures
      if (!success) {
        consecutiveFailuresRef.current++;
        retryCountRef.current++;
        
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
          console.warn('[useSystemStatus] Health checks disabled after repeated failures.');
          setHealthCheckDisabled(true);
          if (healthIntervalRef.current) {
            clearInterval(healthIntervalRef.current);
            healthIntervalRef.current = null;
          }
        } else if (currentIntervalRef.current !== ERROR_POLL_INTERVAL) {
          currentIntervalRef.current = ERROR_POLL_INTERVAL;
          updateHealthCheckInterval();
        }
      } else {
        if (currentIntervalRef.current !== HEALTHY_POLL_INTERVAL) {
          currentIntervalRef.current = HEALTHY_POLL_INTERVAL;
          updateHealthCheckInterval();
        }
      }
      
      await fetchStatus();
    }
  }, [fetchStatus, healthCheckDisabled]);

  // Update health check interval dynamically
  const updateHealthCheckInterval = useCallback(() => {
    if (healthIntervalRef.current) {
      clearInterval(healthIntervalRef.current);
    }
    if (mountedRef.current) {
      healthIntervalRef.current = setInterval(() => {
        if (mountedRef.current) {
          checkVpsHealth();
        }
      }, currentIntervalRef.current);
    }
  }, [checkVpsHealth]);

  useEffect(() => {
    mountedRef.current = true;

    // Debounced fetch handler for realtime events
    const handleRealtimeChange = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          fetchStatus();
        }
      }, 500);
    };

    // Initial fetch
    fetchStatus();
    
    // Run health check on mount (delayed to prevent race)
    const healthCheckTimeout = setTimeout(() => {
      if (mountedRef.current) {
        checkVpsHealth();
      }
    }, 1000);

    // Auto-refresh health with adaptive interval
    healthIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        checkVpsHealth();
      }
    }, currentIntervalRef.current);

    // CRITICAL FIX: Subscribe ONLY to NEW BOT tables - NO OLD BOT TABLES
    const channel = supabase
      .channel('system-status-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exchange_connections' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_status' }, handleRealtimeChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'latency_logs' }, handleRealtimeChange)
      .subscribe();

    return () => {
      mountedRef.current = false;
      clearTimeout(healthCheckTimeout);
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchStatus, checkVpsHealth]);

  // Manual retry function to re-enable health checks
  const retryHealthChecks = useCallback(() => {
    setHealthCheckDisabled(false);
    consecutiveFailuresRef.current = 0;
    retryCountRef.current = 0;
    currentIntervalRef.current = HEALTHY_POLL_INTERVAL;
    checkVpsHealth();
  }, [checkVpsHealth]);

  return { 
    ...status, 
    refetch: fetchStatus, 
    checkHealth: checkVpsHealth,
    healthCheckDisabled,
    retryHealthChecks,
  };
}
