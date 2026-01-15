import { useState, useEffect } from 'react';
import { Brain, Sparkles, Server, Settings, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIMarketUpdatesPanel } from '../panels/AIMarketUpdatesPanel';
import { AIProviderHealthDashboard } from '../panels/AIProviderHealthDashboard';
import { AIProviderRankingPanel } from '../panels/AIProviderRankingPanel';
import { AIDecisionAuditPanel } from '../panels/AIDecisionAuditPanel';
import { supabase } from '@/integrations/supabase/client';
import { StatusDot } from '@/components/ui/StatusDot';
import { useSystemStatus } from '@/hooks/useSystemStatus';

export function AITab() {
  const { ai } = useSystemStatus();
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      const { data } = await supabase
        .from('ai_providers')
        .select('*')
        .order('is_enabled', { ascending: false });
      
      if (data) {
        setProviders(data);
      }
      setIsLoading(false);
    };

    fetchProviders();
  }, []);

  return (
    <div className="space-y-4 p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Configuration</h1>
          <p className="text-muted-foreground">Manage AI providers and market analysis settings</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot color={ai.isActive ? 'success' : 'muted'} pulse={ai.isActive} />
          <span className="text-sm font-medium">
            {ai.isActive ? 'AI Active' : 'AI Inactive'}
          </span>
        </div>
      </div>

      <Tabs defaultValue="market" className="space-y-4">
        <TabsList>
          <TabsTrigger value="market">Market Analysis</TabsTrigger>
          <TabsTrigger value="providers">AI Providers</TabsTrigger>
          <TabsTrigger value="ranking">Provider Ranking</TabsTrigger>
          <TabsTrigger value="audit">Decision Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="market" className="space-y-4">
          <AIMarketUpdatesPanel fullHeight={false} />
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <AIProviderHealthDashboard />
        </TabsContent>

        <TabsContent value="ranking" className="space-y-4">
          <AIProviderRankingPanel />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AIDecisionAuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
