#!/usr/bin/env node
import express from "express";
import fetch from "node-fetch";
import client from "prom-client";

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const apiLatency = new client.Gauge({
  name: "latency_scalper_api_latency_ms",
  help: "API response latency in milliseconds",
  labelNames: ["endpoint"]
});

const wsStatus = new client.Gauge({
  name: "latency_scalper_ws_status",
  help: "WebSocket status (1=connected, 0=disconnected)"
});

const connectorHealth = new client.Gauge({
  name: "latency_scalper_connector_health",
  help: "Connector health (1=healthy, 0=unhealthy)"
});

const supabaseStatus = new client.Gauge({
  name: "latency_scalper_supabase_status",
  help: "Supabase connection status (1=connected, 0=disconnected)"
});

const botStatus = new client.Gauge({
  name: "latency_scalper_bot_status",
  help: "Bot status (1=running, 0=stopped)"
});

register.registerMetric(apiLatency);
register.registerMetric(wsStatus);
register.registerMetric(connectorHealth);
register.registerMetric(supabaseStatus);
register.registerMetric(botStatus);

async function checkAPI() {
  const endpoints = ["/api/health", "/api/bot/status", "/api/system/status"];
  
  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(`http://localhost:3001${endpoint}`);
      const latency = Date.now() - start;
      apiLatency.set({ endpoint }, latency);
      
      if (endpoint === "/api/health") {
        const data = await res.json();
        supabaseStatus.set(data.supabase === "connected" ? 1 : 0);
      }
      
      if (endpoint === "/api/bot/status") {
        const data = await res.json();
        botStatus.set(data.isRunning ? 1 : 0);
      }
      
      if (endpoint === "/api/system/status") {
        connectorHealth.set(res.ok ? 1 : 0);
      }
    } catch (error) {
      apiLatency.set({ endpoint }, -1);
      console.error(`[EXPORTER] Error checking ${endpoint}:`, error.message);
    }
  }
}

async function checkWS() {
  // WebSocket status check - placeholder
  // In a full implementation, this would check actual WebSocket connectivity
  try {
    wsStatus.set(1); // Assume connected if backend is up
  } catch {
    wsStatus.set(0);
  }
}

// Initial check
checkAPI();
checkWS();

// Regular checks every 2 seconds
setInterval(checkAPI, 2000);
setInterval(checkWS, 2000);

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = 9200;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[EXPORTER] Backend exporter running on port ${PORT}`);
});
