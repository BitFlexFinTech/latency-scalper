import { useState, useEffect } from 'react';
import { Server, Activity, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VPSHealthMonitor } from '../panels/VPSHealthMonitor';
import { VPSMonitorPanel } from '../panels/VPSMonitorPanel';
import { VPSLatencyTrendsPanel } from '../panels/VPSLatencyTrendsPanel';
import { VPSBenchmarkPanel } from '../panels/VPSBenchmarkPanel';
import { VPSTerminalPanel } from '../panels/VPSTerminalPanel';
import { VPSDeploymentTimelinePanel } from '../panels/VPSDeploymentTimelinePanel';
import { supabase } from '@/integrations/supabase/client';
import { StatusDot } from '@/components/ui/StatusDot';
import { useSystemStatus } from '@/hooks/useSystemStatus';

export function VPSTab() {
  const { vps } = useSystemStatus();
  const [deployments, setDeployments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDeployments = async () => {
      const { data } = await supabase
        .from('hft_deployments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        setDeployments(data);
      }
      setIsLoading(false);
    };

    fetchDeployments();
  }, []);

  return (
    <div className="space-y-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">VPS Management</h1>
          <p className="text-muted-foreground">Monitor and manage VPS infrastructure</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot 
            color={vps.status === 'running' ? 'success' : vps.status === 'deploying' ? 'warning' : 'muted'} 
            pulse={vps.status === 'running' || vps.status === 'deploying'} 
          />
          <span className="text-sm font-medium">
            {vps.status === 'running' ? 'VPS Running' : vps.status === 'deploying' ? 'Deploying...' : 'VPS Offline'}
          </span>
          {vps.ip && (
            <Badge variant="outline" className="ml-2">
              {vps.ip}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitor">Health Monitor</TabsTrigger>
          <TabsTrigger value="latency">Latency Trends</TabsTrigger>
          <TabsTrigger value="benchmark">Benchmark</TabsTrigger>
          <TabsTrigger value="terminal">Terminal</TabsTrigger>
          <TabsTrigger value="deployment">Deployment</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-4">
          <VPSHealthMonitor />
          <VPSMonitorPanel />
        </TabsContent>

        <TabsContent value="latency" className="space-y-4">
          <VPSLatencyTrendsPanel />
        </TabsContent>

        <TabsContent value="benchmark" className="space-y-4">
          <VPSBenchmarkPanel />
        </TabsContent>

        <TabsContent value="terminal" className="space-y-4">
          <VPSTerminalPanel />
        </TabsContent>

        <TabsContent value="deployment" className="space-y-4">
          <VPSDeploymentTimelinePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
