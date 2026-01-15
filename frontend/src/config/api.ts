/**
 * Central API Configuration
 * Single source of truth for all API endpoints
 */

// Determine API base URL based on environment
function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Production: Running on VPS
  if (hostname === '107.191.61.107') {
    return 'http://107.191.61.107:3001';
  }
  
  // Development: localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // Default: assume same server, use same hostname but port 3001
  return `${protocol}//${hostname}:3001`;
}

export const API_BASE_URL = getApiBaseUrl();

// API Endpoints
export const API_ENDPOINTS = {
  // Bot Control
  BOT_START: '/api/bot/start',
  BOT_STOP: '/api/bot/stop',
  BOT_STATUS: '/api/bot/status',
  
  // System Status
  SYSTEM_STATUS: '/api/system/status',
  HEALTH: '/api/health',
} as const;

// Full API URLs
export const API_URLS = {
  botStart: `${API_BASE_URL}${API_ENDPOINTS.BOT_START}`,
  botStop: `${API_BASE_URL}${API_ENDPOINTS.BOT_STOP}`,
  botStatus: `${API_BASE_URL}${API_ENDPOINTS.BOT_STATUS}`,
  systemStatus: `${API_BASE_URL}${API_ENDPOINTS.SYSTEM_STATUS}`,
  health: `${API_BASE_URL}${API_ENDPOINTS.HEALTH}`,
} as const;

// Log API configuration on module load (always in browser for debugging)
if (typeof window !== 'undefined') {
  console.log('[API Config] Base URL:', API_BASE_URL);
  console.log('[API Config] API URLs:', API_URLS);
  console.log('[API Config] Hostname:', window.location.hostname);
  console.log('[API Config] Protocol:', window.location.protocol);
}
