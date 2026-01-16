#!/usr/bin/env node
// Backend API for dashboard bot control
// This service handles systemd commands for bot start/stop
// Run on VPS with: node dashboard_api.js

import express from 'express';
import { exec } from 'child_process';
import cors from 'cors';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const PORT = 3001; // Backend API port

// CORS configuration - allow frontend origin
const corsOptions = {
  origin: [
    'http://107.191.61.107:8080',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// CRITICAL: Add cache-busting headers to ALL responses - ensure fresh data only
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Initialize Supabase client - read from bot's .env if available
let SUPABASE_URL = 'https://iibdlazwkossyelyroap.supabase.co';
let SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpYmRsYXp3a29zc3llbHlyb2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MzQzNDUsImV4cCI6MjA4MzIxMDM0NX0.xZ0VbkoKzrFLYpbKrUjcvTY-qs-n-A3ynHU-SAluOUQ4';

// Try to read from bot's .env file
try {
  const envPath = '/opt/latency_scalper/.env';
  const envContent = readFileSync(envPath, 'utf-8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
    const match = line.match(/^SUPABASE_URL=(.+)$/);
    if (match) SUPABASE_URL = match[1].trim();
    const matchKey = line.match(/^SUPABASE_ANON_KEY=(.+)$/);
    if (matchKey) SUPABASE_ANON_KEY = matchKey[1].trim();
  }
  console.log('Loaded Supabase credentials from bot .env');
} catch (error) {
  console.log('Using default Supabase credentials (bot .env not found)');
}

let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('Supabase client initialized');
} catch (error) {
  console.error('Failed to initialize Supabase client:', error);
}

// Bot control endpoints
app.post('/api/bot/start', async (req, res) => {
  try {
    await execAsync('sudo systemctl start scalper.service');
    res.json({ success: true, message: 'Bot started' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bot/stop', async (req, res) => {
  try {
    await execAsync('sudo systemctl stop scalper.service');
    res.json({ success: true, message: 'Bot stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/bot/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('systemctl is-active scalper.service');
    const status = stdout.trim();
    res.json({ 
      status: status === 'active' ? 'running' : 'stopped',
      isRunning: status === 'active'
    });
  } catch (error) {
    // If command fails, bot is likely stopped
    res.json({ status: 'stopped', isRunning: false });
  }
});

// System status endpoint - CLEAN IMPLEMENTATION
app.get('/api/system/status', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('[API] ========================================');
    console.log('[API] Fetching system status - FRESH DATA ONLY');
    console.log('[API] Timestamp:', new Date().toISOString());
    console.log('[API] ========================================');
    
    if (!supabase) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    // 1. Get bot status from systemd
    let botRunning = false;
    try {
      const { stdout } = await execAsync('systemctl is-active scalper.service');
      botRunning = stdout.trim() === 'active';
    } catch (error) {
      botRunning = false;
    }
    console.log('[API] Bot status:', botRunning ? 'running' : 'stopped');

    // 2. Get active exchanges from exchange_connections
    console.log('[API] Fetching active exchanges from exchange_connections...');
    const { data: exchangesRaw, error: exchangesError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('is_active', true);

    if (exchangesError) {
      console.error('[API] Error fetching exchanges:', exchangesError);
    }

    const activeExchanges = exchangesRaw || [];
    console.log('[API] Active exchanges found:', activeExchanges.length);

    // 3. Try to get CURRENT balances from exchange_connections first
    let exchangeBalances = new Map();
    let balancesFromConnections = false;
    let foundBalanceColumn = null;
    
    if (activeExchanges.length > 0) {
      const firstExchange = activeExchanges[0];
      const balanceColumns = ['balance_usdt', 'balance', 'usdt_balance', 'total_balance', 'available_balance'];
      
      // Find which balance column exists
      for (const col of balanceColumns) {
        if (firstExchange[col] !== undefined && firstExchange[col] !== null) {
          foundBalanceColumn = col;
          console.log('[API] Found balance column in exchange_connections:', col);
          break;
        }
      }
      
      // If found, use exchange_connections as source (most current)
      if (foundBalanceColumn) {
        balancesFromConnections = true;
        activeExchanges.forEach(ex => {
          const exchangeName = String(ex.exchange_name || ex.name || '').toLowerCase().trim();
          const balance = ex[foundBalanceColumn];
          if (balance !== undefined && balance !== null) {
            exchangeBalances.set(exchangeName, Number(balance));
            console.log(`[API] Balance from exchange_connections: ${exchangeName} = ${balance}`);
          }
        });
        console.log('[API] Using balances from exchange_connections (CURRENT DATA)');
      }
    }
    
    // 4. Fallback: If exchange_connections doesn't have balances, use balance_history
    // BUT: Check snapshot age - if older than 1 hour, warn that data is stale
    if (!balancesFromConnections) {
      console.log('[API] exchange_connections has no balance columns, falling back to balance_history...');
      const { data: latestBalanceSnapshot, error: balanceError } = await supabase
        .from('balance_history')
        .select('exchange_breakdown, total_balance, snapshot_time')
        .order('snapshot_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (balanceError) {
        console.error('[API] Error fetching balance_history:', balanceError);
      } else if (latestBalanceSnapshot && latestBalanceSnapshot.exchange_breakdown) {
        const snapshotTime = new Date(latestBalanceSnapshot.snapshot_time);
        const now = new Date();
        const ageHours = (now - snapshotTime) / (1000 * 60 * 60);
        
        console.log('[API] Balance snapshot time:', latestBalanceSnapshot.snapshot_time);
        console.log('[API] Snapshot age:', ageHours.toFixed(2), 'hours');
        
        if (ageHours > 1) {
          console.warn('[API] WARNING: balance_history snapshot is', ageHours.toFixed(2), 'hours old - data may be stale!');
        }
        
        const breakdown = Array.isArray(latestBalanceSnapshot.exchange_breakdown) 
          ? latestBalanceSnapshot.exchange_breakdown 
          : [];
        
        breakdown.forEach(item => {
          if (item && typeof item === 'object' && item.exchange && item.balance !== undefined && item.balance !== null) {
            const exchangeName = String(item.exchange).toLowerCase().trim();
            const balanceValue = Number(item.balance);
            if (!isNaN(balanceValue) && balanceValue >= 0) {
              exchangeBalances.set(exchangeName, balanceValue);
              console.log(`[API] Balance from balance_history: ${exchangeName} = ${balanceValue} (snapshot age: ${ageHours.toFixed(2)}h)`);
            }
          }
        });
        console.log('[API] Balances loaded from balance_history:', Array.from(exchangeBalances.entries()));
      } else {
        console.warn('[API] No balance_history data found - balances will be 0');
      }
    }

    // 5. Get latest latency samples
    console.log('[API] Fetching latency data...');
    const { data: latencyData, error: latencyError } = await supabase
      .from('latency_logs')
      .select('venue, latency_ms, ts')
      .order('ts', { ascending: false })
      .limit(20);

    if (latencyError) {
      console.error('[API] Error fetching latency:', latencyError);
    }

    const latencySamples = latencyData || [];
    
    // Create latency map (latest per venue)
    const latencyMap = new Map();
    latencySamples.forEach(l => {
      const venue = (l.venue || '').toLowerCase();
      if (venue && !latencyMap.has(venue)) {
        latencyMap.set(venue, l.latency_ms);
      }
    });

    // 6. Build exchange list with balance and latency
    const exchangeList = activeExchanges.map(ex => {
      const exchangeNameDisplay = ex.exchange_name || ex.name || '';
      const exchangeNameLower = String(exchangeNameDisplay).toLowerCase().trim();
      
      // Try multiple matching strategies for balance lookup
      let balance = null;
      
      // Strategy 1: Exact lowercase match
      balance = exchangeBalances.get(exchangeNameLower);
      
      // Strategy 2: Try variations (remove spaces, special chars)
      if (balance === undefined || balance === null) {
        const variations = [
          exchangeNameLower,
          exchangeNameLower.replace(/[^a-z0-9]/g, ''),
          exchangeNameDisplay.toLowerCase().replace(/\s+/g, ''),
        ];
        
        for (const variant of variations) {
          if (exchangeBalances.has(variant)) {
            balance = exchangeBalances.get(variant);
            console.log(`[API] Matched balance for ${exchangeNameDisplay} using variant: ${variant} = ${balance}`);
            break;
          }
        }
      }
      
      // Strategy 3: Fuzzy match (substring)
      if (balance === undefined || balance === null) {
        for (const [key, value] of exchangeBalances.entries()) {
          if (key.includes(exchangeNameLower) || exchangeNameLower.includes(key)) {
            balance = value;
            console.log(`[API] Matched balance for ${exchangeNameDisplay} using fuzzy match: ${key} = ${balance}`);
            break;
          }
        }
      }
      
      // Default to 0 if no match found
      if (balance === undefined || balance === null) {
        balance = 0;
        console.log(`[API] WARNING: No balance found for ${exchangeNameDisplay} (tried: ${exchangeNameLower})`);
        console.log(`[API] Available balance keys:`, Array.from(exchangeBalances.keys()));
      }
      
      const latency = latencyMap.get(exchangeNameLower) || null;
      
      return {
        name: exchangeNameDisplay,
        balance: Number(balance),
        latency
      };
    });

    // 7. Get recent trades count
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: tradesCount } = await supabase
      .from('trade_logs')
      .select('id', { count: 'exact', head: true })
      .gte('entry_time', yesterday);

    // 8. Build response
    const calculatedTotalBalance = exchangeList.reduce((sum, ex) => sum + (ex.balance || 0), 0);
    
    const response = {
      bot: {
        running: botRunning,
        status: botRunning ? 'running' : 'stopped'
      },
      exchanges: {
        connected: activeExchanges.length,
        total: activeExchanges.length,
        list: exchangeList
      },
      latency: {
        recent: latencySamples.length,
        samples: latencySamples.slice(0, 10).map(l => ({
          venue: l.venue,
          ms: l.latency_ms,
          ts: l.ts
        }))
      },
      trades: {
        last24h: tradesCount || 0
      },
      vps: {
        online: botRunning && latencySamples.length > 0,
        status: botRunning ? 'active' : 'inactive'
      },
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    };

    console.log('[API] Response summary:', {
      botRunning: response.bot.running,
      exchangesConnected: response.exchanges.connected,
      totalBalance: calculatedTotalBalance,
      balanceSource: balancesFromConnections ? 'exchange_connections (CURRENT)' : 'balance_history (SNAPSHOT)',
      exchangeBalances: exchangeList.map(ex => `${ex.name}: $${ex.balance}`),
      latencySamples: response.latency.recent,
      trades24h: response.trades.last24h,
      responseTime: response.responseTime
    });
    console.log('[API] ========================================');

    res.json(response);
  } catch (error) {
    console.error('[API] Error fetching system status:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    supabase: supabase ? 'connected' : 'not configured'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`========================================`);
  console.log(`Dashboard API server running on port ${PORT}`);
  console.log(`Supabase: ${SUPABASE_URL ? 'configured' : 'not configured'}`);
  console.log(`Listening on: http://0.0.0.0:${PORT}`);
  console.log(`========================================`);
});
