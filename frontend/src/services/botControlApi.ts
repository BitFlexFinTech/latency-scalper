/**
 * Bot Control API Service
 * Handles start/stop/status commands for the trading bot
 */

import { API_URLS, apiFetch, API_TIMEOUTS } from '@/config/api';

export interface BotStatusResponse {
  status: 'running' | 'stopped';
  isRunning: boolean;
}

export interface BotCommandResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * Start the trading bot
 */
export async function startBot(): Promise<BotCommandResponse> {
  try {
    console.log('[botControlApi] Starting bot...');
    
    const data = await apiFetch<BotCommandResponse>(
      API_URLS.botStart,
      {
        method: 'POST',
        signal: AbortSignal.timeout(API_TIMEOUTS.critical),
      }
    );
    
    console.log('[botControlApi] Bot start result:', data);
    return data;
  } catch (error) {
    console.error('[botControlApi] Error starting bot:', error);
    return {
      success: false,
      message: 'Failed to start bot',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stop the trading bot
 */
export async function stopBot(): Promise<BotCommandResponse> {
  try {
    console.log('[botControlApi] Stopping bot...');
    
    const data = await apiFetch<BotCommandResponse>(
      API_URLS.botStop,
      {
        method: 'POST',
        signal: AbortSignal.timeout(API_TIMEOUTS.critical),
      }
    );
    
    console.log('[botControlApi] Bot stop result:', data);
    return data;
  } catch (error) {
    console.error('[botControlApi] Error stopping bot:', error);
    return {
      success: false,
      message: 'Failed to stop bot',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get bot status
 * NOTE: Prefer using the store's systemStatus instead of calling this directly
 */
export async function getBotStatus(): Promise<BotStatusResponse> {
  try {
    console.log('[botControlApi] Fetching bot status...');
    
    const data = await apiFetch<BotStatusResponse>(
      API_URLS.botStatus,
      {
        method: 'GET',
        signal: AbortSignal.timeout(API_TIMEOUTS.default),
      }
    );
    
    console.log('[botControlApi] Bot status:', data);
    return data;
  } catch (error) {
    console.error('[botControlApi] Error fetching bot status:', error);
    return {
      status: 'stopped',
      isRunning: false,
    };
  }
}
