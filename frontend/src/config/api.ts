/**
 * API Configuration - Single Source of Truth for all API endpoints
 * CRITICAL: All API calls MUST use these URLs
 * NO hardcoded URLs anywhere else in the codebase
 */

// VPS IP - this should match your actual VPS IP
const VPS_IP = '107.191.61.107';
const BACKEND_PORT = 3001;

// Base API URL - always points to the backend API on VPS
const BASE_API_URL = `http://${VPS_IP}:${BACKEND_PORT}/api`;

/**
 * All API endpoints - SINGLE SOURCE OF TRUTH
 * If an endpoint is not listed here, it should not be called
 */
export const API_URLS = {
  // System Status & Health
  systemStatus: `${BASE_API_URL}/system/status`,
  health: `${BASE_API_URL}/health`,
  
  // Bot Control
  botStart: `${BASE_API_URL}/bot/start`,
  botStop: `${BASE_API_URL}/bot/stop`,
  botStatus: `${BASE_API_URL}/bot/status`,
} as const;

/**
 * API Request Configuration
 * These headers ensure NO CACHING and fresh data only
 */
export const API_REQUEST_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
  cache: 'no-store' as RequestCache,
} as const;

/**
 * Polling intervals (in milliseconds)
 * SINGLE SOURCE OF TRUTH for refresh rates
 */
export const POLLING_INTERVALS = {
  systemStatus: 5000,    // 5 seconds - critical system data
  botStatus: 5000,       // 5 seconds - bot running state
  trades: 3000,          // 3 seconds - trade updates
  balances: 5000,        // 5 seconds - balance updates
  latency: 10000,        // 10 seconds - latency monitoring
  health: 30000,         // 30 seconds - API health check
} as const;

/**
 * API timeout configuration
 */
export const API_TIMEOUTS = {
  default: 10000,        // 10 seconds
  health: 5000,          // 5 seconds for health checks
  critical: 15000,       // 15 seconds for critical operations
} as const;

/**
 * Helper function to build URL with cache-busting timestamp
 */
export function buildUrl(baseUrl: string): string {
  const timestamp = Date.now();
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}_t=${timestamp}`;
}

/**
 * Helper function to create fetch request with proper config
 */
export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const urlWithCache = buildUrl(url);
  
  const response = await fetch(urlWithCache, {
    ...API_REQUEST_CONFIG,
    ...options,
    headers: {
      ...API_REQUEST_CONFIG.headers,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
