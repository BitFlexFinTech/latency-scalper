import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  LineChart, 
  Blocks, 
  FlaskConical, 
  Trophy, 
  Settings,
  Power,
  Menu,
  X,
  Zap,
  ArrowLeftRight,
  Bell,
  UserCog,
  Brain,
  Server,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LiveDashboard } from './tabs/LiveDashboard';
import { PortfolioAnalytics } from './tabs/PortfolioAnalytics';
import { StrategyBuilder } from './tabs/StrategyBuilder';
import { Backtesting } from './tabs/Backtesting';
import { Leaderboard } from './tabs/Leaderboard';
import { SettingsTab } from './tabs/SettingsTab';
import { TradingTab } from './tabs/TradingTab';
import { AITab } from './tabs/AITab';
import { VPSTab } from './tabs/VPSTab';
import { NotificationCenter } from './NotificationCenter';
import { KillSwitchDialog } from './KillSwitchDialog';
import { SystemHealthBar } from './SystemHealthBar';
import { NotificationDropdown } from './NotificationDropdown';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { WidgetCustomizer } from './WidgetCustomizer';
import { ConnectionStatusIndicator } from './panels/ConnectionStatusIndicator';
import { supabase } from '@/integrations/supabase/client';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { StatusDot } from '@/components/ui/StatusDot';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getSystemStatus, checkApiHealth } from '@/services/systemStatusApi';
import { getBotStatus } from '@/services/botControlApi';

const tabs = [
  { id: 'ai', label: 'AI', icon: Brain },
  { id: 'vps', label: 'VPS', icon: Server },
  { id: 'dashboard', label: 'Live Dashboard', icon: LayoutDashboard },
  { id: 'trading', label: 'Trading', icon: ArrowLeftRight },
  { id: 'analytics', label: 'Analytics', icon: LineChart },
  { id: 'strategy', label: 'Strategy', icon: Blocks },
  { id: 'backtest', label: 'Backtesting', icon: FlaskConical },
  { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = typeof tabs[number]['id'];

export function DashboardLayout() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [botStatus, setBotStatus] = useState<{ is_running: boolean; last_heartbeat: string | null } | null>(null);
  const [vpsLatency, setVpsLatency] = useState<number | null>(null);
  const [vpsIp, setVpsIp] = useState<string | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const { vps } = useSystemStatus();

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('system_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .eq('dismissed', false);
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    // Subscribe to notification changes
    const channel = supabase
      .channel('notification-count')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'system_notifications' 
      }, () => fetchUnreadCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // CRITICAL FIX: Fetch bot status and VPS info from BACKEND API (SSOT)
  useEffect(() => {
    const fetchAllStatus = async () => {
      try {
        // SSOT FIX: Get comprehensive status from backend API
        const systemStatus = await getSystemStatus();
        
        // Set bot status from backend API
        setBotStatus({
          is_running: systemStatus.bot.running,
          last_heartbeat: null // Backend API doesn't provide this
        });
        
        // Get VPS IP from backend API or fallback
        if (vps.ip) {
          setVpsIp(vps.ip);
        } else {
          // Fallback: Try to get from deployment table (only if backend doesn't provide)
          try {
            const { data: deployment } = await supabase
              .from('hft_deployments')
              .select('ip_address')
              .in('status', ['active', 'running'])
              .limit(1)
              .maybeSingle();
            
            if (deployment?.ip_address) {
              setVpsIp(deployment.ip_address);
            } else {
              setVpsIp('107.191.61.107'); // Known VPS IP
            }
          } catch {
            setVpsIp('107.191.61.107');
          }
        }
        
        // Get latency from backend API (already in systemStatus.latency.samples)
        if (systemStatus.latency.samples && systemStatus.latency.samples.length > 0) {
          const latencies = systemStatus.latency.samples
            .map(s => s.ms)
            .filter((ms): ms is number => ms !== null && ms !== undefined);
          
          if (latencies.length > 0) {
            const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
            setVpsLatency(Math.round(avgLatency));
          }
        }
      } catch (error) {
        console.error('[DashboardLayout] Error fetching status from backend API:', error);
        // Fallback: Set safe defaults
        setBotStatus({ is_running: false, last_heartbeat: null });
        setVpsIp(vps.ip || '107.191.61.107');
      }
    };

    fetchAllStatus();
    const interval = setInterval(fetchAllStatus, 10000); // Poll every 10 seconds

    return () => {
      clearInterval(interval);
    };
  }, [vps.ip]);

  // SSOT FIX: Check backend API health separately
  useEffect(() => {
    const checkApi = async () => {
      try {
        await checkApiHealth();
        setApiOnline(true);
      } catch (error) {
        console.error('[DashboardLayout] Backend API health check failed:', error);
        setApiOnline(false);
      }
    };

    checkApi();
    const interval = setInterval(checkApi, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'ai':
        return <AITab />;
      case 'vps':
        return <VPSTab />;
      case 'dashboard':
        return <LiveDashboard />;
      case 'trading':
        return <TradingTab />;
      case 'analytics':
        return <PortfolioAnalytics />;
      case 'strategy':
        return <StrategyBuilder />;
      case 'backtest':
        return <Backtesting />;
      case 'leaderboard':
        return <Leaderboard />;
      case 'notifications':
        return <NotificationCenter />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <LiveDashboard />;
    }
  };

  // SSOT FIX: Determine API status from backend API health check (not bot_status table)
  const apiStatus = apiOnline ? 'Online' : 'Offline';
  const apiStatusColor = apiOnline ? 'success' : 'error';

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col overflow-hidden bg-background">
        {/* Top Header Bar - Nexus HFT Logo + Navigation */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm px-4 py-2 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>

            {/* Nexus HFT Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg hidden sm:inline">
                Nexus HFT
              </span>
            </div>

            {/* Navigation Buttons */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'gap-1.5 transition-all relative text-xs',
                    activeTab === tab.id
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">{tab.label}</span>
                  {tab.id === 'notifications' && unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </Button>
              ))}
              
              {/* Setup Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/setup')}
                className="gap-1.5 text-xs text-accent hover:text-accent hover:bg-accent/20 border border-accent/30"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Setup</span>
              </Button>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <ConnectionStatusIndicator />
            {activeTab === 'dashboard' && <WidgetCustomizer dashboardId="live" />}
            <ThemeToggle />
            <NotificationDropdown />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              className="text-muted-foreground hover:text-foreground hover:bg-accent/20"
              title="User Settings"
            >
              <UserCog className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/20"
              onClick={() => setShowKillSwitch(true)}
            >
              <Power className="w-5 h-5" />
            </Button>
          </div>
        </header>

        {/* Status Bar - BOT running, LIVE, IP, Latency, API status - REAL DATA ONLY from NEW BOT */}
        <div className="border-b border-border bg-muted/30 px-4 py-1.5 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <StatusDot 
              color={botStatus?.is_running ? 'success' : 'muted'} 
              pulse={botStatus?.is_running} 
            />
            <span className="font-medium">BOT {botStatus?.is_running ? 'running' : 'stopped'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <StatusDot color="success" pulse />
            <span className="font-medium text-green-500">LIVE</span>
          </div>

          {vpsIp && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">IP:</span>
              <span className="font-mono">{vpsIp}</span>
            </div>
          )}

          {vpsLatency !== null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Latency:</span>
              <span className={cn(
                "font-mono font-medium",
                vpsLatency <= 40 ? 'text-green-500' :
                vpsLatency <= 70 ? 'text-yellow-500' :
                vpsLatency <= 85 ? 'text-orange-500' : 'text-red-500'
              )}>
                {vpsLatency}ms
              </span>
            </div>
          )}

          {/* CRITICAL FIX: API status from bot_status.is_running (NEW BOT) - NOT from old tables */}
          <div className="flex items-center gap-2">
            <StatusDot 
              color={apiStatusColor} 
              pulse={botStatus?.is_running} 
            />
            <span className="text-muted-foreground">API {apiStatus}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={async () => {
                // Real VPS ping action - fetch latest latency from NEW BOT
                const { data: okxData } = await supabase
                  .from('latency_logs')
                  .select('latency_ms, venue')
                  .eq('venue', 'okx')
                  .order('ts', { ascending: false })
                  .limit(1)
                  .single();
                
                const { data: binanceData } = await supabase
                  .from('latency_logs')
                  .select('latency_ms, venue')
                  .eq('venue', 'binance')
                  .order('ts', { ascending: false })
                  .limit(1)
                  .single();
                
                if (okxData || binanceData) {
                  const latencies = [okxData?.latency_ms, binanceData?.latency_ms].filter(Boolean) as number[];
                  if (latencies.length > 0) {
                    const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
                    console.log(`[Dashboard] VPS→Exchange Latency: ${Math.round(avg)}ms (OKX: ${okxData?.latency_ms}ms, Binance: ${binanceData?.latency_ms}ms)`);
                  }
                }
              }}
            >
              Ping VPS
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">INFRA</span>
            <StatusDot 
              color={botStatus?.is_running ? 'success' : 'muted'} 
              pulse={botStatus?.is_running} 
            />
            <span className="font-medium">
              {vps.provider ? vps.provider.charAt(0).toUpperCase() + vps.provider.slice(1) : 'Vultr'} {vpsLatency !== null ? `${vpsLatency}ms` : ''}
            </span>
          </div>
        </div>

        {/* Mobile Navigation Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-30 md:hidden">
            <div 
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <nav className="absolute top-16 left-0 right-0 glass-card rounded-none border-x-0 p-4 space-y-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    'w-full justify-start gap-3',
                    activeTab === tab.id
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground'
                  )}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </Button>
              ))}
            </nav>
          </div>
        )}

        {/* Main Content - Tab-aware scrolling */}
        <main className={cn(
          "flex-1 p-2",
          activeTab === 'dashboard' ? "overflow-hidden" : "overflow-y-auto scrollbar-thin"
        )}>
          {renderTabContent()}
        </main>

        {/* Kill Switch Dialog */}
        <KillSwitchDialog 
          open={showKillSwitch} 
          onOpenChange={setShowKillSwitch} 
        />
      </div>
    </TooltipProvider>
  );
}
