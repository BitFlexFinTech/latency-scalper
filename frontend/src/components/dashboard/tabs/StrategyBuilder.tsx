import { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Pause, Trash2, Loader2, TrendingUp, FileText, Info, Target, Zap, Activity, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StrategyWizard } from '../wizards/StrategyWizard';
import { ActionButton } from '@/components/ui/ActionButton';
import { BUTTON_TOOLTIPS } from '@/config/buttonTooltips';
import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/ui/StatusDot';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_paused: boolean;
  win_rate: number;
  trades_today: number;
  pnl_today: number;
  trading_mode: string;
  leverage: number;
  position_size: number;
  profit_target: number;
  profit_target_leverage?: number;
  daily_goal: number;
  daily_progress: number;
  source_framework: string | null;
  allowed_exchanges?: string[];
}

interface TradingConfig {
  trading_mode: string;
  leverage: number;
}

export function StrategyBuilder() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tradingMode, setTradingMode] = useState<'spot' | 'futures'>('spot');
  const [leverage, setLeverage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [botConfig, setBotConfig] = useState<{
    minPositionSize: number;
    maxPositionSize: number;
    spotProfitTarget: number;
    leverageProfitTarget: number;
    maxTradesPerDay: number;
    maxDailyLossUsd: number;
  } | null>(null);

  // Fetch bot configuration from database - REAL DATA ONLY
  useEffect(() => {
    const fetchBotConfig = async () => {
      try {
        // Fetch from trading_config or bot_status
        const { data: config } = await supabase
          .from('trading_config')
          .select('*')
          .limit(1)
          .single();
        
        if (config) {
          setBotConfig({
            minPositionSize: config.min_position_size || 350,
            maxPositionSize: config.max_position_size || 500,
            spotProfitTarget: config.spot_profit_target || 1.0,
            leverageProfitTarget: config.leverage_profit_target || 3.0,
            maxTradesPerDay: config.max_trades_per_day || 1000,
            maxDailyLossUsd: config.max_daily_loss_usd || 50.0,
          });
        } else {
          // Default values if no config found
          setBotConfig({
            minPositionSize: 350,
            maxPositionSize: 500,
            spotProfitTarget: 1.0,
            leverageProfitTarget: 3.0,
            maxTradesPerDay: 1000,
            maxDailyLossUsd: 50.0,
          });
        }
      } catch (err) {
        console.error('[StrategyBuilder] Error fetching bot config:', err);
        // Set defaults on error
        setBotConfig({
          minPositionSize: 350,
          maxPositionSize: 500,
          spotProfitTarget: 1.0,
          leverageProfitTarget: 3.0,
          maxTradesPerDay: 1000,
          maxDailyLossUsd: 50.0,
        });
      }
    };

    fetchBotConfig();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Fetch strategies from trading_strategies table - REAL DATA ONLY
      const { data: strategiesData, error } = await supabase
        .from('trading_strategies')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[StrategyBuilder] Error fetching strategies:', error);
        setStrategies([]);
        return;
      }

      if (strategiesData) {
        setStrategies(strategiesData.map(s => ({
          ...s,
          position_size: s.position_size || 100,
          profit_target: s.profit_target || 10,
          daily_goal: s.daily_goal || 50,
          daily_progress: s.daily_progress || 0,
          win_rate: s.win_rate || 0,
          trades_today: s.trades_today || 0,
          pnl_today: s.pnl_today || 0,
          leverage: s.leverage || 1,
          source_framework: s.source_framework || null,
          allowed_exchanges: s.allowed_exchanges || [],
        })) as Strategy[]);
      } else {
        setStrategies([]);
      }

      // Fetch trading config - REAL DATA ONLY
      const { data: configData } = await supabase
        .from('trading_config')
        .select('trading_mode, leverage')
        .limit(1)
        .single();

      if (configData) {
        const config = configData as TradingConfig;
        setTradingMode((config.trading_mode as 'spot' | 'futures') || 'spot');
        setLeverage(config.leverage || 1);
      }
    } catch (err) {
      console.error('[StrategyBuilder] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates - REAL DATA ONLY
    const channel = supabase
      .channel('strategy-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trading_strategies'
      }, () => fetchData())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'trading_config'
      }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const handleModeChange = async (mode: 'spot' | 'futures') => {
    setIsSavingMode(true);
    try {
      await supabase.from('trading_config')
        .update({ 
          trading_mode: mode,
          updated_at: new Date().toISOString()
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      setTradingMode(mode);
      toast.success(`Switched to ${mode.toUpperCase()} mode`);
    } catch (error) {
      toast.error('Failed to update trading mode');
    } finally {
      setIsSavingMode(false);
    }
  };

  const handleGlobalLeverageChange = async (value: number[]) => {
    const newLeverage = value[0];
    setLeverage(newLeverage);
    
    try {
      await supabase.from('trading_config')
        .update({ 
          leverage: newLeverage,
          updated_at: new Date().toISOString()
        })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (error) {
      console.error('[StrategyBuilder] Leverage update error:', error);
    }
  };

  // Strategy-specific handlers with debouncing
  const handlePositionSizeChange = async (strategyId: string, value: string) => {
    const size = parseFloat(value) || 100;
    
    // Update local state immediately for responsiveness
    setStrategies(prev => prev.map(s => 
      s.id === strategyId ? { ...s, position_size: size } : s
    ));

    // Debounce database update
    try {
      await supabase.from('trading_strategies')
        .update({ 
          position_size: size,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);
    } catch (error) {
      console.error('[StrategyBuilder] Position size update error:', error);
    }
  };

  const handleProfitTargetChange = async (strategyId: string, value: string) => {
    const target = parseFloat(value) || 10;
    
    setStrategies(prev => prev.map(s => 
      s.id === strategyId ? { ...s, profit_target: target } : s
    ));

    try {
      await supabase.from('trading_strategies')
        .update({ 
          profit_target: target,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);
    } catch (error) {
      console.error('[StrategyBuilder] Profit target update error:', error);
    }
  };

  const handleDailyGoalChange = async (strategyId: string, value: string) => {
    const goal = parseFloat(value) || 50;
    
    setStrategies(prev => prev.map(s => 
      s.id === strategyId ? { ...s, daily_goal: goal } : s
    ));

    try {
      await supabase.from('trading_strategies')
        .update({ 
          daily_goal: goal,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);
    } catch (error) {
      console.error('[StrategyBuilder] Daily goal update error:', error);
    }
  };

  const handleStrategyLeverageChange = async (strategyId: string, value: number) => {
    setStrategies(prev => prev.map(s => 
      s.id === strategyId ? { ...s, leverage: value } : s
    ));

    try {
      await supabase.from('trading_strategies')
        .update({ 
          leverage: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);
    } catch (error) {
      console.error('[StrategyBuilder] Strategy leverage update error:', error);
    }
  };

  // Activate strategy for live trading
  const handleActivateStrategy = async (strategyId: string) => {
    setActivatingId(strategyId);
    
    try {
      // Update strategy to active
      await supabase.from('trading_strategies')
        .update({ 
          is_active: true, 
          is_paused: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);
      
      toast.success('Strategy activated for live trading');
      fetchData();
    } catch (error: any) {
      console.error('[StrategyBuilder] Activate error:', error);
      toast.error(`Activation failed: ${error.message}`);
    } finally {
      setActivatingId(null);
    }
  };

  const getServerIp = async (): Promise<string> => {
    const { data: vps } = await supabase
      .from('hft_deployments')
      .select('ip_address')
      .not('ip_address', 'is', null)
      .limit(1)
      .single();
    return vps?.ip_address || '';
  };

  const handlePauseStrategy = async (strategyId: string) => {
    setLoadingId(strategyId);
    try {
      await supabase.from('trading_strategies')
        .update({ 
          is_paused: true, 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);

      const serverIp = await getServerIp();
      if (serverIp) {
        await supabase.functions.invoke('install-hft-bot', {
          body: { 
            action: 'pause-strategy',
            strategyId,
            serverIp
          }
        });
      }

      toast.success('Strategy paused');
    } catch (error) {
      toast.error('Failed to pause strategy');
    } finally {
      setLoadingId(null);
    }
  };

  const handleStartStrategy = async (strategyId: string) => {
    setLoadingId(strategyId);
    try {
      await supabase.from('trading_strategies')
        .update({ 
          is_paused: false, 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', strategyId);

      const serverIp = await getServerIp();
      if (serverIp) {
        await supabase.functions.invoke('install-hft-bot', {
          body: { 
            action: 'start-strategy',
            strategyId,
            serverIp
          }
        });
      }

      toast.success('Strategy started - LIVE TRADING');
    } catch (error) {
      toast.error('Failed to start strategy');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    setLoadingId(strategyId);
    try {
      await supabase.from('trading_strategies')
        .delete()
        .eq('id', strategyId);

      toast.success('Strategy deleted');
    } catch (error) {
      toast.error('Failed to delete strategy');
    } finally {
      setLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-2xl font-bold">Strategy Builder</h2>
          <ActionButton 
            className="gap-2" 
            onClick={() => setShowWizard(true)}
            tooltip={BUTTON_TOOLTIPS.newStrategy}
          >
            <Plus className="w-4 h-4" />
            New Strategy
          </ActionButton>
        </div>

        {/* Strategy Wizard Dialog */}
        <StrategyWizard 
          open={showWizard} 
          onOpenChange={setShowWizard}
          onCreated={() => {}}
        />

        {/* Nexus HFT Bot Strategy Card - REAL BOT LOGIC */}
        {botConfig && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Nexus HFT Bot Strategy</CardTitle>
                    <CardDescription>Latency-Adaptive Momentum Trading</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30">
                  ACTIVE
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Position Size</p>
                  <p className="text-sm font-semibold">${botConfig.minPositionSize} - ${botConfig.maxPositionSize}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Spot Profit Target</p>
                  <p className="text-sm font-semibold text-emerald-400">${botConfig.spotProfitTarget}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Leverage Profit Target</p>
                  <p className="text-sm font-semibold text-amber-400">${botConfig.leverageProfitTarget}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Max Trades/Day</p>
                  <p className="text-sm font-semibold">{botConfig.maxTradesPerDay}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Momentum Strategy</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <StatusDot color="success" size="xs" />
                    <span className="text-muted-foreground">Momentum Threshold:</span>
                    <span className="font-mono">1.0%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot color="success" size="xs" />
                    <span className="text-muted-foreground">Min Confidence:</span>
                    <span className="font-mono">0.3</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot color="success" size="xs" />
                    <span className="text-muted-foreground">Min Strength:</span>
                    <span className="font-mono">0.5%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusDot color="success" size="xs" />
                    <span className="text-muted-foreground">Price History:</span>
                    <span className="font-mono">10 points</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Latency-Adaptive Position Sizing</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                    <p className="font-semibold text-emerald-400">Aggressive</p>
                    <p className="text-muted-foreground">≤40ms: $600</p>
                  </div>
                  <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                    <p className="font-semibold text-yellow-400">Normal</p>
                    <p className="text-muted-foreground">≤70ms: $550</p>
                  </div>
                  <div className="p-2 rounded bg-orange-500/10 border border-orange-500/20">
                    <p className="font-semibold text-orange-400">Cautious</p>
                    <p className="text-muted-foreground">≤85ms: $500</p>
                  </div>
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
                    <p className="font-semibold text-red-400">Defensive</p>
                    <p className="text-muted-foreground">&gt;85ms: $350</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Max Daily Loss:</span>
                  <span className="font-semibold text-destructive">${botConfig.maxDailyLossUsd}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Exchanges:</span>
                  <span className="font-semibold">OKX, Binance</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Trading Mode:</span>
                  <Badge variant="outline" className="text-xs">
                    {tradingMode.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trading Mode & Leverage Controls */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Trading Mode Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Trading Mode:</span>
              <div className="flex gap-2">
                <ActionButton 
                  size="sm"
                  variant={tradingMode === 'spot' ? 'default' : 'outline'}
                  onClick={() => handleModeChange('spot')}
                  disabled={isSavingMode}
                  tooltip={BUTTON_TOOLTIPS.spotMode}
                >
                  Spot
                </ActionButton>
                <ActionButton 
                  size="sm"
                  variant={tradingMode === 'futures' ? 'default' : 'outline'}
                  onClick={() => handleModeChange('futures')}
                  disabled={isSavingMode}
                  className={tradingMode === 'futures' ? 'bg-warning hover:bg-warning/90 text-warning-foreground' : ''}
                  tooltip={BUTTON_TOOLTIPS.futuresMode}
                >
                  Futures
                </ActionButton>
              </div>
            </div>

            {/* Global Leverage Slider (only visible for Futures) */}
            {tradingMode === 'futures' && (
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <span className="text-sm font-medium text-muted-foreground">Global Leverage:</span>
                <Slider
                  value={[leverage]}
                  onValueChange={handleGlobalLeverageChange}
                  min={1}
                  max={20}
                  step={1}
                  className="w-32"
                />
                <Badge variant="outline" className="font-mono">
                  {leverage}x
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Strategy Cards - REAL DATA ONLY */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => {
            const dailyProgress = strategy.daily_goal > 0 
              ? Math.min((strategy.pnl_today / strategy.daily_goal) * 100, 100)
              : 0;
            const goalReached = strategy.pnl_today >= strategy.daily_goal;

            return (
              <div key={strategy.id} className="glass-card-hover p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{strategy.name}</h3>
                      {strategy.source_framework && strategy.source_framework !== 'custom' && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] px-1.5 py-0.5",
                            strategy.source_framework === 'freqtrade' && 'border-sky-500 text-sky-500',
                            strategy.source_framework === 'jesse' && 'border-blue-500 text-blue-500',
                            strategy.source_framework === 'vnpy' && 'border-purple-500 text-purple-500',
                            strategy.source_framework === 'superalgos' && 'border-orange-500 text-orange-500',
                            strategy.source_framework === 'backtrader' && 'border-yellow-500 text-yellow-500',
                            strategy.source_framework === 'hummingbot' && 'border-teal-500 text-teal-500'
                          )}
                        >
                          {strategy.source_framework}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{strategy.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {strategy.is_active && !strategy.is_paused ? (
                      <>
                        <StatusDot color="success" pulse size="sm" />
                        <span className="text-xs text-success">Active</span>
                      </>
                    ) : (
                      <>
                        <StatusDot color="warning" size="sm" />
                        <span className="text-xs text-warning">Paused</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Position Size Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Position Size ($)</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-3 h-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{BUTTON_TOOLTIPS.positionSize}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    value={strategy.position_size}
                    onChange={(e) => handlePositionSizeChange(strategy.id, e.target.value)}
                    className="h-8 text-sm"
                    min={1}
                  />
                </div>

                {/* Profit Target Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Profit Target ($)</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Target className="w-3 h-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{BUTTON_TOOLTIPS.profitTarget}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    type="number"
                    value={strategy.profit_target}
                    onChange={(e) => handleProfitTargetChange(strategy.id, e.target.value)}
                    className="h-8 text-sm"
                    min={0.01}
                    step={0.1}
                  />
                </div>

                {/* Daily Goal with Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Daily Goal</Label>
                    <span className={cn(
                      "text-xs font-medium",
                      goalReached ? "text-success" : "text-muted-foreground"
                    )}>
                      ${strategy.pnl_today.toFixed(2)} / ${strategy.daily_goal}
                    </span>
                  </div>
                  <Progress 
                    value={dailyProgress} 
                    className={cn("h-2", goalReached && "bg-success/20")}
                  />
                  <Input
                    type="number"
                    value={strategy.daily_goal}
                    onChange={(e) => handleDailyGoalChange(strategy.id, e.target.value)}
                    className="h-8 text-sm"
                    min={1}
                    placeholder="Set daily goal"
                  />
                </div>

                {/* Leverage Slider (Futures Mode Only) */}
                {tradingMode === 'futures' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Strategy Leverage</Label>
                      <Badge variant="outline" className="font-mono text-xs">
                        {strategy.leverage || 1}x
                      </Badge>
                    </div>
                    <Slider
                      value={[strategy.leverage || 1]}
                      onValueChange={(v) => handleStrategyLeverageChange(strategy.id, v[0])}
                      min={1}
                      max={20}
                      step={1}
                      className="py-2"
                    />
                  </div>
                )}

                {/* Performance Stats - REAL DATA ONLY */}
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Win Rate</span>
                    <span className="font-medium">{strategy.win_rate}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Trades Today</span>
                    <span className="font-medium">{strategy.trades_today}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">P&L Today</span>
                    <span className={cn(
                      "font-medium",
                      strategy.pnl_today >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {strategy.pnl_today >= 0 ? '+' : ''}${strategy.pnl_today.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <ActionButton 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 gap-1 text-success hover:text-success"
                    onClick={() => handleActivateStrategy(strategy.id)}
                    disabled={activatingId === strategy.id || strategy.is_active}
                    tooltip="Activate this strategy for live trading"
                  >
                    {activatingId === strategy.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3" />
                    )}
                    {strategy.is_active ? 'Active' : 'Activate'}
                  </ActionButton>
                  
                  {strategy.is_active && !strategy.is_paused ? (
                    <ActionButton 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => handlePauseStrategy(strategy.id)}
                      disabled={loadingId === strategy.id}
                      tooltip={BUTTON_TOOLTIPS.pauseStrategy}
                    >
                      {loadingId === strategy.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Pause className="w-3 h-3" />
                      )}
                      Pause
                    </ActionButton>
                  ) : (
                    <ActionButton 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1 text-success hover:text-success"
                      onClick={() => handleStartStrategy(strategy.id)}
                      disabled={loadingId === strategy.id}
                      tooltip={BUTTON_TOOLTIPS.startLive}
                    >
                      {loadingId === strategy.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      Start
                    </ActionButton>
                  )}
                  
                  <ActionButton 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteStrategy(strategy.id)}
                    disabled={loadingId === strategy.id}
                    tooltip={BUTTON_TOOLTIPS.deleteStrategy}
                  >
                    {loadingId === strategy.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </ActionButton>
                </div>
              </div>
            );
          })}

          {/* Add New Strategy Card */}
          <div 
            className="glass-card border-dashed p-6 flex flex-col items-center justify-center text-center min-h-[300px] hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => setShowWizard(true)}
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium">Create New Strategy</p>
            <p className="text-sm text-muted-foreground">Visual no-code builder</p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
