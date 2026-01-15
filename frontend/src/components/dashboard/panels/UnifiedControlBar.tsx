import { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, Square, RefreshCw, Send, Activity, RotateCcw, FileText, Server, Zap, AlertTriangle, XCircle, Wifi
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusDot } from '@/components/ui/StatusDot';
import { startBot, stopBot, getBotStatus } from '@/services/botControlApi';

type BotStatus = 'running' | 'stopped' | 'standby' | 'idle' | 'error' | 'starting';
type StartupStage = 'idle' | 'connecting' | 'verifying' | 'waiting_trade' | 'active' | 'timeout';

export function UnifiedControlBar() {
  const { syncFromDatabase } = useAppStore();

  // Local state
  const [botStatus, setBotStatus] = useState<BotStatus>('stopped');
  const [isLoading, setIsLoading] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [startupStage, setStartupStage] = useState<StartupStage>('idle');
  const [startupProgress, setStartupProgress] = useState(0);
  const startupStageRef = useRef<StartupStage>('idle');
  const startTimeRef = useRef<number | null>(null);

  // VPS API status
  const [vpsApiStatus, setVpsApiStatus] = useState<{ ok: boolean; latencyMs: number | null }>({ ok: false, latencyMs: null });

  // Sync startupStage with ref
  useEffect(() => {
    startupStageRef.current = startupStage;
  }, [startupStage]);

  // Fetch bot status from backend API
  const fetchBotStatus = useCallback(async () => {
    try {
      const status = await getBotStatus();
      const dbStatus: BotStatus = status.isRunning ? 'running' : 'stopped';
      if (startupStageRef.current === 'idle' || startupStageRef.current === 'active') {
        setBotStatus(dbStatus);
      }
    } catch (error) {
      console.error('[UnifiedControlBar] Error fetching bot status:', error);
      if (startupStageRef.current === 'idle') {
        setBotStatus('stopped');
      }
    }
  }, []);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchBotStatus]);

  // Check API status with latency measurement
  useEffect(() => {
    const checkApi = async () => {
      try {
        const startTime = performance.now();
        const status = await getBotStatus();
        const latencyMs = Math.round(performance.now() - startTime);
        const isOnline = status.isRunning;
        setVpsApiStatus({ ok: true, latencyMs: latencyMs });
      } catch (error) {
        console.error('[UnifiedControlBar] API check failed:', error);
        setVpsApiStatus({ ok: false, latencyMs: null });
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle startup with progress
  const startBotWithProgress = async () => {
    setStartupStage('connecting');
    setStartupProgress(10);
    startTimeRef.current = Date.now();
    
    try {
      setBotStatus('starting');
      setStartupProgress(30);
      setStartupStage('verifying');
      
      const result = await startBot();
      
      if (!result.success) {
        toast.error('Failed to start bot: ' + result.message);
        setStartupStage('idle');
        setStartupProgress(0);
        setBotStatus('error');
        return;
      }
      
      setStartupProgress(100);
      setStartupStage('active');
      setBotStatus('running');
      
      toast.success('✅ Bot started successfully', {
        description: result.message || 'Bot is now running',
        duration: 5000,
      });
      
      syncFromDatabase();
      
    } catch (err: any) {
      console.error('[UnifiedControlBar] Failed to start bot:', err);
      toast.error('Failed to start bot: ' + (err.message || 'Unknown error'));
      setStartupStage('idle');
      setStartupProgress(0);
      setBotStatus('error');
    } finally {
      setIsLoading(false);
      setShowStartConfirm(false);
    }
  };

  const handleStartBot = async () => {
    if (!showStartConfirm) {
      setShowStartConfirm(true);
      return;
    }
    
    setIsLoading(true);
    await startBotWithProgress();
  };

  const handleStopBot = async () => {
    setIsLoading(true);
    try {
      const result = await stopBot();

      if (result.success) {
        toast.success('Bot stopped successfully');
        setBotStatus('stopped');
        setStartupStage('idle');
        setStartupProgress(0);
        await fetchBotStatus();
        syncFromDatabase();
      } else {
        toast.error(result.message || 'Failed to stop bot');
      }
    } catch (err: any) {
      console.error('Stop bot exception:', err);
      toast.error(`Error stopping bot: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isStartingUp = startupStage !== 'idle' && startupStage !== 'active';

  const statusColor = {
    running: 'bg-success',
    stopped: 'bg-destructive',
    standby: 'bg-muted-foreground',
    idle: 'bg-warning',
    error: 'bg-destructive',
    starting: 'bg-warning'
  };

  const getStartupMessage = () => {
    switch (startupStage) {
      case 'connecting': return '🔗 Connecting to VPS...';
      case 'verifying': return '🤖 Verifying bot health...';
      case 'waiting_trade': return '📈 Bot running, waiting for trade signals...';
      case 'active': return '✅ Trading active!';
      default: return '';
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="p-2 bg-card/50 border-border/50">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Bot Status Section */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <StatusDot 
                color={
                  botStatus === 'running' ? 'success' :
                  botStatus === 'starting' ? 'warning' :
                  botStatus === 'standby' ? 'muted' :
                  botStatus === 'idle' ? 'warning' :
                  'destructive'
                }
                pulse={botStatus === 'running' || botStatus === 'starting'}
                size="sm"
              />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Bot
              </span>
              <Badge 
                variant={botStatus === 'running' ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {botStatus}
              </Badge>
            </div>

            {/* Live Mode Indicator */}
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              LIVE
            </Badge>

            {/* Startup Progress */}
            {isStartingUp && (
              <div className="flex items-center gap-2 min-w-[200px]">
                <Progress value={startupProgress} className="h-1.5 w-32" />
                <span className="text-xs text-muted-foreground">{getStartupMessage()}</span>
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={botStatus === 'running' ? 'destructive' : 'default'}
                  onClick={botStatus === 'running' ? handleStopBot : handleStartBot}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  {botStatus === 'running' ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Start
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {botStatus === 'running' ? 'Stop the trading bot' : 'Start the trading bot'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchBotStatus}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                  Refresh
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh bot status</TooltipContent>
            </Tooltip>

            {/* API Status */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                  <StatusDot 
                    color={vpsApiStatus.ok ? 'success' : 'destructive'} 
                    pulse={vpsApiStatus.ok}
                    size="xs"
                  />
                  <span className="text-xs text-muted-foreground">API</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {vpsApiStatus.ok ? 'Backend API connected' : 'Backend API disconnected'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Start Confirmation Dialog */}
        <AlertDialog open={showStartConfirm} onOpenChange={setShowStartConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Start Trading Bot?</AlertDialogTitle>
              <AlertDialogDescription>
                This will start the bot in LIVE mode. Real funds will be at risk.
                Are you sure you want to proceed?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartBot} className="bg-destructive text-destructive-foreground">
                Start Bot
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </TooltipProvider>
  );
}
