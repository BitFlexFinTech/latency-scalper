# Simple Deployment - Just Follow These Steps

## Step 1: Copy Files to VPS

**On your Mac, open Terminal and run:**

```bash
cd /Users/tadii
tar -czf dashboard_complete_package.tar.gz dashboard_complete_package/
scp dashboard_complete_package.tar.gz root@107.191.61.107:/tmp/
```

(Enter your VPS password when prompted)

## Step 2: Deploy on VPS

**SSH into your VPS:**

```bash
ssh root@107.191.61.107
```

(Enter your VPS password)

**Then run these commands one by one:**

```bash
cd /opt
tar -xzf /tmp/dashboard_complete_package.tar.gz
mv dashboard_complete_package/* latency_scalper_dashboard/ 2>/dev/null || (mkdir -p latency_scalper_dashboard && mv dashboard_complete_package/* latency_scalper_dashboard/)
cd latency_scalper_dashboard
bash scripts/complete_deployment.sh
```

**Wait for it to finish** (it will take a few minutes to install everything)

## Step 3: Open Dashboard

**Open your web browser and go to:**

```
http://107.191.61.107:8080
```

**That's it! Your dashboard is ready!**

---

## What You'll See

- All tabs from the profit-accelerator dashboard
- Real-time data from your bot
- Start/Stop bot buttons (they work!)
- Charts, tables, and all features
- Everything connected to your new bot's data

## If Something Goes Wrong

Just run this on the VPS to restart everything:

```bash
cd /opt/latency_scalper_dashboard
pm2 restart dashboard-api dashboard-frontend
```

Then refresh your browser.

---

**Your dashboard link: http://107.191.61.107:8080**
