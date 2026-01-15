# 🔍 STEP-BY-STEP: Check and Start Bot

## 📍 WHERE TO RUN COMMANDS

- **Mac Terminal** = Run on your Mac computer
- **SSH/VPS** = Run after SSH'ing into your VPS server

---

## STEP 1: Connect to Your VPS

**WHERE:** Mac Terminal

**COMMAND:**
```bash
ssh root@107.191.61.107
```

**WHAT YOU'LL SEE:**
- If first time: "Are you sure you want to continue connecting (yes/no)?" → Type `yes`
- Then: Password prompt → Enter your VPS root password
- Success: You'll see a prompt like `root@your-vps:~#`

**IF IT FAILS:**
- "Permission denied" → Wrong password, try again
- "Connection refused" → VPS might be down, check Vultr dashboard

---

## STEP 2: Check Bot Service Status

**WHERE:** SSH/VPS (after Step 1)

**COMMAND:**
```bash
systemctl status scalper.service
```

**WHAT YOU'LL SEE:**

✅ **IF BOT IS RUNNING:**
```
● scalper.service - Latency Scalper Bot
   Loaded: loaded (/etc/systemd/system/scalper.service; enabled)
   Active: active (running) since [timestamp]
   Main PID: 12345 (python3)
   ...
```

❌ **IF BOT IS STOPPED:**
```
● scalper.service - Latency Scalper Bot
   Loaded: loaded (/etc/systemd/system/scalper.service; enabled)
   Active: inactive (dead) since [timestamp]
   ...
```

**WHAT TO DO:**
- If "active (running)" → Bot is working, go to Step 3
- If "inactive (dead)" → Bot is stopped, go to Step 4

---

## STEP 3: Verify Bot is Actually Running

**WHERE:** SSH/VPS

**COMMAND:**
```bash
systemctl is-active scalper.service
```

**WHAT YOU'LL SEE:**
- ✅ `active` → Bot is running
- ❌ `inactive` → Bot is stopped

---

## STEP 4: Check Bot Logs (See What's Happening)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
journalctl -u scalper.service -n 50 --no-pager
```

**WHAT YOU'LL SEE:**
- Recent log entries from the bot
- Look for:
  - ✅ "Bot started" or "Connected to exchange" → Good signs
  - ❌ "Error", "Failed", "Exception" → Problems
  - "No module named..." → Missing Python packages
  - "Connection refused" → Database/API connection issues

**EXAMPLE GOOD OUTPUT:**
```
Jan 15 10:30:15 vps scalper[12345]: Bot initialized
Jan 15 10:30:16 vps scalper[12345]: Connected to Supabase
Jan 15 10:30:17 vps scalper[12345]: Exchange OKX connected
```

**EXAMPLE BAD OUTPUT:**
```
Jan 15 10:30:15 vps scalper[12345]: ERROR: Failed to connect
Jan 15 10:30:16 vps scalper[12345]: Traceback (most recent call last):
```

---

## STEP 5: Check if Bot Process is Running

**WHERE:** SSH/VPS

**COMMAND:**
```bash
ps aux | grep scalper | grep -v grep
```

**WHAT YOU'LL SEE:**

✅ **IF RUNNING:**
```
root     12345  0.5  2.1  /usr/bin/python3 /opt/latency_scalper/bot.py
```
(You'll see a process with PID number)

❌ **IF NOT RUNNING:**
```
(empty - no output)
```

---

## STEP 6: Start the Bot (If It's Stopped)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
sudo systemctl start scalper.service
```

**WHAT YOU'LL SEE:**
- ✅ Success: No output (command just returns to prompt)
- ❌ Error: Error message will appear

**THEN VERIFY IT STARTED:**
```bash
systemctl is-active scalper.service
```
Should now show: `active`

---

## STEP 7: Check Backend API Status

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 status
```

**WHAT YOU'LL SEE:**

✅ **IF API IS RUNNING:**
```
┌─────┬──────────────┬─────────┬─────────┬──────────┐
│ id  │ name         │ status  │ restart │ uptime   │
├─────┼──────────────┼─────────┼─────────┼──────────┤
│ 0   │ dashboard-api│ online  │ 15      │ 2h       │
└─────┴──────────────┴─────────┴─────────┴──────────┘
```
(Look for `dashboard-api` with status `online`)

❌ **IF API IS NOT RUNNING:**
- `dashboard-api` might be missing
- Or status shows `stopped` or `errored`

---

## STEP 8: Check Backend API Logs

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 logs dashboard-api --lines 20
```

**WHAT YOU'LL SEE:**
- Recent log entries from the API
- Look for:
  - ✅ "Dashboard API server running on port 3001" → Good
  - ✅ "Supabase client initialized" → Good
  - ❌ "Error" or "Failed" → Problems

**EXAMPLE GOOD OUTPUT:**
```
[API] Dashboard API server running on port 3001
[API] Supabase client initialized
[API] GET /api/health - 2026-01-15T10:30:00.000Z
```

**TO EXIT LOGS:**
Press `Ctrl+C`

---

## STEP 9: Test API Health Endpoint

**WHERE:** SSH/VPS

**COMMAND:**
```bash
curl http://localhost:3001/api/health
```

**WHAT YOU'LL SEE:**

✅ **IF API IS WORKING:**
```json
{"status":"ok","timestamp":"2026-01-15T10:30:00.000Z","supabase":"connected"}
```

❌ **IF API IS NOT WORKING:**
- `curl: (7) Failed to connect to localhost port 3001` → API not running
- `curl: (52) Empty reply from server` → API crashed
- No output → API not responding

---

## STEP 10: Test System Status Endpoint

**WHERE:** SSH/VPS

**COMMAND:**
```bash
curl http://localhost:3001/api/system/status | jq
```

**WHAT YOU'LL SEE:**

✅ **IF WORKING:**
```json
{
  "bot": {
    "running": true,
    "status": "running"
  },
  "exchanges": {
    "connected": 2,
    "total": 2,
    "list": [
      {
        "name": "OKX",
        "balance": 1000.50,
        "latency": 45
      }
    ]
  },
  "latency": {
    "recent": 10,
    "samples": [...]
  },
  "trades": {
    "last24h": 5
  },
  "vps": {
    "online": true,
    "status": "active"
  },
  "timestamp": "2026-01-15T10:30:00.000Z",
  "responseTime": 150
}
```

❌ **IF NOT WORKING:**
- Connection error → API not running
- Empty response → API error
- `"bot": {"running": false}` → Bot is stopped

**NOTE:** If `jq` is not installed, run without it:
```bash
curl http://localhost:3001/api/system/status
```

---

## STEP 11: Check if Port 3001 is Open

**WHERE:** SSH/VPS

**COMMAND:**
```bash
netstat -tuln | grep 3001
```

**WHAT YOU'LL SEE:**

✅ **IF PORT IS OPEN:**
```
tcp6       0      0 :::3001                 :::*                    LISTEN
```
or
```
tcp        0      0 0.0.0.0:3001            0.0.0.0:*               LISTEN
```

❌ **IF PORT IS NOT OPEN:**
```
(empty - no output)
```
→ API is not running or not listening on port 3001

---

## STEP 12: Restart Backend API (If Needed)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
pm2 restart dashboard-api
```

**WHAT YOU'LL SEE:**
```
[PM2] Applying action restartProcessId on app [dashboard-api] (ids: 0)
[PM2] [dashboard-api] Restarting
[PM2] [dashboard-api] Restarted
```

**THEN CHECK STATUS:**
```bash
pm2 status
```
Should show `online`

---

## STEP 13: Check Firewall (If API Can't Be Reached)

**WHERE:** SSH/VPS

**COMMAND:**
```bash
sudo ufw status
```

**WHAT YOU'LL SEE:**

✅ **IF PORT 3001 IS ALLOWED:**
```
Status: active

To                         Action      From
--                         ------      ----
3001/tcp                   ALLOW       Anywhere
```

❌ **IF PORT 3001 IS NOT ALLOWED:**
```
Status: active

To                         Action      From
--                         ------      ----
(no 3001 listed)
```

**IF NOT ALLOWED, ADD IT:**
```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

---

## STEP 14: Exit SSH Session

**WHERE:** SSH/VPS

**COMMAND:**
```bash
exit
```

**WHAT YOU'LL SEE:**
- Returns you to your Mac Terminal prompt

---

## 📊 SUMMARY CHECKLIST

After running all steps, you should have:

- [ ] ✅ Bot service status: `active (running)`
- [ ] ✅ Bot process visible in `ps aux`
- [ ] ✅ Bot logs show no errors
- [ ] ✅ Backend API status: `online` in PM2
- [ ] ✅ API health endpoint returns: `{"status":"ok"}`
- [ ] ✅ API system status returns data
- [ ] ✅ Port 3001 is listening
- [ ] ✅ Firewall allows port 3001

---

## 🐛 TROUBLESHOOTING

### Bot Won't Start
```bash
# Check service file
cat /etc/systemd/system/scalper.service

# Check for errors in logs
journalctl -u scalper.service -n 100 --no-pager | grep -i error
```

### API Not Running
```bash
# Start API manually
cd /opt/latency_scalper_dashboard/backend
pm2 start dashboard_api.js --name dashboard-api

# Or if using npm
pm2 start npm --name dashboard-api -- start
```

### No Data in Dashboard
```bash
# Check if bot is writing to database
journalctl -u scalper.service | grep -i "balance\|trade"

# Check Supabase connection
curl http://localhost:3001/api/system/status | jq '.exchanges'
```

---

## 📝 NEXT STEPS

Once everything is running:
1. Open dashboard: `http://107.191.61.107:8080`
2. Check browser console (F12) for errors
3. Verify data is showing (not $0 or "Not Connected")
