#!/bin/bash
# Latency Watchdog Runner
# Monitors exchange WebSocket latency and auto-restarts connectors

cd /opt/latency_scalper_dashboard/ops/watchdog || exit 1
node latencyWatchdog.js
