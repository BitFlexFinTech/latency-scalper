# Latency Watchdog

This module monitors exchange WebSocket latency and stale ticker conditions.

## Features

- Detects high latency
- Detects stale tickers
- Detects WebSocket disconnects
- Auto-restarts backend API (which manages connectors)
- Logs all events for audit trails

## Start with PM2

```bash
cd /opt/latency_scalper_dashboard
pm2 start ops/watchdog/run.sh --name watchdog
pm2 save
```

## Configuration

Edit `ops/watchdog/config.js` to adjust:

- `maxLatencyMs` - Maximum acceptable latency (default: 1500ms)
- `maxSilenceMs` - Maximum silence before restart (default: 3000ms)
- `heartbeatIntervalMs` - Check interval (default: 1000ms)
- `restartCommand` - Command to restart services (default: `pm2 restart dashboard-api`)

## Exchanges Monitored

- **Binance**: `wss://stream.binance.com:9443/ws/btcusdt@trade`
- **OKX**: `wss://ws.okx.com:8443/ws/v5/public`

## Logs

Watchdog logs are available via PM2:

```bash
pm2 logs watchdog
```

## Stop

```bash
pm2 stop watchdog
pm2 delete watchdog
```
