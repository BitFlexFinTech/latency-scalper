import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VPSHealthStatus {
  status: 'healthy' | 'unhealthy' | 'unreachable' | 'unknown';
  botStatus: string | null;
  lastVerified: Date | null;
  ipAddress: string | null;
  latencyMs: number | null; // Dashboard-to-VPS latency (for health check)
  tradingLatencyMs: number | null; // VPS-to-Exchange latency (HFT-relevant!) - REAL DATA from NEW BOT
  healthData: Record<string, unknown> | null;
  desync: boolean; // True if VPS state differs from database
  provider: string | null;
  region: string | null;
}

interface UseVPSHealthPollingOptions {
  pollIntervalMs?: number;
  enabled?: boolean;
}

export function useVPSHealthPolling(options: UseVPSHealthPollingOptions = {}) {
  const { pollIntervalMs = 30000, enabled = true } = options;
  
  const [health, setHealth] = useState<VPSHealthStatus>({
    status: 'unknown',
    botStatus: null,
    lastVerified: null,
    ipAddress: null,
    latencyMs: null,
    tradingLatencyMs: null,
    healthData: null,
    desync: false,
    provider: null,
    region: null,
  });
  const [isPolling, setIsPolling] = useState(false);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Find active deployment
  const findDeployment = useCallback(async () => {
    const { data: deployment } = await supabase
      .from('hft_deployments')
      .select('id, server_id, ip_address, bot_status, status')
      .in('status', ['active', 'running'])
      .limit(1)
      .single();

    if (deployment) {
      setDeploymentId(deployment.id);
      return deployment;
    }

    return null;
  }, []);

  // CRITICAL FIX: Fetch VPS→Exchange trading latency from latency_logs (NEW BOT) - NOT exchange_pulse (OLD BOT)
  const fetchTradingLatency = useCallback(async (): Promise<number | null> => {
    try {
      // NEW BOT logs latency to latency_logs with venue='okx' or 'binance'
      // Get latest latency for each exchange and average them
      const { data: okxLatency } = await supabase
        .from('latency_logs')
        .select('latency_ms')
        .eq('venue', 'okx')
        .order('ts', { ascending: false })
        .limit(5)
        .single();
      
      const { data: binanceLatency } = await supabase
        .from('latency_logs')
        .select('latency_ms')
        .eq('venue', 'binance')
        .order('ts', { ascending: false })
        .limit(5)
        .single();
      
      const latencies: number[] = [];
      if (okxLatency?.latency_ms) latencies.push(okxLatency.latency_ms);
      if (binanceLatency?.latency_ms) latencies.push(binanceLatency.latency_ms);
      
      if (latencies.length > 0) {
        return Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length);
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Poll VPS health
  const pollHealth = useCallback(async () => {
    if (!enabled) return;
    
    setIsPolling(true);
    const startTime = Date.now();

    try {
      // CRITICAL FIX: Get bot status from bot_status table (NEW BOT) - NOT from old tables
      const { data: botStatus } = await supabase
        .from('bot_status')
        .select('is_running, last_heartbeat')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const deployment = await findDeployment();
      
      if (!botStatus && !deployment) {
        setHealth(prev => ({
          ...prev,
          status: 'unknown',
          botStatus: null,
          desync: false,
        }));
        return;
      }

      // Fetch trading latency in parallel
      const tradingLatency = await fetchTradingLatency();
      const latencyMs = Date.now() - startTime;

      // Get VPS IP from deployment or infer from latency logs
      let ipAddress: string | null = deployment?.ip_address || null;
      if (!ipAddress) {
        // Try to get from latest trade_logs or active_positions
        const { data: latestTrade } = await supabase
          .from('trade_logs')
          .select('exchange')
          .order('entry_time', { ascending: false })
          .limit(1)
          .single();
        // If we have trades, VPS is active but IP might not be in DB
        // For now, we'll leave it null if not in deployment
      }

      // Determine bot status from bot_status table (NEW BOT)
      const isRunning = botStatus?.is_running || false;
      const botStatusText = isRunning ? 'running' : 'stopped';
      
      // Check if heartbeat is recent (within 2 minutes)
      const heartbeatAge = botStatus?.last_heartbeat 
        ? Date.now() - new Date(botStatus.last_heartbeat).getTime()
        : Infinity;
      const isHealthy = heartbeatAge < 120000; // 2 minutes

      // Check for desync: Compare bot_status.is_running with deployment.bot_status if deployment exists
      const dbBotStatus = deployment?.bot_status || botStatusText;
      const isDesync = deployment && (botStatusText !== dbBotStatus);

      setHealth({
        status: isHealthy && isRunning ? 'healthy' : 'unhealthy',
        botStatus: botStatusText,
        lastVerified: new Date(),
        ipAddress,
        latencyMs,
        tradingLatencyMs: tradingLatency,
        healthData: { 
          isRunning,
          heartbeatAge,
          lastHeartbeat: botStatus?.last_heartbeat
        },
        desync: isDesync,
        provider: (deployment as any)?.provider || null,
        region: (deployment as any)?.region || null,
      });

      if (isDesync) {
        console.warn('[VPSHealthPolling] Desync detected! Bot status:', botStatusText, 'Deployment:', dbBotStatus);
      }
    } catch (err) {
      console.error('[VPSHealthPolling] Error:', err);
      setHealth(prev => ({
        ...prev,
        status: 'unreachable',
        lastVerified: new Date(),
      }));
    } finally {
      setIsPolling(false);
    }
  }, [enabled, findDeployment, fetchTradingLatency]);

  // Force sync: reconcile UI state with actual bot state
  const forceSync = useCallback(async () => {
    await pollHealth();
  }, [pollHealth]);

  // Setup polling interval
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial poll
    pollHealth();

    // Setup interval
    intervalRef.current = setInterval(pollHealth, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, pollHealth]);

  return {
    health,
    isPolling,
    deploymentId,
    refresh: pollHealth,
    forceSync,
  };
}
