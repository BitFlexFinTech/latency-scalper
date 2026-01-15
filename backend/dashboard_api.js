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

// FIXED: Comprehensive system status endpoint - SIMPLIFIED
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

    // 2. Get connected exchanges from exchange_connections (with ALL columns to check for balances)
    console.log('[API] Fetching active exchanges with all columns...');
    const { data: exchangesRaw, error: exchangesError } = await supabase
      .from('exchange_connections')
      .select('*')
      .eq('is_active', true);

    if (exchangesError) {
      console.error('[API] Error fetching exchanges:', exchangesError);
    }

    const activeExchanges = exchangesRaw || [];
    console.log('[API] Active exchanges found:', activeExchanges.length);
    
    // 3. Try to get CURRENT balances from exchange_connections first (most accurate)
    // Check for common balance column names
    let exchangeBalances = new Map();
    let balancesFromConnections = false;
    
    if (activeExchanges.length > 0) {
      const firstExchange = activeExchanges[0];
      const balanceColumns = ['balance_usdt', 'balance', 'usdt_balance', 'total_balance', 'available_balance'];
      let foundBalanceColumn = null;
      
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
      } else if (latestBalanceSnapshot) {
        console.log('[API] Balance snapshot time:', latestBalanceSnapshot.snapshot_time);
        const breakdown = latestBalanceSnapshot.exchange_breakdown || [];
        breakdown.forEach(item => {
          if (item && item.exchange && item.balance !== undefined) {
            // Normalize exchange name (handle variations: OKX, okx, Okx, etc.)
            const exchangeName = String(item.exchange).toLowerCase().trim();
            exchangeBalances.set(exchangeName, Number(item.balance));
          }
        });
        console.log('[API] Balances loaded from balance_history:', Array.from(exchangeBalances.entries()));
      }
    }

    if (exchangesError) {
      console.error('[API] Error fetching exchanges:', exchangesError);
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
      const venue = l.venue?.toLowerCase();
      if (venue && !latencyMap.has(venue)) {
        latencyMap.set(venue, l.latency_ms);
      }
    });

    // 6. Build exchange list with balance and latency
    // Improved exchange name matching to handle case variations
    const exchangeList = activeExchanges.map(ex => {
      const exchangeNameDisplay = ex.exchange_name || ex.name || '';
      const exchangeNameLower = String(exchangeNameDisplay).toLowerCase().trim();
      
      // Try multiple matching strategies for balance lookup
      let balance = null;
      
      // Strategy 1: Exact lowercase match
      balance = exchangeBalances.get(exchangeNameLower);
      
      // Strategy 2: Try variations (okx, binance, etc.)
      if (balance === undefined || balance === null) {
        const variations = [
          exchangeNameLower,
          exchangeNameLower.replace(/[^a-z0-9]/g, ''), // Remove special chars
          exchangeNameDisplay.toLowerCase().replace(/\s+/g, ''), // Remove spaces
        ];
        
        for (const variant of variations) {
          if (exchangeBalances.has(variant)) {
            balance = exchangeBalances.get(variant);
            console.log(`[API] Matched balance for ${exchangeNameDisplay} using variant: ${variant} = ${balance}`);
            break;
          }
        }
      }
      
      // Strategy 3: Try matching against all keys (fuzzy match)
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

    // 7. Build response
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
      totalBalance,
      latencySamples: response.latency.recent,
      trades24h: response.trades.last24h,
      responseTime: response.responseTime
    });
    console.log('[API] ========================================');

    res.json(response);
      console.log('[API] ========================================');
      console.log('[API] DISCOVERED COLUMNS:', availableColumns.join(', '));
      console.log('[API] Total rows found:', allExchangesRaw.length);
      console.log('[API] ========================================');
      console.log('[API] First row sample (all data):', JSON.stringify(firstRow, null, 2));
      console.log('[API] ========================================');
      
      // Log all column values to help debug balance location
      console.log('[API] All column values from first exchange:');
      Object.entries(firstRow).forEach(([key, value]) => {
        console.log(`[API]   ${key}: ${value} (type: ${typeof value})`);
      });
      
      // Find balance column by checking all numeric columns that might be balance
      const balanceColumnNames = ['balance_usdt', 'balance', 'usdt_balance', 'usd_balance', 'total_balance', 'available_balance', 'free_balance'];
      let foundBalanceColumn = null;
      
      // First try exact matches
      for (const colName of balanceColumnNames) {
        if (availableColumns.includes(colName)) {
          foundBalanceColumn = colName;
          console.log('[API] Found balance column (exact match):', colName);
          break;
        }
      }
      
      // If no exact match, look for any column with "balance" in the name
      if (!foundBalanceColumn) {
        for (const colName of availableColumns) {
          if (colName.toLowerCase().includes('balance')) {
            foundBalanceColumn = colName;
            console.log('[API] Found balance column (contains "balance"):', colName);
            break;
          }
        }
      }
      
      // If still no balance column, look for any numeric column that might be a balance
      if (!foundBalanceColumn) {
        for (const colName of availableColumns) {
          const value = firstRow[colName];
          if (typeof value === 'number' && value > 0 && colName.toLowerCase() !== 'id' && !colName.includes('time') && !colName.includes('date')) {
            foundBalanceColumn = colName;
            console.log('[API] Found potential balance column (numeric):', colName, 'value:', value);
            break;
          }
        }
      }
      
      // Filter for is_active if column exists
      let filtered = allExchangesRaw;
      if (availableColumns.includes('is_active')) {
        filtered = allExchangesRaw.filter(e => e.is_active !== false && e.is_active !== 'false' && e.is_active !== 0);
        console.log('[API] Filtered by is_active:', filtered.length, 'exchanges');
      }
      
      // Map to ensure consistent field names and normalize balance
      exchanges = filtered.map(e => {
        const result = { ...e }; // Start with all original fields
        
        // Normalize exchange name
        if (availableColumns.includes('exchange_name')) {
          result.exchange_name = e.exchange_name;
        } else if (availableColumns.includes('name')) {
          result.exchange_name = e.name;
        } else if (availableColumns.includes('venue')) {
          result.exchange_name = e.venue;
        }
        
        // Normalize balance - use found column or try common names
        if (foundBalanceColumn && e[foundBalanceColumn] !== undefined) {
          const balanceValue = e[foundBalanceColumn];
          result.balance_usdt = balanceValue;
          result.balance = balanceValue;
          result.usdt_balance = balanceValue;
          result[foundBalanceColumn] = balanceValue; // Keep original too
        } else {
          // Try to find balance in common locations
          const balance = e.balance_usdt || e.balance || e.usdt_balance || e.usd_balance || e.total_balance || null;
          if (balance !== null) {
            result.balance_usdt = balance;
            result.balance = balance;
            result.usdt_balance = balance;
          }
        }
        
        return result;
      });
      
      console.log('[API] Processed exchanges:', exchanges.length);
      if (exchanges.length > 0) {
        console.log('[API] Sample exchange data:', JSON.stringify(exchanges[0], null, 2));
      }
    } else {
      console.log('[API] No exchanges found in table');
      exchanges = [];
      availableColumns = [];
    }

    // Filter for connected exchanges
    // REAL DATA ONLY - use actual is_connected values, or balance > 0 as indicator
    console.log('[API] Total exchanges before filter:', exchanges.length);
    
    // Find the actual balance column from the data (already discovered above)
    let actualBalanceColumn = null;
    const balanceColumnNames = ['balance_usdt', 'balance', 'usdt_balance', 'usd_balance', 'total_balance', 'available_balance', 'free_balance'];
    
    // Check if we already found it in the exchanges data
    if (exchanges.length > 0) {
      const firstExchange = exchanges[0];
      // Try exact matches first
      for (const colName of balanceColumnNames) {
        if (firstExchange[colName] !== undefined) {
          actualBalanceColumn = colName;
          break;
        }
      }
      // If not found, look for any column with "balance" in name
      if (!actualBalanceColumn) {
        for (const colName of Object.keys(firstExchange)) {
          if (colName.toLowerCase().includes('balance')) {
            actualBalanceColumn = colName;
            break;
          }
        }
      }
    }
    
    console.log('[API] Using balance column:', actualBalanceColumn || 'none found');
    console.log('[API] Exchange raw data (REAL):', JSON.stringify(exchanges.slice(0, 5).map(e => {
      const exchangeName = e.exchange_name || e.name || e.venue || 'unknown';
      let balance = null;
      if (actualBalanceColumn && e[actualBalanceColumn] !== undefined) {
        balance = e[actualBalanceColumn];
      } else {
        balance = e.balance_usdt || e.balance || e.usdt_balance || e.usd_balance || e.total_balance || null;
      }
      return {
        exchange_name: exchangeName,
        is_connected: e.is_connected,
        is_active: e.is_active,
        last_ping_at: e.last_ping_at || null,
        balance: balance,
        all_columns: Object.keys(e).join(', ')
      };
    }), null, 2));
    
    const connectedExchanges = exchanges.filter(e => {
      const exchangeName = e.exchange_name || e.name || e.venue || 'unknown';
      
      // Get balance from actual column if found, otherwise try common names
      let balance = null;
      if (actualBalanceColumn && e[actualBalanceColumn] !== undefined && e[actualBalanceColumn] !== null) {
        balance = e[actualBalanceColumn];
      } else {
        // Fallback: try normalized fields first, then common names
        balance = e.balance_usdt || e.balance || e.usdt_balance || e.usd_balance || e.total_balance || null;
        
        // If still null, try to find any numeric field that might be balance
        if (balance === null) {
          for (const key of Object.keys(e)) {
            if (key.toLowerCase().includes('balance') && typeof e[key] === 'number' && e[key] > 0) {
              balance = e[key];
              console.log(`[API] Found balance in unexpected column for ${exchangeName}: ${key} = ${balance}`);
              break;
            }
          }
        }
      }
      
      const hasBalance = balance !== null && balance !== undefined && Number(balance) > 0;
      
      // If is_connected column doesn't exist, use balance as indicator
      const hasIsConnectedColumn = availableColumns.includes('is_connected') && 'is_connected' in e;
      
      if (!hasIsConnectedColumn) {
        const connected = hasBalance; // If has balance, assume connected
        console.log(`[API] No is_connected column, ${exchangeName}: hasBalance=${hasBalance} (balance=${balance}) -> connected=${connected}`);
        return connected;
      }
      
      // Log actual value for debugging
      const actualValue = e.is_connected;
      const valueType = typeof actualValue;
      const isActive = e.is_active === true || e.is_active === 'true' || e.is_active === 1;
      const hasRecentPing = e.last_ping_at && (() => {
        try {
          const pingTime = new Date(e.last_ping_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
          return pingTime > fiveMinutesAgo;
        } catch (err) {
          return false;
        }
      })();
      console.log(`[API] Exchange ${exchangeName}: is_connected=${actualValue} (type: ${valueType}), is_active=${isActive}, last_ping_at=${e.last_ping_at || 'null'}, hasRecentPing=${hasRecentPing}, balance=${balance}, hasBalance=${hasBalance}`);
      
      // Handle all possible true values
      const isConnectedFlag = actualValue === true || 
                             actualValue === 'true' || 
                             actualValue === 1 ||
                             actualValue === '1' ||
                             String(actualValue).toLowerCase() === 'true';
      
      // If is_connected is explicitly false or 'false', check balance as fallback
      const isExplicitlyFalse = actualValue === false || 
                                actualValue === 'false' || 
                                actualValue === 0 ||
                                actualValue === '0' ||
                                String(actualValue).toLowerCase() === 'false';
      
      // Include if:
      // 1. is_connected is true OR
      // 2. is_active is true (exchange is configured and active) OR
      // 3. has recent ping (exchange is actually responding) OR
      // 4. has balance (if balance column exists)
      let shouldInclude = false;
      let reason = '';
      
      if (isConnectedFlag) {
        shouldInclude = true;
        reason = 'is_connected is true';
      } else if (isActive) {
        shouldInclude = true;
        reason = 'is_active is true (exchange is active - REAL DATA)';
      } else if (hasRecentPing) {
        shouldInclude = true;
        reason = `has recent ping (last_ping_at: ${e.last_ping_at} - REAL DATA)`;
      } else if (hasBalance) {
        shouldInclude = true;
        reason = 'has balance > 0 (real indicator of connection - REAL DATA)';
      } else if (actualValue === null || actualValue === undefined) {
        // If is_connected is null/undefined, check other indicators
        if (isActive || hasRecentPing) {
          shouldInclude = true;
          reason = 'is_connected is null but is_active or has recent ping (assuming connected - REAL DATA)';
        } else {
          shouldInclude = false;
          reason = 'is_connected is null/undefined and no other indicators (excluding)';
        }
      } else if (isExplicitlyFalse) {
        // Even if is_connected is false, check other indicators
        if (isActive || hasRecentPing || hasBalance) {
          shouldInclude = true;
          reason = `is_connected is false but has other indicators (is_active=${isActive}, recent_ping=${hasRecentPing}, balance=${hasBalance} - REAL DATA)`;
        } else {
          shouldInclude = false;
          reason = 'is_connected is explicitly false and no other indicators (excluding)';
        }
      } else {
        shouldInclude = false;
        reason = `is_connected has unexpected value: ${actualValue}`;
      }
      
      console.log(`[API] ${shouldInclude ? 'Including' : 'Excluding'} ${exchangeName}: ${reason}`);
      return shouldInclude;
    });
    
    console.log('[API] Total exchanges:', exchanges.length);
    console.log('[API] Connected exchanges after filter:', connectedExchanges.length);
    console.log('[API] Connected exchange details:', connectedExchanges.map(e => ({
      name: e.exchange_name || e.name,
      is_connected: e.is_connected,
      is_active: e.is_active,
      balance: e.balance_usdt || e.balance || e.usdt_balance || 'N/A'
    })));
    
    // Get latest latency for each connected exchange from latency_logs (REAL DATA ONLY)
    let exchangesWithLatency = connectedExchanges;
    if (connectedExchanges.length > 0) {
      console.log('[API] Fetching REAL latency data from latency_logs for', connectedExchanges.length, 'connected exchanges...');
      const { data: latencyData, error: latencyFetchError } = await supabase
        .from('latency_logs')
        .select('venue, latency_ms, ts')
        .order('ts', { ascending: false })
        .limit(50);
      
      if (latencyFetchError) {
        console.error('[API] Error fetching latency data:', latencyFetchError);
      } else {
        const latencyCount = (latencyData && Array.isArray(latencyData)) ? latencyData.length : 0;
        console.log('[API] Found', latencyCount, 'REAL latency samples');
      }
      
      // Create a map of latest latency by exchange name (case-insensitive)
      const latencyMap = new Map();
      if (latencyData && latencyData.length > 0) {
        latencyData.forEach(l => {
          const venue = (l.venue || '').toLowerCase();
          if (venue && !latencyMap.has(venue)) {
            latencyMap.set(venue, l.latency_ms);
          }
        });
        console.log('[API] Latency map created with', latencyMap.size, 'exchanges');
      }
      
      // Get actual balance column name
      const balanceColumnNames = ['balance_usdt', 'balance', 'usdt_balance', 'usd_balance', 'total_balance'];
      const actualBalanceColumn = balanceColumnNames.find(col => availableColumns.includes(col));
      
      // SSOT FIX: Always check balance_history for latest balances (more reliable than exchange_connections)
      // Even if balance_usdt column exists, balance_history is the source of truth for current balances
      // CRITICAL: Force fresh data - no caching, always query latest
      let balanceMap = new Map();
      console.log('[API] ========================================');
      console.log('[API] Fetching FRESH balances from balance_history table (SSOT for balance data)...');
      console.log('[API] Timestamp:', new Date().toISOString());
      console.log('[API] ========================================');
      try {
        // CRITICAL: Always fetch the MOST RECENT snapshot - no caching
        const { data: latestBalance, error: balanceHistoryError } = await supabase
          .from('balance_history')
          .select('exchange_breakdown, snapshot_time, total_balance')
          .order('snapshot_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (balanceHistoryError) {
          console.error('[API] Error fetching from balance_history:', balanceHistoryError);
        } else if (latestBalance && latestBalance.exchange_breakdown) {
          const breakdown = Array.isArray(latestBalance.exchange_breakdown) 
            ? latestBalance.exchange_breakdown 
            : [];
          
          console.log('[API] Latest balance snapshot time:', latestBalance.snapshot_time);
          console.log('[API] Total balance from snapshot:', latestBalance.total_balance);
          console.log('[API] Exchange breakdown:', JSON.stringify(breakdown, null, 2));
          
          breakdown.forEach((item) => {
            try {
              if (item && typeof item === 'object' && item.exchange && item.balance !== undefined && item.balance !== null) {
                // Normalize exchange name (handle case variations: "okx" vs "OKX", "binance" vs "BINANCE")
                const exchangeName = String(item.exchange).toLowerCase().trim();
                const balanceValue = Number(item.balance);
                if (!isNaN(balanceValue) && balanceValue >= 0) {
                  // Allow 0 balances too (they're valid)
                  balanceMap.set(exchangeName, balanceValue);
                  console.log(`[API] Mapped balance for "${exchangeName}": ${balanceValue}`);
                } else {
                  console.log(`[API] Skipping invalid balance for "${exchangeName}": ${item.balance} (not a valid number)`);
                }
              } else {
                console.log(`[API] Skipping invalid breakdown item:`, item);
              }
            } catch (err) {
              console.error(`[API] Error processing breakdown item:`, err, item);
            }
          });
          console.log('[API] Balance map created:', Array.from(balanceMap.entries()));
        } else {
          console.log('[API] No balance_history data found or exchange_breakdown is empty');
        }
      } catch (balanceHistoryError) {
        console.error('[API] Exception fetching from balance_history:', balanceHistoryError);
      }
      
      // Add latency to exchanges and extract balance from correct column
      exchangesWithLatency = connectedExchanges.map(e => {
        const exchangeName = e.exchange_name || e.name || '';
        
        // Get balance from actual column if found, otherwise try common names, then balance_history
        let balance = null;
        if (actualBalanceColumn && e[actualBalanceColumn] !== undefined) {
          balance = e[actualBalanceColumn];
        } else {
          balance = e.balance_usdt || e.balance || e.usdt_balance || e.usd_balance || e.total_balance || null;
        }
        
        // SSOT FIX: Always prefer balance_history over exchange_connections (balance_history is more reliable)
        // Try multiple name variations to match exchange names
        if (balanceMap.size > 0) {
          const exchangeNameLower = exchangeName.toLowerCase().trim();
          let historyBalance = balanceMap.get(exchangeNameLower);
          
          // Try multiple matching strategies for robust exchange name matching
          if (historyBalance === undefined) {
            // Strategy 1: Exact case-insensitive match
            for (const [key, value] of balanceMap.entries()) {
              if (key === exchangeNameLower) {
                historyBalance = value;
                console.log(`[API] Matched balance for ${exchangeName} using exact match "${key}": ${historyBalance}`);
                break;
              }
            }
          }
          
          if (historyBalance === undefined) {
            // Strategy 2: Substring match (either direction)
            for (const [key, value] of balanceMap.entries()) {
              if (key.includes(exchangeNameLower) || exchangeNameLower.includes(key)) {
                historyBalance = value;
                console.log(`[API] Matched balance for ${exchangeName} using substring match "${key}": ${historyBalance}`);
                break;
              }
            }
          }
          
          if (historyBalance === undefined) {
            // Strategy 3: Remove common suffixes/prefixes and try again
            const normalizedExchange = exchangeNameLower.replace(/^(exchange|venue|exchange_|venue_)/i, '').trim();
            if (normalizedExchange !== exchangeNameLower) {
              historyBalance = balanceMap.get(normalizedExchange);
              if (historyBalance !== undefined) {
                console.log(`[API] Matched balance for ${exchangeName} using normalized name "${normalizedExchange}": ${historyBalance}`);
              }
            }
          }
          
          // If found in balance_history, ALWAYS use it (it's the SSOT)
          if (historyBalance !== undefined && historyBalance !== null && !isNaN(Number(historyBalance))) {
            balance = Number(historyBalance);
            console.log(`[API] Using balance from balance_history (SSOT) for ${exchangeName}: ${balance}`);
          } else {
            // Only log if we couldn't find it AND balance is null
            if (balance === null || balance === undefined) {
              console.log(`[API] No balance found in balance_history for ${exchangeName} (tried: ${exchangeNameLower})`);
              console.log(`[API] Available balance_history keys:`, Array.from(balanceMap.keys()));
            } else {
              console.log(`[API] Using balance from exchange_connections for ${exchangeName}: ${balance} (balance_history not available)`);
            }
          }
        }
        
        // Get latency for this exchange (case-insensitive match)
        const exchangeNameLower = exchangeName.toLowerCase();
        const latency = latencyMap.get(exchangeNameLower) || null;
        
        return {
          ...e,
          exchange_name: exchangeName,
          balance: balance !== null && balance !== undefined ? Number(balance) : null,
          latency: latency
        };
      });
      
      console.log('[API] Exchanges with latency and balance (REAL DATA):', exchangesWithLatency.map(e => ({
        name: e.exchange_name,
        balance: e.balance,
        latency: e.latency
      })));
    }
    
    // Get latest latency logs - REAL DATA ONLY (no mock/sample data)
    console.log('[API] Fetching real latency logs from latency_logs table...');
    let latestLatency = []; // Initialize as empty array
    const { data: latencyData, error: latencyError } = await supabase
      .from('latency_logs')
      .select('venue, ts, latency_ms')
      .order('ts', { ascending: false })
      .limit(10);

    if (latencyError) {
      console.error('[API] Error fetching latency:', latencyError);
      // Keep empty array on error - NO MOCK DATA
      latestLatency = [];
    } else if (latencyData) {
      latestLatency = latencyData;
      console.log('[API] Found REAL latency samples:', latestLatency.length);
      if (latestLatency.length > 0) {
        console.log('[API] Latest latency data (REAL):', latestLatency.slice(0, 5).map(l => ({
          venue: l.venue,
          latency_ms: l.latency_ms,
          timestamp: l.ts
        })));
      }
    } else {
      // No data returned - keep empty array
      latestLatency = [];
      console.log('[API] No latency data found in latency_logs table');
    }

    // Get recent trades count
    console.log('[API] Fetching recent trades...');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentTradesCount, error: tradesError } = await supabase
      .from('trade_logs')
      .select('id', { count: 'exact', head: true })
      .gte('entry_time', yesterday);

    if (tradesError) {
      console.error('[API] Error fetching trades:', tradesError);
    } else {
      console.log('[API] Recent trades (24h):', recentTradesCount || 0);
    }

    const response = {
      bot: {
        running: botRunning,
        status: botRunning ? 'running' : 'stopped'
      },
      exchanges: {
        connected: connectedExchanges.length,
        total: (exchanges || []).length,
        list: exchangesWithLatency.map(e => {
          const exchangeName = e.exchange_name || e.name || '';
          // Balance should already be extracted correctly in exchangesWithLatency
          const balance = e.balance !== undefined ? e.balance : (e.balance_usdt || e.usdt_balance || e.usd_balance || e.total_balance || null);
          
          return {
            name: exchangeName,
            latency: e.latency !== undefined ? e.latency : null,
            balance: balance !== null && balance !== undefined ? Number(balance) : null
          };
        })
      },
      latency: {
        recent: (latestLatency && Array.isArray(latestLatency)) ? latestLatency.length : 0,
        samples: (latestLatency && Array.isArray(latestLatency)) ? latestLatency.map(l => ({ venue: l.venue, ms: l.latency_ms, ts: l.ts })) : []
      },
      trades: {
        last24h: recentTradesCount || 0
      },
      vps: {
        online: botRunning && (latestLatency && Array.isArray(latestLatency) && latestLatency.length > 0),
        status: botRunning ? 'active' : 'inactive'
      },
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    };

    console.log('[API] System status response ready:', JSON.stringify(response, null, 2));
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
