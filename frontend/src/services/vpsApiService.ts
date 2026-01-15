/**
 * VPS Bot Control API Service
 * Stub implementation for components that reference VPS API
 * Note: This is a compatibility layer - the new bot uses botControlApi.ts instead
 */

export interface VpsHealthResponse {
  ok: boolean;
  uptime?: number;
  responseMs: number;
  error?: string;
  cpu?: number;
  ram?: number;
  disk?: number;
}

export interface ExchangePing {
  exchange: string;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface VpsPingResponse {
  success: boolean;
  pings: ExchangePing[];
  responseMs: number;
  error?: string;
}

export interface VpsBotStatus {
  running: boolean;
  uptime?: number;
  lastTrade?: string;
  responseMs: number;
  error?: string;
}

/**
 * Check VPS API health status
 * Stub implementation - returns safe defaults
 */
export async function checkVpsApiHealth(ip?: string): Promise<VpsHealthResponse> {
  // Return safe default - components will show "not available"
  return {
    ok: false,
    responseMs: 0,
    error: 'VPS API health check not available in this configuration'
  };
}

/**
 * Ping all exchanges through VPS
 * Stub implementation - returns empty results
 */
export async function pingVpsExchanges(ip?: string): Promise<VpsPingResponse> {
  // Return safe default - components will show "not available"
  return {
    success: false,
    pings: [],
    responseMs: 0,
    error: 'Exchange ping not available in this configuration'
  };
}

/**
 * Get bot status from VPS
 * Stub implementation - returns safe defaults
 */
export async function getVpsBotStatus(ip?: string): Promise<VpsBotStatus> {
  // Return safe default - components will show "not available"
  return {
    running: false,
    responseMs: 0,
    error: 'VPS bot status not available in this configuration'
  };
}

/**
 * Test all VPS API endpoints
 */
export async function testAllVpsEndpoints(ip?: string): Promise<{
  health: VpsHealthResponse;
  ping: VpsPingResponse;
  botStatus: VpsBotStatus;
  allOk: boolean;
}> {
  const [health, ping, botStatus] = await Promise.all([
    checkVpsApiHealth(ip),
    pingVpsExchanges(ip),
    getVpsBotStatus(ip),
  ]);
  
  return {
    health,
    ping,
    botStatus,
    allOk: false, // Always false for stub implementation
  };
}

// Additional interfaces for compatibility
export interface VpsPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  exchange: string;
}

export interface VpsPositionsResponse {
  success: boolean;
  positions: VpsPosition[];
  responseMs: number;
  error?: string;
}

export interface VpsTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  amount: number;
  pnl?: number;
  timestamp: string;
  exchange: string;
}

export interface VpsTradesResponse {
  success: boolean;
  trades: VpsTrade[];
  responseMs: number;
  error?: string;
}

export interface VpsBalance {
  exchange: string;
  total: number;
  available: number;
  currency: string;
}

export interface VpsBalancesResponse {
  success: boolean;
  balances: VpsBalance[];
  totalUsd: number;
  responseMs: number;
  error?: string;
}

export interface VpsBotControlResponse {
  success: boolean;
  message?: string;
  responseMs: number;
  error?: string;
}

/**
 * Get positions from VPS
 * Stub implementation
 */
export async function getVpsPositions(ip?: string): Promise<VpsPositionsResponse> {
  return {
    success: false,
    positions: [],
    responseMs: 0,
    error: 'VPS positions not available in this configuration'
  };
}

/**
 * Get recent trades from VPS
 * Stub implementation
 */
export async function getVpsTrades(ip?: string): Promise<VpsTradesResponse> {
  return {
    success: false,
    trades: [],
    responseMs: 0,
    error: 'VPS trades not available in this configuration'
  };
}

/**
 * Get balances from VPS
 * Stub implementation
 */
export async function getVpsBalances(ip?: string): Promise<VpsBalancesResponse> {
  return {
    success: false,
    balances: [],
    totalUsd: 0,
    responseMs: 0,
    error: 'VPS balances not available in this configuration'
  };
}

/**
 * Start bot via VPS
 * Stub implementation
 */
export async function startVpsBot(ip?: string): Promise<VpsBotControlResponse> {
  return {
    success: false,
    responseMs: 0,
    error: 'VPS bot control not available - use botControlApi.ts instead'
  };
}

/**
 * Stop bot via VPS
 * Stub implementation
 */
export async function stopVpsBot(ip?: string): Promise<VpsBotControlResponse> {
  return {
    success: false,
    responseMs: 0,
    error: 'VPS bot control not available - use botControlApi.ts instead'
  };
}
