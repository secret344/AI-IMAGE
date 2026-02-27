/**
 * useIntradayData — cache-first hook for intraday (分时) bar data.
 *
 * Cache strategy (mirrors useKlineData design):
 *
 *  1. Read bars from IndexedDB immediately → paint UI (zero-latency).
 *  2. Read intraday_cache_meta for [symbol, period, tradingDate].
 *  3. Decide freshness:
 *     a. No meta record → must fetch (first time for this date).
 *     b. Meta exists + market is CLOSED for that date → permanently fresh,
 *        never re-fetch (A-share data for a completed trading day is immutable).
 *     c. Meta exists + market is OPEN (same day, within 09:30–15:00 CST) →
 *        stale if fetchedAt < now - INTRADAY_LIVE_TTL_MS (3 min).
 *     d. Meta exists + fallback guard → stale if fetchedAt < now - INTRADAY_MAX_AGE_MS (24h).
 *  4. If stale: fetch via requestIntraday IPC.
 *     - Persist bars (putIntradayBars), evict old trading-date bars/metas.
 *     - Upsert intraday_cache_meta.
 *  5. If fresh: skip IPC entirely — bars already painted in step 1.
 *
 * The hook requires `latestTradingDate` (YYYY-MM-DD) from TradingDayContext.
 * It stays idle while latestTradingDate is empty (snapshot not yet loaded).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openInvestmentDB,
  INTRADAY_LIVE_TTL_MS,
  INTRADAY_MAX_AGE_MS,
  type DBIntradayBar
} from '@investment/lib/db';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface IntradayBar {
  /** Epoch ms of bar start (includes time component) */
  time: number;
  /** 'YYYY-MM-DD HH:MM:SS' */
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IntradayLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseIntradayDataResult {
  bars: IntradayBar[];
  tradingDate: string;
  status: IntradayLoadStatus;
  error: string | null;
  refresh: () => void;
}

export interface UseIntradayDataOptions {
  symbol: string;
  /** Intraday period: '1' | '5' | '15' | '30' | '60'. Default '1'. */
  period?: DBIntradayBar['period'];
  /**
   * The latest trading date (YYYY-MM-DD) resolved from global state.
   * Pass empty string while still loading — the hook will stay idle.
   */
  latestTradingDate: string;
  /**
   * IPC fetch function. Called only on cache miss or stale cache.
   * Returns the raw API result from AKShare.
   */
  requestIntraday?: (symbol: string, period: string) => Promise<IntradayApiResult>;
  disabled?: boolean;
}

export interface IntradayApiResult {
  source: string;
  symbol: string;
  period: string;
  tradingDate: string;
  updatedAt: string;
  bars: Array<{
    timestamp: number;
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

// ─── Trading-hours helpers ─────────────────────────────────────────────────────

/**
 * Returns true when the A-share market is currently open.
 *
 * Rules (CST = UTC+8):
 *  - Mon–Fri  09:30–11:30  and  13:00–15:00.
 *  - Weekends always closed.
 *  - Public holidays are NOT checked (data-source TTL handles edge cases).
 */
function isMarketOpen(nowMs = Date.now()): boolean {
  const cst = new Date(nowMs + 8 * 60 * 60 * 1000); // shift to UTC+8
  const dow = cst.getUTCDay(); // 0=Sun, 6=Sat
  if (dow === 0 || dow === 6) return false;
  const hhmm = cst.getUTCHours() * 100 + cst.getUTCMinutes();
  return (hhmm >= 930 && hhmm < 1130) || (hhmm >= 1300 && hhmm < 1500);
}

/**
 * Returns true when `tradingDate` is either a past day, or today CST
 * but the market has already closed (past 15:00 CST).
 *
 * When true, the intraday bars for that date are final and permanently cached.
 */
function isTradingDayClosed(tradingDate: string, nowMs = Date.now()): boolean {
  const cst = new Date(nowMs + 8 * 60 * 60 * 1000);
  const todayCST = cst.toISOString().slice(0, 10);
  if (todayCST !== tradingDate) return true; // past day — always closed
  const hhmm = cst.getUTCHours() * 100 + cst.getUTCMinutes();
  return hhmm >= 1500;
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function toIntradayBar(row: DBIntradayBar): IntradayBar {
  return {
    time: row.timestamp,
    datetime: row.datetime,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume
  };
}

// ─── Module-level in-flight dedup ────────────────────────────────────────────
// Prevents two hook instances (e.g. IntradayChart + KlineChart disabled-guard)
// from firing concurrent IPC calls for the same symbol+period+date.
const _inflight = new Set<string>();

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIntradayData(options: UseIntradayDataOptions): UseIntradayDataResult {
  const {
    symbol,
    period = '1',
    latestTradingDate,
    disabled = false
  } = options;

  const [bars,        setBars]        = useState<IntradayBar[]>([]);
  const [tradingDate, setTradingDate] = useState('');
  const [status,      setStatus]      = useState<IntradayLoadStatus>('idle');
  const [error,       setError]       = useState<string | null>(null);

  const requestIntradayRef = useRef(options.requestIntraday);
  useEffect(() => { requestIntradayRef.current = options.requestIntraday; });

  const cancelledRef = useRef(false);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!latestTradingDate) return;
      const flightKey = `${symbol}|${period}|${latestTradingDate}`;
      if (_inflight.has(flightKey)) return;
      _inflight.add(flightKey);

      try {
        const db = await openInvestmentDB();
        const now = Date.now();

        // ── Step 1: paint cached bars immediately (zero-latency) ──────────────
        let effectiveTradingDate = latestTradingDate;
        let cached = await db.getIntradayBars(symbol, period, latestTradingDate);
        if (cached.length === 0) {
          const latestCached = await db.getLatestIntradayBars(symbol, period);
          if (latestCached) {
            effectiveTradingDate = latestCached.tradingDate;
            cached = latestCached.bars;
          }
        }
        if (cached.length > 0 && !cancelledRef.current) {
          setBars(cached.map(toIntradayBar));
          setTradingDate(effectiveTradingDate);
          setStatus('success');
          setError(null);
        } else if (!cancelledRef.current) {
          setStatus('loading');
          setError(null);
        }

        // ── Step 2: decide staleness via intraday_cache_meta ──────────────────
        // Wrapped in try/catch: if the store doesn't exist yet (v5→v6 migration
        // window or stale DB handle from HMR), treat as cache miss and proceed
        // with a fetch rather than crashing.
        let meta = null;
        if (!forceRefresh) {
          try {
            meta = await db.getIntradayCacheMeta(symbol, period, effectiveTradingDate);
          } catch {
            // Store not yet created — will be created on next openInvestmentDB upgrade
          }
        }

        let isStale = true;
        if (meta) {
          if (isTradingDayClosed(effectiveTradingDate, now)) {
            // Market closed for this date — data is immutable, cache permanently valid
            isStale = false;
            console.info(
              `[IntradayData] ${symbol}/${period} ${effectiveTradingDate}: market closed, cache hit (permanent)`
            );
          } else if (isMarketOpen(now)) {
            // Live session: refresh every 3 min
            isStale = now - meta.fetchedAt > INTRADAY_LIVE_TTL_MS;
          } else {
            // Pre/post-market gap: generous 24h fallback
            isStale = now - meta.fetchedAt > INTRADAY_MAX_AGE_MS;
          }
        } else if (cached.length > 0 && isTradingDayClosed(effectiveTradingDate, now)) {
          // Backward compatibility: old cached bars without cache-meta should still
          // be treated as fresh for completed trading days.
          isStale = false;
        }

        const requestIntraday = requestIntradayRef.current;

        if (!isStale) {
          if (!cancelledRef.current) setStatus('success');
          db.close();
          return;
        }

        if (!requestIntraday) {
          if (!cancelledRef.current) { setBars(cached.map(toIntradayBar)); setStatus('success'); }
          db.close();
          return;
        }

        // ── Step 3: fetch from IPC ───────────────────────────────────────────
        console.info(
          `[IntradayData] Fetching ${symbol}/${period} (hasMeta=${!!meta}, date=${effectiveTradingDate}, isOpen=${isMarketOpen(now)})`
        );
        let result: IntradayApiResult;
        try {
          result = await requestIntraday(symbol, period);
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          console.error(`[IntradayData] IPC fetch failed for ${symbol}/${period}:\n${msg}`);
          if (!cancelledRef.current) {
            if (cached.length === 0) setBars([]);
            setStatus('success');
          }
          db.close();
          return;
        }

        if (result.bars.length === 0) {
          if (!cancelledRef.current && cached.length === 0) setBars([]);
          if (!cancelledRef.current) setStatus('success');
          db.close();
          return;
        }

        const fetchedAt = Date.now();
        const dbBars: DBIntradayBar[] = result.bars.map((b) => ({
          symbol,
          period,
          tradingDate: result.tradingDate,
          timestamp: b.timestamp,
          datetime: b.datetime,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume,
          fetchedAt
        }));

        // ── Step 4: persist bars + meta, evict old trading dates ─────────────
        await db.putIntradayBars(dbBars);
        await db.evictIntradayBars(symbol, period, result.tradingDate);

        // Write cache-meta. If the store doesn't exist yet (v5→v6 migration
        // window: stale DB handle opened before DB_VERSION bump), close it,
        // reopen (triggering the upgrade), and retry once.
        const writeMeta = async (handle: Awaited<ReturnType<typeof openInvestmentDB>>) => {
          await handle.putIntradayCacheMeta({
            symbol, period, tradingDate: result.tradingDate, fetchedAt
          });
          await handle.evictIntradayCacheMeta(symbol, period, result.tradingDate);
        };
        try {
          await writeMeta(db);
        } catch {
          // Store missing — force upgrade by closing and reopening
          db.close();
          try {
            const db2 = await openInvestmentDB();
            await writeMeta(db2);
            db2.close();
          } catch {
            // Still failing — non-fatal, next load will retry
          }
        }

        if (!cancelledRef.current) {
          setBars(dbBars.map(toIntradayBar));
          setTradingDate(result.tradingDate);
          setStatus('success');
        }

        db.close();
      } catch (err) {
        if (!cancelledRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[IntradayData] Load failed for ${symbol}/${period}:`, msg);
          setError(msg);
          setStatus('error');
        }
      } finally {
        _inflight.delete(`${symbol}|${period}|${latestTradingDate}`);
      }
    },
    [symbol, period, latestTradingDate]
  );

  useEffect(() => {
    cancelledRef.current = false;
    if (!disabled && latestTradingDate) void load();
    return () => {
      cancelledRef.current = true;
    };
  }, [load, disabled, latestTradingDate]);

  const refresh = useCallback(() => { void load(true); }, [load]);

  return { bars, tradingDate, status, error, refresh };
}
