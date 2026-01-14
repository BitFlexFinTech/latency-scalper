#!/usr/bin/env python3
import os, sys, asyncio, aiohttp, subprocess, time
from datetime import datetime, UTC, timedelta
from dotenv import load_dotenv
from tabulate import tabulate

load_dotenv()
SUPABASE_URL=os.getenv("SUPABASE_URL","").rstrip("/")
SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY","")
if not (SUPABASE_URL and SUPABASE_ANON_KEY):
    print("Dashboard ERROR: Supabase credentials missing in env/.env"); sys.exit(1)

HEADERS={"apikey":SUPABASE_ANON_KEY,"Authorization":f"Bearer {SUPABASE_ANON_KEY}"}

def clear(): sys.stdout.write("\033[2J\033[H"); sys.stdout.flush()

def svc_status():
    try:
        r=subprocess.run(["systemctl","is-active","scalper.service"],capture_output=True,text=True)
        return r.stdout.strip() or r.stderr.strip()
    except Exception as e:
        return f"status ERROR: {e}"

def start_bot():
    try:
        subprocess.run(["sudo","systemctl","start","scalper.service"],check=True)
        print("Start button: Bot started successfully")
    except Exception as e:
        print(f"Start button ERROR: {e}")

def stop_bot():
    try:
        subprocess.run(["sudo","systemctl","stop","scalper.service"],check=True)
        print("Stop button: Bot stopped successfully")
    except Exception as e:
        print(f"Stop button ERROR: {e}")

async def fetch_json(session, path, params=None):
    url=f"{SUPABASE_URL}/rest/v1/{path}"
    try:
        async with session.get(url, headers=HEADERS, params=params, timeout=10) as r:
            if 200<=r.status<300: return await r.json()
            print(f"Dashboard ERROR: GET {path} status={r.status}"); return []
    except Exception as e:
        print(f"Dashboard EXCEPTION: GET {path} {e}"); return []

async def render_loop():
    async with aiohttp.ClientSession() as session:
        while True:
            since=(datetime.now(UTC)-timedelta(minutes=30)).isoformat()
            lat_params={"select":"venue,latency_ms,ts","ts":"gte."+since,"order":"ts.desc","limit":"500"}
            tr_params={"select":"venue,symbol,side,size_usd,entry_px,exit_px,pnl,dur_seconds,ts","ts":"gte."+since,"order":"ts.desc","limit":"500"}
            lat=await fetch_json(session,"latency_logs",lat_params)
            tr=await fetch_json(session,"trade_logs",tr_params)

            venues=set([x.get("venue","") for x in lat])
            v_stats=[]
            for v in sorted(venues):
                v_lat=[x["latency_ms"] for x in lat if x.get("venue")==v]
                if v_lat:
                    v_stats.append([v,len(v_lat),round(sum(v_lat)/len(v_lat),2),max(v_lat),min(v_lat)])

            tr_symbols=set([x.get("symbol","") for x in tr])
            s_stats=[]
            for s in sorted(tr_symbols):
                s_tr=[x for x in tr if x.get("symbol")==s]
                if s_tr:
                    pnl=sum([float(x.get("pnl",0)) for x in s_tr])
                    count=len(s_tr)
                    avg_pnl=round(pnl/count,4)
                    avg_dur=round(sum([float(x.get("dur_seconds",0)) for x in s_tr])/count,2)
                    s_stats.append([s,count,round(pnl,4),avg_pnl,avg_dur])

            tr_rows=[[x.get("ts","")[:19],x.get("venue",""),x.get("symbol",""),x.get("side",""),
                      round(float(x.get("size_usd",0)),2),round(float(x.get("entry_px",0)),2),
                      round(float(x.get("exit_px",0)),2),round(float(x.get("pnl",0)),4),
                      round(float(x.get("dur_seconds",0)),2)] for x in tr[:40]]

            lat_rows=[[x.get("ts","")[:19],x.get("venue",""),x.get("latency_ms",0)] for x in lat[:40]]

            clear()
            print(f"Latency & Trades Dashboard — {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')} UTC | Bot: {svc_status()}")
            print("="*110)
            print("CARD: Latency summary (last 30 min)")
            print(tabulate(v_stats, headers=["Venue","Samples","Avg(ms)","Max(ms)","Min(ms)"], tablefmt="plain"))
            print("="*110)
            print("CARD: Trade summary by symbol (last 30 min)")
            print(tabulate(s_stats, headers=["Symbol","Trades","Total PnL","Avg PnL","Avg Dur(s)"], tablefmt="plain"))
            print("="*110)
            print("TAB: Recent trades")
            print(tabulate(tr_rows, headers=["Time","Venue","Symbol","Side","SizeUSD","Entry","Exit","PnL","Dur(s)"], tablefmt="plain"))
            print("="*110)
            print("TAB: Recent latency samples")
            print(tabulate(lat_rows, headers=["Time","Venue","Latency(ms)"], tablefmt="plain"))
            print("="*110)
            print("Buttons: call start_bot() or stop_bot() in this console to control the bot service.")
            await asyncio.sleep(2.0)

def verify_buttons():
    print("Verifying Start/Stop buttons via systemd...")
    pre=svc_status(); print(f"Initial status: {pre}")
    start_bot(); time.sleep(1.5)
    s1=svc_status(); print(f"After start: {s1}")
    stop_bot(); time.sleep(1.5)
    s2=svc_status(); print(f"After stop: {s2}")
    if s1!="active":
        print("VERIFICATION FAILED: Start button did not activate service.")
    if s2 not in ("inactive","failed","deactivating"):
        print("VERIFICATION WARNING: Stop button did not fully stop service.")
    else:
        print("Button verification completed.")

if __name__=="__main__":
    try:
        verify_buttons()
        asyncio.run(render_loop())
    except KeyboardInterrupt:
        print("\nDashboard exit.")
