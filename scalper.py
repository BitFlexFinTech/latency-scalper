#!/usr/bin/env python3
import asyncio, aiohttp, time, sys, signal, os
from collections import deque
from datetime import datetime, UTC
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL=os.getenv("SUPABASE_URL","").rstrip("/")
SUPABASE_ANON_KEY=os.getenv("SUPABASE_ANON_KEY","")
SUPABASE_ENABLED=bool(SUPABASE_URL and SUPABASE_ANON_KEY)

SYMBOLS=["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT"]
MAX_TRADES_PER_DAY=250
MAX_DAILY_LOSS_USD=50.0
LATENCY_HISTORY_LEN=200
REFRESH_UI_MS=500
TIME_STOP_SECONDS=180

BINANCE_TIME_URL="https://api.binance.com/api/v3/time"
OKX_TIME_URL="https://www.okx.com/api/v5/public/time"

LATENCY_BANDS=[
    {"name":"aggressive","max_ms":40,"min_spread_pct":0.03,"size_usd":600,"throttle":1.0},
    {"name":"normal","max_ms":70,"min_spread_pct":0.05,"size_usd":550,"throttle":0.9},
    {"name":"cautious","max_ms":85,"min_spread_pct":0.07,"size_usd":500,"throttle":0.7},
    {"name":"defensive","max_ms":9999,"min_spread_pct":0.10,"size_usd":350,"throttle":0.5},
]

class VenueState:
    def __init__(self,name,url,maker_fee,taker_fee):
        self.name=name; self.url=url
        self.maker_fee=maker_fee; self.taker_fee=taker_fee
        self.latency_history=deque(maxlen=LATENCY_HISTORY_LEN)
        self.latency_avg=None; self.latency_max=None
        self.band=LATENCY_BANDS[-1]; self.last_latency_ms=None

class TradeRecord:
    def __init__(self,ts,venue,symbol,side,size_usd,entry_px,exit_px,pnl,dur):
        self.ts=ts; self.venue=venue; self.symbol=symbol; self.side=side
        self.size_usd=size_usd; self.entry_px=entry_px; self.exit_px=exit_px
        self.pnl=pnl; self.dur=dur

venues={
    "BINANCE":VenueState("BINANCE",BINANCE_TIME_URL,-0.0001,0.0004),
    "OKX":VenueState("OKX",OKX_TIME_URL,-0.0001,0.0005),
}

daily_pnl=0.0
daily_trades=0
trades_log=deque(maxlen=50)
start_day=datetime.now(UTC).date()
momentum_buffers={}
latency_queue=asyncio.Queue(maxsize=1000)
trade_queue=asyncio.Queue(maxsize=1000)

def now_ms(): return int(time.time()*1000)

def reset_day():
    global daily_pnl,daily_trades,start_day
    if datetime.now(UTC).date()!=start_day:
        daily_pnl=0.0; daily_trades=0; start_day=datetime.now(UTC).date()

def pick_band(avg_ms):
    for b in LATENCY_BANDS:
        if avg_ms<=b["max_ms"]: return b
    return LATENCY_BANDS[-1]

def latency_update(v,ms):
    v.last_latency_ms=ms; v.latency_history.append(ms)
    v.latency_avg=sum(v.latency_history)/len(v.latency_history)
    v.latency_max=max(v.latency_history)
    v.band=pick_band(v.latency_avg)

def compute_spread_pct(bid,ask):
    mid=(bid+ask)/2.0
    return ((ask-bid)/mid)*100.0 if mid>0 else 0.0

def momentum_ok(buf,eps_pct=0.01):
    if len(buf)<5: return False,0.0
    delta=buf[-1]-buf[0]; base=buf[0]
    pct=(delta/base)*100.0 if base>0 else 0.0
    return abs(pct)>=eps_pct,pct

async def supabase_post(session,table,rows,max_retries=5):
    if not SUPABASE_ENABLED or not rows:
        print(f"Telemetry {table} DISABLED or EMPTY"); return False
    url=f"{SUPABASE_URL}/rest/v1/{table}"
    headers={
        "apikey":SUPABASE_ANON_KEY,
        "Authorization":f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type":"application/json",
        "Prefer":"return=representation"
    }
    backoff=0.5
    for attempt in range(max_retries):
        try:
            async with session.post(url,headers=headers,json=rows,timeout=10) as r:
                if 200<=r.status<300:
                    print(f"Telemetry {table} OK ({len(rows)} rows)"); return True
                print(f"Telemetry {table} ERROR status={r.status} attempt={attempt+1}/{max_retries}")
        except Exception as e:
            print(f"Telemetry {table} EXCEPTION {e} attempt={attempt+1}/{max_retries}")
        await asyncio.sleep(backoff); backoff=min(5.0,backoff*2)
    print(f"Telemetry ERROR: {table} batch failed after {max_retries} retries"); return False

async def telemetry_worker():
    if not SUPABASE_ENABLED:
        print("Telemetry disabled (set SUPABASE_URL and SUPABASE_ANON_KEY)"); return
    async with aiohttp.ClientSession() as session:
        while True:
            latency_batch=[]; trade_batch=[]
            try:
                while not latency_queue.empty() and len(latency_batch)<200:
                    latency_batch.append(await latency_queue.get())
                while not trade_queue.empty() and len(trade_batch)<200:
                    trade_batch.append(await trade_queue.get())
            except Exception as e:
                print(f"Telemetry dequeue EXCEPTION {e}")
            if latency_batch: await supabase_post(session,"latency_logs",latency_batch)
            if trade_batch: await supabase_post(session,"trade_logs",trade_batch)
            await asyncio.sleep(1.0)

async def telemetry_enqueue_latency(venue,ms):
    if SUPABASE_ENABLED:
        try:
            await latency_queue.put({"venue":venue,"latency_ms":int(ms),"ts":datetime.now(UTC).isoformat()})
        except asyncio.QueueFull:
            print("Telemetry WARNING: latency_queue full")

async def telemetry_enqueue_trade(tr:TradeRecord):
    if SUPABASE_ENABLED:
        try:
            await trade_queue.put({
                "venue":tr.venue,"symbol":tr.symbol,"side":tr.side,"size_usd":float(tr.size_usd),
                "entry_px":float(tr.entry_px),"exit_px":float(tr.exit_px),"pnl":float(tr.pnl),
                "dur_seconds":float(tr.dur),"ts":datetime.now(UTC).isoformat()
            })
        except asyncio.QueueFull:
            print("Telemetry WARNING: trade_queue full")

async def measure_latency(session,v):
    t0=now_ms()
    try:
        async with session.get(v.url,timeout=3) as r: await r.text()
        ms=now_ms()-t0; latency_update(v,ms); await telemetry_enqueue_latency(v.name,ms)
    except Exception as e:
        latency_update(v,999); await telemetry_enqueue_latency(v.name,999)
        print(f"Latency measure EXCEPTION {v.name}: {e}")

async def latency_loop():
    async with aiohttp.ClientSession() as s:
        while True:
            reset_day()
            await asyncio.gather(*(measure_latency(s,v) for v in venues.values()))
            await asyncio.sleep(1)

async def fetch_price_binance(session,symbol):
    url=f"https://api.binance.com/api/v3/ticker/bookTicker?symbol={symbol}"
    async with session.get(url,timeout=3) as r:
        j=await r.json(); return float(j["bidPrice"]),float(j["askPrice"])

async def fetch_price_okx(session,symbol):
    okx_symbol=symbol.replace("USDT","-USDT")
    url=f"https://www.okx.com/api/v5/market/ticker?instId={okx_symbol}"
    async with session.get(url,timeout=3) as r:
        j=await r.json(); d=j.get("data",[{}])[0]
        return float(d.get("bidPx",0)),float(d.get("askPx",0))

async def try_trade(session,venue,symbol):
    global daily_pnl,daily_trades
    if daily_pnl<=-MAX_DAILY_LOSS_USD or daily_trades>=MAX_TRADES_PER_DAY: return
    try:
        bid,ask=await (fetch_price_binance(session,symbol) if venue.name=="BINANCE" else fetch_price_okx(session,symbol))
    except Exception as e:
        print(f"Price fetch EXCEPTION {venue.name}:{symbol} {e}"); return
    spread=compute_spread_pct(bid,ask); mid=(bid+ask)/2.0
    band=venue.band
    if spread<band["min_spread_pct"]: return
    key=f"{venue.name}:{symbol}"
    if key not in momentum_buffers: momentum_buffers[key]=deque(maxlen=10)
    momentum_buffers[key].append(mid)
    ok,pct=momentum_ok(momentum_buffers[key],eps_pct=0.01)
    if not ok: return
    size_usd=band["size_usd"]*band["throttle"]
    entry_px=mid; entry_time=time.time()
    hold_s=min(TIME_STOP_SECONDS,2); await asyncio.sleep(hold_s)
    move=0.002 if pct>0 else -0.002
    exit_px=mid*(1+move)
    pnl=(exit_px-entry_px)*(size_usd/mid) if pct>0 else (entry_px-exit_px)*(size_usd/mid)
    tr=TradeRecord(datetime.now(UTC).strftime("%H:%M:%S"),venue.name,symbol,"LONG" if pct>0 else "SHORT",
                   size_usd,entry_px,exit_px,pnl,time.time()-entry_time)
    trades_log.appendleft(tr); daily_trades+=1; daily_pnl+=pnl
    await telemetry_enqueue_trade(tr)

async def scalping_loop():
    async with aiohttp.ClientSession() as s:
        while True:
            reset_day()
            throttle_factor=1.0
            if daily_pnl<0:
                dd=min(1.0,abs(daily_pnl)/MAX_DAILY_LOSS_USD)
                throttle_factor=max(0.4,1.0-dd*0.6)
            tasks=[]
            for v in venues.values():
                venue_bias=v.band["throttle"]*throttle_factor
                for sym in SYMBOLS:
                    if (daily_trades % int(1/max(0.1,venue_bias)))==0:
                        tasks.append(try_trade(s,v,sym))
            if tasks: await asyncio.gather(*tasks)
            await asyncio.sleep(1.0)

def clear(): sys.stdout.write("\033[2J\033[H"); sys.stdout.flush()

def render_ui():
    clear()
    print(f"Latency‑adaptive scalper — {datetime.now(UTC).strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("-"*80)
    for v in venues.values():
        avg=v.latency_avg or 0; mx=v.latency_max or 0; last=v.last_latency_ms or 0
        print(f"{v.name:<8} last={last:.0f}ms avg={avg:.0f}ms max={mx:.0f}ms band={v.band['name']} "
              f"minSpread={v.band['min_spread_pct']:.2f}% sizeUSD≈{v.band['size_usd']} throttle={v.band['throttle']:.2f}")
    print("-"*80)
    print(f"Daily PnL: ${daily_pnl:.2f} | Trades: {daily_trades}/{MAX_TRADES_PER_DAY} | MaxLoss: ${MAX_DAILY_LOSS_USD:.2f}")
    print("-"*80)
    print(f"{'Time':<8} {'Venue':<8} {'Symbol':<10} {'Side':<6} {'SizeUSD':>8} {'Entry':>10} {'Exit':>10} {'PnL':>8} {'Dur(s)':>7}")
    for tr in list(trades_log):
        print(f"{tr.ts:<8} {tr.venue:<8} {tr.symbol:<10} {tr.side:<6} {tr.size_usd:>8.2f} "
              f"{tr.entry_px:>10.2f} {tr.exit_px:>10.2f} {tr.pnl:>8.2f} {tr.dur:>7.1f}")
    print("-"*80)
    if SUPABASE_ENABLED:
        print(f"Telemetry enabled | pending: latency={latency_queue.qsize()} trades={trade_queue.qsize()}")
    else:
        print("Telemetry disabled (set SUPABASE_URL and SUPABASE_ANON_KEY)")
    print("Controls: systemd manages start/stop; dashboard has Start/Stop buttons.")

shutdown_event=asyncio.Event()
def sigint(sig,frame):
    print("\nExiting... flushing telemetry."); shutdown_event.set()
signal.signal(signal.SIGINT,sigint)

async def ui_loop():
    while True:
        render_ui(); await asyncio.sleep(REFRESH_UI_MS/1000.0)

async def main():
    tasks=[
        asyncio.create_task(latency_loop()),
        asyncio.create_task(scalping_loop()),
        asyncio.create_task(ui_loop()),
    ]
    if SUPABASE_ENABLED:
        tasks.append(asyncio.create_task(telemetry_worker()))
    await shutdown_event.wait()
    for t in tasks: t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)

if __name__=="__main__":
    asyncio.run(main())
