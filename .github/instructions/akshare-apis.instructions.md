---
applyTo: "electron/**/*.py,electron/**/*.cjs,packages/investment/src/**"
---

# AKShare A-Share Market API Reference

This file documents the AKShare Python interfaces used in `electron/akshare_query.py`
for the investment sub-app. Always consult this when modifying data-fetching logic.

---

## 1. `stock_zh_a_hist` — Individual A-share Stock K-line (日/周/月)

**Source**: 东方财富 (Eastmoney)  
**Use for**: `period = 'daily' | 'weekly' | 'monthly'` candlestick bars for a single stock.

```python
df = ak.stock_zh_a_hist(
    symbol="000001",          # Pure 6-digit code, no sh/sz prefix
    period="daily",           # MUST be 'daily' | 'weekly' | 'monthly' — NOT '5'/'15'/'30'/'60'
    start_date="20170301",    # Format: YYYYMMDD (no dashes)
    end_date="20240528",      # Format: YYYYMMDD (no dashes)
    adjust="qfq"              # '' | 'qfq' (前复权) | 'hfq' (后复权)
)
```

**Output columns**:

| Column | Type    | Notes               |
|--------|---------|---------------------|
| 日期     | object  | Trading date        |
| 股票代码   | object  | Code without market prefix |
| 开盘     | float64 | Open                |
| 收盘     | float64 | Close               |
| 最高     | float64 | High                |
| 最低     | float64 | Low                 |
| 成交量    | int64   | Volume (unit: 手)    |
| 成交额    | float64 | Turnover (unit: 元)  |
| 振幅     | float64 | Amplitude (%)       |
| 涨跌幅    | float64 | Change %            |
| 涨跌额    | float64 | Change amount (元)   |
| 换手率    | float64 | Turnover rate (%)   |

**Key constraints**:
- `symbol` must be pure numeric (e.g. `"000001"`, `"600519"`) — strip any `sh`/`sz` prefix before calling.
- `period` only accepts `'daily'`, `'weekly'`, `'monthly'`. Minute periods are **not supported** — use `stock_zh_a_hist_min_em` instead.
- Date format is `YYYYMMDD` (8 digits, no dashes) for both `start_date` and `end_date`.

---

## 2. `stock_zh_a_hist_min_em` — Individual A-share Stock Minute K-line

**Source**: 东方财富 (Eastmoney)  
**Use for**: Intraday minute-level bars (`'1'`, `'5'`, `'15'`, `'30'`, `'60'`).

```python
df = ak.stock_zh_a_hist_min_em(
    symbol="000001",
    start_date="2024-03-20 09:30:00",   # Format: 'YYYY-MM-DD HH:MM:SS' (with time, NOT YYYYMMDD)
    end_date="2024-03-20 15:00:00",
    period="5",                          # '1' | '5' | '15' | '30' | '60'
    adjust=""                            # '' | 'qfq' | 'hfq'; 1-minute data cannot be adjusted
)
```

**Output columns for period ≠ '1'**:

| Column | Type    | Notes            |
|--------|---------|------------------|
| 时间     | object  | Datetime string  |
| 开盘     | float64 | Open             |
| 收盘     | float64 | Close            |
| 最高     | float64 | High             |
| 最低     | float64 | Low              |
| 涨跌幅    | float64 | Change %         |
| 涨跌额    | float64 | Change amount    |
| 成交量    | float64 | Volume (手)       |
| 成交额    | float64 | Turnover (元)     |
| 振幅     | float64 | Amplitude %      |
| 换手率    | float64 | Turnover rate %  |

**Key constraints**:
- Date format is `'YYYY-MM-DD HH:MM:SS'` — completely different from `stock_zh_a_hist`.
- 1-minute data returns only the last 5 trading days and **cannot be adjusted**.
- This API is **separate** from `stock_zh_a_hist` and **must be called explicitly** for minute periods.

---

## 3. `stock_zh_a_spot_em` — Real-time A-share Snapshot (All Stocks)

**Use for**: Live prices for all ~5600 A-share stocks.

```python
df = ak.stock_zh_a_spot_em()
```

**Key output columns**: 序号, 代码, 名称, 最新价, 涨跌幅, 涨跌额, 成交量, 成交额, 振幅, 最高, 最低, 今开, 昨收, 量比, 换手率, 市盈率-动态, 市净率, 总市值, 流通市值, 涨速, 5分钟涨跌, 60日涨跌幅, 年初至今涨跌幅

---

## 4. `index_zh_a_hist` — A-share Index K-line (日/周/月)

**Use for**: K-line bars for major indices like 上证综指 (`000001`), 深证成指 (`399001`).

```python
df = ak.index_zh_a_hist(
    symbol="000001",      # Pure numeric, strip sh/sz prefix
    period="daily",       # 'daily' | 'weekly' | 'monthly'
    start_date="20200101",
    end_date="20240101"
)
```

**Output columns**: 日期, 开盘, 收盘, 最高, 最低, 成交量, 成交额, 振幅, 涨跌幅, 涨跌额, 换手率

---

## 5. `stock_zh_index_spot_sina` — Real-time Index Snapshot (新浪)

**Use for**: Live prices for major indices — used in `_snapshot()` mode.

```python
df = ak.stock_zh_index_spot_sina()
# Key columns: 代码 (e.g. 'sh000001'), 名称, 最新价, 涨跌额, 涨跌幅
```

Index codes use lowercase with market prefix: `sh000001` (上证), `sz399001` (深证), `sz399006` (创业板).

---

## 6. `stock_zh_index_daily_em` — Index Daily K-line fallback (东方财富)

**Use for**: Fallback when `index_zh_a_hist` fails. Used in `_fallback_em()`.

```python
df = ak.stock_zh_index_daily_em(
    symbol="sh000001",    # Must include sh/sz prefix
    start_date="20200101",
    end_date="20240101"
)
# Output columns: date, open, close, high, low, volume
```

---

## Implementation Map (`akshare_query.py` modes)

| `--mode`      | Python function       | AKShare API                  | Period values              |
|---------------|-----------------------|------------------------------|----------------------------|
| `snapshot`    | `_snapshot()`         | `stock_zh_index_spot_sina`   | n/a                        |
| `kline`       | `_index_kline()`      | `stock_zh_index_daily_em` (primary, with threading timeout) | `daily` / `weekly` / `monthly` |
| `stock_kline` | `_stock_kline()`      | `stock_zh_a_hist`            | `daily` / `weekly` / `monthly` |
| `stock_kline` | `_stock_kline_min()`  | `stock_zh_a_hist_min_em`     | `5` / `15` / `30` / `60`  |
| `intraday`    | `_intraday()`         | `stock_zh_a_minute` (Sina)   | `1` / `5` / `15` / `30` / `60` |

> **`index_zh_a_hist` is NOT used** — it is unreliable and hangs without a timeout causing the
> Electron IPC 120s wall-clock timeout. All index K-line goes through `stock_zh_index_daily_em`
> which is wrapped with `_timed(..., secs=25)` threading timeout.

> **All AKShare HTTP calls must be wrapped with `_timed(fn, *args, secs=25, **kwargs)`** to
> prevent indefinite hangs. The Electron wall-clock timeout is 120s; each AKShare call must
> fail within 25s so there is time for fallbacks and JSON output before the process is killed.

---

## Symbol Conventions (Frontend → Python)

| Type       | Frontend `KlinePeriod` | Python `--mode`   | Symbol format      |
|------------|------------------------|-------------------|--------------------|
| Index      | `daily/weekly/monthly` | `kline`           | `sh000001` (lowercase, with prefix) |
| Stock day  | `daily/weekly/monthly` | `stock_kline`     | `000001` (pure numeric, **no prefix**) |
| Stock min  | `5/15/30/60`           | `stock_kline`     | `000001` (pure numeric, **no prefix**) |
| Intraday   | `1/5/15/30/60`         | `intraday`        | Any format — `sh000001` or `000001` both work; `_intraday()` strips `sh`/`sz` prefix internally |

The Python script strips `sh`/`sz` from the symbol before passing to `index_zh_a_hist` or `stock_zh_a_hist`.
Minute K always strips prefix (stocks only, indices have no minute API in this app).
