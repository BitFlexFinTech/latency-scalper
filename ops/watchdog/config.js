export default {
  exchanges: [
    { name: "binance", wsUrl: "wss://stream.binance.com:9443/ws/btcusdt@trade" },
    { name: "okx", wsUrl: "wss://ws.okx.com:8443/ws/v5/public" }
  ],

  maxLatencyMs: 1500,          // Restart if latency exceeds this
  maxSilenceMs: 3000,          // Restart if no messages for this long
  heartbeatIntervalMs: 1000,   // How often to check
  restartCommand: "pm2 restart dashboard-api"  // Restart backend API (which manages connectors)
};
