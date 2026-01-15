# Monitoring Stack (Grafana + Prometheus)

This folder contains a full observability suite for Latency-Scalper.

## Components

- **Prometheus** - Metrics database
- **Grafana** - Visualization dashboards
- **Node Exporter** - System metrics (CPU, RAM, disk, network)
- **Backend Exporter** - Custom metrics (API latency, bot status, connector health)

## Start

```bash
cd /opt/latency_scalper_dashboard/ops/monitoring
docker compose up -d
```

## Start Backend Exporter

```bash
cd /opt/latency_scalper_dashboard/ops/monitoring
pm2 start backend_exporter.js --name backend_exporter
pm2 save
```

## Install Node Exporter (Optional)

```bash
sudo useradd -rs /bin/false node_exporter
wget https://github.com/prometheus/node_exporter/releases/latest/download/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvf node_exporter-*.tar.gz
sudo cp node_exporter-*/node_exporter /usr/local/bin/

# Create systemd service
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=default.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now node_exporter
```

## Access Grafana

- **URL**: http://107.191.61.107:3000
- **User**: admin
- **Password**: admin (change on first login)

## Add Prometheus as Data Source

1. Go to Configuration → Data Sources
2. Add Prometheus
3. URL: `http://prometheus:9090` (or `http://localhost:9090` if not using Docker)

## Metrics Available

### Backend Exporter Metrics

- `latency_scalper_api_latency_ms` - API response latency by endpoint
- `latency_scalper_ws_status` - WebSocket status
- `latency_scalper_connector_health` - Connector health
- `latency_scalper_supabase_status` - Supabase connection status
- `latency_scalper_bot_status` - Bot running status

### Node Exporter Metrics (if installed)

- CPU usage
- Memory usage
- Disk I/O
- Network I/O

## Import Dashboards

Recommended Grafana dashboards:
- Node Exporter Full (ID: 1860)
- Prometheus Stats (ID: 2)

Or create custom dashboards using the backend_exporter metrics.

## Stop

```bash
cd ops/monitoring
docker compose down
pm2 stop backend_exporter
```
