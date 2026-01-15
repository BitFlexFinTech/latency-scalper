import WebSocket from "ws";
import { exec } from "child_process";
import { promisify } from "util";
import config from "./config.js";

const execAsync = promisify(exec);
const state = {};

function restartConnectors(reason) {
  console.log(`[WATCHDOG] Restarting connectors: ${reason}`);
  exec(config.restartCommand, (err) => {
    if (err) {
      console.error("[WATCHDOG] Restart failed:", err);
    } else {
      console.log("[WATCHDOG] Restart command executed successfully");
    }
  });
}

function monitorExchange(exchange) {
  const ws = new WebSocket(exchange.wsUrl);

  state[exchange.name] = {
    lastMessage: Date.now(),
    lastLatency: 0,
    connected: false
  };

  ws.on("open", () => {
    console.log(`[WATCHDOG] Connected to ${exchange.name}`);
    state[exchange.name].connected = true;
    state[exchange.name].lastMessage = Date.now();
  });

  ws.on("message", () => {
    const now = Date.now();
    const latency = now - state[exchange.name].lastMessage;

    state[exchange.name].lastMessage = now;
    state[exchange.name].lastLatency = latency;

    if (latency > config.maxLatencyMs) {
      restartConnectors(`${exchange.name} latency too high: ${latency}ms`);
    }
  });

  ws.on("close", () => {
    console.log(`[WATCHDOG] ${exchange.name} WebSocket closed`);
    state[exchange.name].connected = false;
    restartConnectors(`${exchange.name} WebSocket closed`);
  });

  ws.on("error", (err) => {
    console.error(`[WATCHDOG] ${exchange.name} WebSocket error:`, err.message);
    state[exchange.name].connected = false;
    restartConnectors(`${exchange.name} WebSocket error: ${err.message}`);
  });

  // Store WebSocket reference for cleanup
  state[exchange.name].ws = ws;
}

function startWatchdog() {
  console.log("[WATCHDOG] Starting latency watchdog...");
  console.log(`[WATCHDOG] Monitoring exchanges: ${config.exchanges.map(e => e.name).join(", ")}`);

  config.exchanges.forEach(monitorExchange);

  setInterval(() => {
    const now = Date.now();

    for (const ex of config.exchanges) {
      const s = state[ex.name];
      if (!s) continue;

      const silence = now - s.lastMessage;

      if (silence > config.maxSilenceMs) {
        restartConnectors(`${ex.name} stale ticker: ${silence}ms silence`);
        // Reset lastMessage to prevent repeated restarts
        s.lastMessage = now;
      }
    }
  }, config.heartbeatIntervalMs);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[WATCHDOG] Shutting down gracefully...");
    Object.values(state).forEach(s => {
      if (s.ws && s.ws.readyState === WebSocket.OPEN) {
        s.ws.close();
      }
    });
    process.exit(0);
  });
}

startWatchdog();
