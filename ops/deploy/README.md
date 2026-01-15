# Zero-Downtime Deployment

This module provides atomic, safe deployments for Latency-Scalper.

## Features

- No downtime
- Graceful PM2 reloads
- Automatic rollback on failure
- Pre-deployment environment checks
- Full audit logs

## Usage

### Deploy

```bash
cd /opt/latency_scalper_dashboard
bash ops/deploy/deploy.sh
```

### Rollback

```bash
bash ops/deploy/rollback.sh
```

## Requirements

- PM2 installed and configured
- Git repository initialized
- Node.js installed
- jq installed (optional, for JSON parsing)

## What it does

1. **Precheck** - Validates environment and backend health
2. **Pull Code** - Updates codebase from Git
3. **Build** - Rebuilds frontend with latest dependencies
4. **Install** - Updates backend dependencies
5. **Reload** - Gracefully reloads services (zero downtime)
6. **Verify** - Checks backend health after deployment
7. **Rollback** - Automatically rolls back if health check fails

## Guarantees

- No downtime during deployment
- No dropped WebSocket connections (PM2 reload maintains state)
- No connector interruptions
- Automatic recovery on failure
