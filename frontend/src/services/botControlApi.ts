// Bot Control API Service
// Connects to backend API for systemd bot control

import { API_URLS } from '@/config/api';

export interface BotStatus {
  status: 'running' | 'stopped';
  isRunning: boolean;
}

export async function startBot(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[botControlApi] Starting bot:', API_URLS.botStart);
    const response = await fetch(API_URLS.botStart, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('[botControlApi] Start bot result:', result);
    return result;
  } catch (error) {
    console.error('[botControlApi] Error starting bot:', error);
    throw error;
  }
}

export async function stopBot(): Promise<{ success: boolean; message: string }> {
  try {
    console.log('[botControlApi] Stopping bot:', API_URLS.botStop);
    const response = await fetch(API_URLS.botStop, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('[botControlApi] Stop bot result:', result);
    return result;
  } catch (error) {
    console.error('[botControlApi] Error stopping bot:', error);
    throw error;
  }
}

export async function getBotStatus(): Promise<BotStatus> {
  try {
    const response = await fetch(API_URLS.botStatus);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('[botControlApi] Error fetching bot status:', error);
    // Return safe default instead of throwing
    return { status: 'stopped', isRunning: false };
  }
}
