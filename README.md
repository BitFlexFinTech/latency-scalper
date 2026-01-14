# Latency Scalper Bot

A high-frequency trading bot designed for ultra-low-latency arbitrage opportunities between Binance and OKX exchanges.

## Features

- **Real-time Latency Monitoring**: Measures and logs exchange latency in real-time
- **Arbitrage Detection**: Identifies price discrepancies between exchanges
- **Automated Trading**: Executes trades automatically when profitable opportunities are detected
- **Supabase Integration**: Stores trades, latency logs, and exchange connections in Supabase
- **Terminal Dashboard**: Real-time monitoring dashboard with trade statistics
- **Systemd Service**: Runs as a system service for reliable operation

## Tech Stack

- **Language**: Python 3.x
- **Exchanges**: Binance, OKX (via CCXT)
- **Database**: Supabase (PostgreSQL)
- **Monitoring**: Real-time terminal dashboard

## Prerequisites

- Python 3.9+
- Supabase account and project
- Exchange API keys (Binance and/or OKX)
- Ubuntu/Debian Linux (for systemd service)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/latency-scalper.git
cd latency-scalper
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
nano .env
```

Required environment variables:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret
OKX_API_KEY=your_okx_api_key
OKX_SECRET=your_okx_secret
OKX_PASSPHRASE=your_okx_passphrase
```

### 4. Set Up Supabase Tables

Create the following tables in your Supabase project:

- `latency_logs` - Stores exchange latency measurements
- `trade_logs` - Stores executed trades
- `exchange_connections` - Tracks exchange connection status
- `bot_status` - Bot heartbeat and status

(Table schemas will be documented separately)

### 5. Run as Systemd Service (Recommended)

```bash
sudo cp scalper.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scalper.service
sudo systemctl start scalper.service
```

## Usage

### Start the Bot

```bash
sudo systemctl start scalper.service
```

### Stop the Bot

```bash
sudo systemctl stop scalper.service
```

### View Logs

```bash
sudo journalctl -u scalper.service -f
```

### View Dashboard

The bot includes a terminal-based dashboard. Access it via:

```bash
python3 dashboard.py
```

## Configuration

Key configuration options are available in the `.env` file and can be customized for your trading strategy.

## Monitoring

- **Terminal Dashboard**: Real-time terminal UI with trade statistics
- **Supabase**: All trades and latency data stored in Supabase
- **Logs**: Systemd journal logs for debugging

## Web Dashboard

A web-based dashboard is available separately at:
- Frontend: React + TypeScript dashboard
- Backend API: Node.js Express API for bot control

## License

[Your License Here - MIT, Apache 2.0, etc.]

## Contributing

[Contributing guidelines]

## Support

[Support information]

## Disclaimer

This bot is for educational purposes. Trading cryptocurrencies involves risk. Use at your own discretion.
