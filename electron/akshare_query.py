#!/usr/bin/env python3
import os, sys, json, argparse, threading
from datetime import datetime, timezone

os.environ.setdefault('TQDM_DISABLE', '1')
# Do NOT redirect stderr to /dev/null — the Node IPC layer captures stderr
# and includes it in error messages. Silencing it makes crashes invisible.

INDEX_LIST = [
    ('sh000001', 'SSE Composite'),
    ('sz399001', 'SZSE Component'),
    ('sz399006', 'ChiNext'),
]

# ─── Per-call timeout wrapper ─────────────────────────────────────────────────
# AKShare HTTP requests may hang indefinitely when the upstream server is slow.
# This wraps any call in a daemon thread and raises TimeoutError after `secs`.

def _timed(fn, *args, secs=25, **kwargs):
    """Run fn(*args, **kwargs) in a thread; raise TimeoutError after `secs` seconds."""
    result, err = [None], [None]
    def _run():
        try:
            result[0] = fn(*args, **kwargs)
        except Exception as e:
            err[0] = e
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(secs)
    if t.is_alive():
        raise TimeoutError(f'{fn.__name__} timed out after {secs}s')
    if err[0]:
        raise err[0]
    return result[0]

def main():
    p = argparse.ArgumentParser(add_help=False)
    p.add_argument('--mode', default='snapshot')
    p.add_argument('--symbol', default='')
    p.add_argument('--period', default='daily')
    p.add_argument('--start', default='')
    p.add_argument('--end', default='')
    p.add_argument('--adjust', default='qfq')
    a = p.parse_args()
    try:
        import akshare as ak
    except ImportError:
        print(json.dumps({'error': 'akshare not installed'}), flush=True); sys.exit(1)
    if a.mode == 'kline': _index_kline(ak, a)
    elif a.mode == 'stock_kline': _stock_kline(ak, a)
    elif a.mode == 'stock_kline_min': _stock_kline_min(ak, a)
    elif a.mode == 'intraday': _intraday(ak, a)
    else: _snapshot(ak)

def _snapshot(ak):
    try:
        df = _timed(ak.stock_zh_index_spot_sina, secs=25)
        if df is None or df.empty:
            print(json.dumps({'error': 'empty'})); sys.exit(1)
        df.columns = [str(c).strip() for c in df.columns]
        now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        out = []
        for sym, name in INDEX_LIST:
            r = df[df['代码'] == sym]
            if r.empty: continue
            r = r.iloc[0]
            price = _f(r.get('最新价'))
            if price is None: continue
            out.append({
                'symbol': sym.upper(), 'name': name, 'price': round(price, 2),
                'change': round(_f(r.get('涨跌额')) or 0, 2),
                'changePercent': round(_f(r.get('涨跌幅')) or 0, 2),
                'updatedAt': now
            })
        if not out: print(json.dumps({'error': 'no data'})); sys.exit(1)
        print(json.dumps({'source': 'market.akshare.index_spot', 'updatedAt': now, 'indices': out}, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)})); sys.exit(1)

_ICOL = {
    'date': '日期', 'open': '开盘', 'close': '收盘',
    'high': '最高', 'low': '最低',
    'volume': '成交量', 'amount': '成交额'
}
_SCOL = {
    'date': '日期', 'open': '开盘', 'close': '收盘',
    'high': '最高', 'low': '最低',
    'volume': '成交量', 'amount': '成交额',
    'pct_chg': '涨跌幅', 'change': '涨跌额',
    'turnover': '换手率'
}

def _index_kline(ak, a):
    try:
        raw = a.symbol.lower().strip()
        period = a.period.lower() or 'daily'
        sd = a.start.replace('-', '') or '19900101'
        ed = a.end.replace('-', '') or '20991231'
        if not raw: print(json.dumps({'error': 'kline needs --symbol'})); sys.exit(1)
        # Use stock_zh_index_daily_em as primary — index_zh_a_hist is unreliable/slow
        df = _fallback_em(ak, raw, period, sd, ed)
        if df is None or df.empty:
            print(json.dumps({'error': f'no kline for {raw}'})); sys.exit(1)
        bars = _to_bars(df)
        now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        print(json.dumps({'source': 'market.akshare.index_kline', 'symbol': raw.upper(),
                          'period': period, 'updatedAt': now, 'bars': bars}, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)})); sys.exit(1)

def _fallback_em(ak, symbol, period, sd, ed):
    try:
        import pandas as pd
        df = _timed(ak.stock_zh_index_daily_em, symbol=symbol, start_date=sd, end_date=ed, secs=25)
        if df is None or df.empty: return None
        df.columns = [str(c).strip() for c in df.columns]
        # Rename Chinese column headers → English so _resample and _to_bars work uniformly
        df = df.rename(columns={v: k for k, v in _ICOL.items() if v in df.columns})
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        if period == 'weekly': df = _resample(df, 'W-FRI')
        elif period == 'monthly': df = _resample(df, 'ME')
        return df
    except Exception as e:
        import traceback; traceback.print_exc()
        return None

def _stock_kline(ak, a):
    try:
        raw = a.symbol.lower().strip()
        period = a.period.lower() or 'daily'
        sd = a.start.replace('-', '') or '20100101'
        ed = a.end.replace('-', '') or '20991231'
        adj = a.adjust.strip() if hasattr(a, 'adjust') and a.adjust else 'qfq'
        if not raw: print(json.dumps({'error': 'stock_kline needs --symbol'})); sys.exit(1)
        num = raw[2:] if raw[:2] in ('sh', 'sz') else raw
        df = _timed(ak.stock_zh_a_hist, symbol=num, period=period,
                    start_date=sd, end_date=ed, adjust=adj, timeout=20, secs=25)
        if df is None or df.empty:
            print(json.dumps({'error': f'no stock kline for {raw}'})); sys.exit(1)
        df.columns = [str(c).strip() for c in df.columns]
        df = df.rename(columns={v: k for k, v in _SCOL.items() if v in df.columns})
        bars = _to_bars(df)
        now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        print(json.dumps({'source': 'market.akshare.stock_kline', 'symbol': num,
                          'period': period, 'adjust': adj, 'updatedAt': now, 'bars': bars}, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)})); sys.exit(1)

def _stock_kline_min(ak, a):
    """Minute K-line via stock_zh_a_hist_min_em (5/15/30/60 min periods)."""
    try:
        raw = a.symbol.lower().strip()
        period = a.period.strip() or '60'
        # Date format for min API: 'YYYY-MM-DD HH:MM:SS'
        def _to_min_dt(s, time_str):
            if not s: return None
            s = s.replace('-', '')
            if len(s) == 8:
                return f'{s[:4]}-{s[4:6]}-{s[6:]} {time_str}'
            return None
        sd = _to_min_dt(a.start, '09:30:00') or '2010-01-01 09:30:00'
        ed = _to_min_dt(a.end,   '15:00:00') or '2099-12-31 15:00:00'
        if not raw: print(json.dumps({'error': 'stock_kline_min needs --symbol'})); sys.exit(1)
        num = raw[2:] if raw[:2] in ('sh', 'sz') else raw
        df = _timed(ak.stock_zh_a_hist_min_em, symbol=num, period=period,
                    start_date=sd, end_date=ed, adjust='', secs=30)
        if df is None or df.empty:
            print(json.dumps({'error': f'no min kline for {raw}/{period}'})); sys.exit(1)
        import pandas as pd
        df.columns = [str(c).strip() for c in df.columns]
        # Rename: 时间→date, 开盘→open, 收盘→close, 最高→high, 最低→low, 成交量→volume
        rename = {'时间': 'date', '开盘': 'open', '收盘': 'close',
                  '最高': 'high', '最低': 'low', '成交量': 'volume'}
        df = df.rename(columns=rename)
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)
        bars = _to_bars(df)
        now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        print(json.dumps({'source': 'market.akshare.stock_kline_min', 'symbol': num,
                          'period': period, 'updatedAt': now, 'bars': bars}, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'error': str(e)})); sys.exit(1)

def _to_bars(df):
    df.columns = [str(c).strip() for c in df.columns]
    bars = []
    for _, row in df.iterrows():
        dv = row.get('date'); o = _f(row.get('open')); h = _f(row.get('high'))
        l = _f(row.get('low')); c = _f(row.get('close')); v = _f(row.get('volume'))
        if None in (dv, o, h, l, c): continue
        ds = _nd(dv)
        if not ds: continue
        ts = int(datetime.strptime(ds, '%Y-%m-%d').replace(tzinfo=timezone.utc).timestamp() * 1000)
        bars.append({'timestamp': ts, 'tradingDate': ds,
                     'open': round(o, 2), 'high': round(h, 2), 'low': round(l, 2),
                     'close': round(c, 2), 'volume': int(v) if v is not None else 0})
    return bars

def _intraday(ak, a):
    """
    分时 K 线 — 使用新浪 stock_zh_a_minute 接口。
    同时支持 A 股股票和指数，支持 1/5/15/30/60 分钟，可选复权。
    接口本身只返回最近交易日的数据，无需传日期参数。

    参数：
      --symbol  sh600519 / sh000001 / sz399001 (含交易所前缀)
                纯数字代码 000001 也接受，默认补 sh 前缀
      --period  1 | 5 | 15 | 30 | 60  (默认 1)
      --adjust  '' | qfq | hfq        (默认 '')
    """
    try:
        import pandas as pd
        raw = a.symbol.lower().strip()
        period = a.period.strip() or '1'
        adjust = (a.adjust.strip() if hasattr(a, 'adjust') and a.adjust else '') or ''
        if not raw:
            print(json.dumps({'error': 'intraday needs --symbol'})); sys.exit(1)

        # stock_zh_a_minute requires sh/sz prefix.
        # If the caller passes a pure numeric code, infer prefix:
        #   000xxx / 001xxx / 002xxx / 003xxx / 300xxx → sz
        #   600xxx / 601xxx / 603xxx / 605xxx / 688xxx → sh
        sym = raw
        if sym.isdigit() or (len(sym) == 6 and sym[:3].isdigit()):
            if sym.startswith(('000', '001', '002', '003', '300', '399')):
                sym = 'sz' + sym
            else:
                sym = 'sh' + sym

        df = _timed(ak.stock_zh_a_minute, symbol=sym, period=period, adjust=adjust, secs=30)

        if df is None or df.empty:
            print(json.dumps({'error': f'no intraday data for {sym}/{period}'})); sys.exit(1)

        df.columns = [str(c).strip() for c in df.columns]
        # Columns: day, open, high, low, close, volume
        df = df.rename(columns={'day': 'date'})
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date').reset_index(drop=True)

        # Keep only the latest trading day's bars
        latest_date = df['date'].dt.date.max()
        df = df[df['date'].dt.date == latest_date].reset_index(drop=True)

        if df.empty:
            print(json.dumps({'error': f'no intraday bars for {sym}/{period}'})); sys.exit(1)

        trading_date = latest_date.strftime('%Y-%m-%d')

        bars = []
        for _, row in df.iterrows():
            dv = row.get('date')
            o = _f(row.get('open')); h = _f(row.get('high'))
            l = _f(row.get('low'));  c = _f(row.get('close')); v = _f(row.get('volume'))
            if None in (dv, o, h, l, c): continue
            ds = str(dv)[:19]  # 'YYYY-MM-DD HH:MM:SS'
            ts = int(pd.Timestamp(dv).timestamp() * 1000)
            bars.append({'timestamp': ts, 'datetime': ds,
                         'open': round(o, 2), 'high': round(h, 2),
                         'low': round(l, 2), 'close': round(c, 2),
                         'volume': int(v) if v is not None else 0})

        now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        print(json.dumps({'source': 'market.akshare.intraday', 'symbol': sym,
                          'period': period, 'tradingDate': trading_date,
                          'updatedAt': now, 'bars': bars}, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        import traceback; traceback.print_exc()
        print(json.dumps({'error': str(e)})); sys.exit(1)

def _resample(df, rule):
    import pandas as pd
    df = df.set_index('date')
    r = df.resample(rule).agg({'open': 'first', 'high': 'max', 'low': 'min',
                               'close': 'last', 'volume': 'sum'}).dropna(subset=['open', 'close'])
    return r.reset_index()

def _nd(value):
    if value is None: return ''
    s = str(value).split('T')[0].split(' ')[0].strip()
    if len(s) == 8 and s.isdigit(): return f'{s[:4]}-{s[4:6]}-{s[6:]}'
    if len(s) == 10 and s[4] == '-': return s
    return ''

def _f(value):
    if value is None: return None
    try:
        f = float(value); return None if f != f else f
    except (TypeError, ValueError): return None

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(json.dumps({'error': f'unhandled: {e}'}), flush=True)
        sys.exit(1)
