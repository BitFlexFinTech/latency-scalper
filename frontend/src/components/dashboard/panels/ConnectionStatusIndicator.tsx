import { useEffect, useState } from 'react';
import { StatusDot } from '@/components/ui/StatusDot';
import { supabase } from '@/integrations/supabase/client';
import { getBotStatus } from '@/services/botControlApi';
import { getSystemStatus, checkApiHealth } from '@/services/systemStatusApi';

interface ConnectionStatus {
  supabase: 'connected' | 'disconnected' | 'checking';
  backendApi: 'connected' | 'disconnected' | 'checking';
  botStatus: 'running' | 'stopped' | 'unknown';
  exchanges: number;
  recentTrades: number;
  recentLatency: number;
  lastUpdate: Date | null;
}

export function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>({
    supabase: 'checking',
    backendApi: 'checking',
    botStatus: 'unknown',
    exchanges: 0,
    recentTrades: 0,
    recentLatency: 0,
    lastUpdate: null
  });

  useEffect(() => {
    const checkConnections = async () => {
      // Check Supabase connection
      try {
        const { data, error } = await supabase
          .from('trade_logs')
          .select('id')
          .limit(1);
        setStatus(prev => ({ 
          ...prev, 
          supabase: error ? 'disconnected' : 'connected' 
        }));
      } catch {
        setStatus(prev => ({ ...prev, supabase: 'disconnected' }));
      }

      // SSOT FIX: Check backend API health using health endpoint (not bot status)
      try {
        await checkApiHealth();
        // Also get bot status for display
        const botStatus = await getBotStatus();
        setStatus(prev => ({ 
          ...prev, 
          backendApi: 'connected',
          botStatus: botStatus.isRunning ? 'running' : 'stopped'
        }));
      } catch {
        setStatus(prev => ({ 
          ...prev, 
          backendApi: 'disconnected',
          botStatus: 'unknown'
        }));
      }

      // Get comprehensive status
      try {
        const systemStatus = await getSystemStatus();
        setStatus(prev => ({
          ...prev,
          exchanges: systemStatus.exchanges.connected,
          recentTrades: systemStatus.trades.last24h,
          recentLatency: systemStatus.latency.recent,
          lastUpdate: new Date()
        }));
      } catch (error) {
        console.error('[ConnectionStatusIndicator] Error fetching system status:', error);
      }
    };

    checkConnections();
    const interval = setInterval(checkConnections, 10000);
    return () => clearInterval(interval);
  }, []);

  const allConnected = status.supabase === 'connected' && status.backendApi === 'connected';

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1">
        <StatusDot 
          color={status.supabase === 'connected' ? 'success' : 'error'} 
          pulse={status.supabase === 'connected'}
        />
        <span className="text-muted-foreground">Supabase</span>
      </div>
      <div className="flex items-center gap-1">
        <StatusDot 
          color={status.backendApi === 'connected' ? 'success' : 'error'} 
          pulse={status.backendApi === 'connected'}
        />
        <span className="text-muted-foreground">Backend</span>
      </div>
      {status.exchanges > 0 && (
        <span className="text-muted-foreground">
          • {status.exchanges} exchange{status.exchanges !== 1 ? 's' : ''}
        </span>
      )}
      {status.recentTrades > 0 && (
        <span className="text-muted-foreground">
          • {status.recentTrades} trades (24h)
        </span>
      )}
      {status.recentLatency > 0 && (
        <span className="text-muted-foreground">
          • {status.recentLatency} latency samples
        </span>
      )}
    </div>
  );
}
