/**
 * useKlineData — React hook for loading K-line bars with IndexedDB caching.
 *
 * Caching strategy (cache-first, incremental remote fetch):
 *  1. Read all cached bars from IndexedDB — paint UI immediately (zero-latency).
 *  2. Read all DBKlineCacheMeta segments for [symbol, period].
 *  3. Compute gaps:
 *     a. Merge segments into covered ranges.
 *     b. Subtract covered from [reqStart, reqEnd] — uncovered = holes to fill.
 *     c. Tail staleness: if newest segment.fetchedAt < now-KLINE_DAILY_STALE_MS,
 *        push a tail gap so today's bars are refreshed once per session.
 *     d. Minute K: if newest fetchedAt < now-KLINE_MINUTE_TTL_MS, treat entire
 *        cache as expired and full-refetch.
 *  4. For each gap: call requestKline, persist bars + a new DBKlineCacheMeta row.
 *     Even when 0 bars are returned, persist a segment so "already checked" is
 *     recorded — prevents re-fetching on next page visit within the stale window.
 *  5. Re-read merged bars from DB → update UI.
 *  6. Abort in-flight on unmount so stale setState never fires.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  openInvestmentDB,
  KLINE_DAILY_STALE_MS,
  KLINE_MINUTE_TTL_MS,
  type DBKlineBar,
  type DBKlineCacheMeta,
  type KlinePeriod
} from '@investment/lib/db';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface KlineBar {
  /** Epoch ms — used as x-axis value by lightweight-charts */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type KlineLoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseKlineDataResult {
  bars: KlineBar[];
  status: KlineLoadStatus;
  error: string | null;
  /** Manually re-fetch, bypassing stale guards */
  refresh: () => void;
}

export interface UseKlineDataOptions {
  symbol: string;
  period: KlinePeriod;
  /** Requested window start, epoch ms. Default: 1 year ago. */
  startMs?: number;
  /** Requested window end, epoch ms. Default: now. */
  endMs?: number;
  /**
   * Fetch raw bars for a date range from IPC / remote.
   * Return an array of objects compatible with DBKlineBar (without fetchedAt).
   * Return empty array / throw to signal unavailability — hook falls back to cache.
   */
  requestKline?: (
    symbol: string,
    period: KlinePeriod,
    startMs: number,
    endMs: number
  ) => Promise<Omit<DBKlineBar, 'fetchedAt'>[]>;
  /** Skip auto-fetch on mount. Default: false */
  disabled?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toKlineBar(row: DBKlineBar): KlineBar {
  return {
    time: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume
  };
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Minute-level periods — expire entirely after KLINE_MINUTE_TTL_MS. */
const MINUTE_PERIODS = new Set<KlinePeriod>(['5', '15', '30', '60']);

/** Snap epoch ms down to UTC midnight. */
function dayFloor(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/**
 * Compute the list of date-range gaps that still need to be fetched,
 * given an array of already-cached segments and the requested window.
 *
 * All comparisons are day-aligned (UTC midnight) to prevent off-by-one
 * from timestamp rounding.
 *
 * For minute K: if the newest segment's fetchedAt is older than
 * KLINE_MINUTE_TTL_MS the caller is expected to clear the cache and pass
 * an empty segments array, so this function returns a single full gap.
 *
 * Returns an array of {start, end} pairs (may be empty when fully cached).
 */
function computeGaps(
  segments: DBKlineCacheMeta[],
  reqStart: number,
  reqEnd: number,
  now: number,
  period: KlinePeriod,
  forceRefresh: boolean
): Array<{ start: number; end: number }> {
  const today = dayFloor(now);
  const start = dayFloor(reqStart);
  const end   = Math.min(dayFloor(reqEnd), today);

  // Force-refresh: treat entire window as a gap
  if (forceRefresh) return [{ start, end }];

  // ── Minute K: TTL-based full invalidation ──────────────────────────────────
  if (MINUTE_PERIODS.has(period)) {
    const newestFetchedAt = segments.reduce((m, s) => Math.max(m, s.fetchedAt), 0);
    if (now - newestFetchedAt > KLINE_MINUTE_TTL_MS) {
      // Expired — full re-fetch (caller will also clear old cache metas)
      return [{ start, end }];
    }
    // Minute K is always fetched as one contiguous block, so any existing
    // segment means we've already fetched the full requested range.
    return [];
  }

  // ── Daily/weekly/monthly K: incremental gap computation ───────────────────
  // Merge segments (already sorted by segStart ascending) into contiguous ranges
  const covered: Array<[number, number]> = [];
  for (const seg of segments) {
    const s = dayFloor(seg.segStart);
    const e = dayFloor(seg.segEnd);
    if (covered.length === 0 || s > covered[covered.length - 1][1] + DAY_MS) {
      covered.push([s, e]);
    } else {
      covered[covered.length - 1][1] = Math.max(covered[covered.length - 1][1], e);
    }
  }

  // Subtract covered intervals from [start, end]
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = start;
  for (const [cs, ce] of covered) {
    if (cursor > end) break;
    if (cs > cursor) {
      gaps.push({ start: cursor, end: Math.min(cs - DAY_MS, end) });
    }
    cursor = Math.max(cursor, ce + DAY_MS);
  }
  if (cursor <= end) gaps.push({ start: cursor, end });

  // ── Tail staleness: right-edge refresh ────────────────────────────────────
  // Use the segment with the largest segEnd as the tail representative.
  // For daily K, the newest bar is typically today or yesterday.
  // For weekly/monthly K, the newest bar is the last completed week/month end —
  // which can be days/weeks before `end`. Filtering by proximity to `end` would
  // always miss for weekly/monthly, causing permanent re-fetches.
  const tailSeg = segments.length > 0
    ? segments.reduce((best, s) => (s.segEnd > best.segEnd ? s : best))
    : undefined;
  const tailFetchedAt = tailSeg?.fetchedAt ?? 0;
  const tailIsStale   = now - tailFetchedAt > KLINE_DAILY_STALE_MS;

  if (tailIsStale) {
    // Push a tail gap so recent bars are refreshed.
    // Only add if not already included in a structural gap.
    const tailAlreadyCovered = gaps.some((g) => g.end >= end);
    if (!tailAlreadyCovered) {
      gaps.push({ start: end, end });
    }
  }

  return gaps.filter((g) => g.start <= g.end);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useKlineData(options: UseKlineDataOptions): UseKlineDataResult {
  const { symbol, period, disabled = false } = options;

  // Stabilise startMs/endMs via refs so useCallback deps don't change on re-render
  const startMsRef = useRef(options.startMs ?? Date.now() - ONE_YEAR_MS);
  const endMsRef   = useRef(options.endMs   ?? Date.now());
  // Update refs when props change without rebuilding load()
  startMsRef.current = options.startMs ?? Date.now() - ONE_YEAR_MS;
  endMsRef.current   = options.endMs   ?? Date.now();

  const [bars,   setBars]   = useState<KlineBar[]>([]);
  const [status, setStatus] = useState<KlineLoadStatus>('idle');
  const [error,  setError]  = useState<string | null>(null);

  // Stable ref for the requestKline callback — avoids re-triggering the effect
  const requestKlineRef = useRef(options.requestKline);
  useEffect(() => {
    requestKlineRef.current = options.requestKline;
  });

  // Abort guard: set to true on unmount so in-flight setState calls are dropped
  const cancelledRef = useRef(false);
  // Deduplicate concurrent fetches for the same symbol+period
  const fetchingRef = useRef(false);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (!cancelledRef.current) {
        setStatus('loading');
        setError(null);
      }

      const startMs = startMsRef.current;
      const endMs   = endMsRef.current;

      try {
        const db = await openInvestmentDB();

        // ── Step 1: paint cached bars immediately ──────────────────────────────
        const cached = await db.getKlineBars(symbol, period, startMs, endMs);
        if (cached.length > 0 && !cancelledRef.current) {
          setBars(cached.map(toKlineBar));
          // Optimistically mark success — background gap fetch is silent
          setStatus('success');
        }

        const requestKline = requestKlineRef.current;
        if (!requestKline) {
          // No remote fetcher — serve from cache only
          if (!cancelledRef.current) {
            if (cached.length === 0) setBars([]);
            setStatus('success');
          }
          db.close();
          return;
        }

        // ── Step 2: read all cache-segment metadata ────────────────────────────
        const now = Date.now();

        // For minute K: if TTL expired, clear old meta records so computeGaps
        // receives [] and emits a full re-fetch gap.
        if (MINUTE_PERIODS.has(period) && !forceRefresh) {
          const metas = await db.getKlineCacheMetas(symbol, period);
          const newestFetchedAt = metas.reduce((m, s) => Math.max(m, s.fetchedAt), 0);
          if (now - newestFetchedAt > KLINE_MINUTE_TTL_MS) {
            await db.clearKlineCacheMetas(symbol, period);
            await db.sweepKlineBars();
          }
        }

        const segments = forceRefresh ? [] : await db.getKlineCacheMetas(symbol, period);

        // ── Step 3: compute gaps ───────────────────────────────────────────────
        const gaps = computeGaps(segments, startMs, endMs, now, period, forceRefresh);

        if (gaps.length === 0) {
          console.info(
            `[KlineData] ${symbol}/${period} fully cached (${cached.length} bars), no fetch needed`
          );
          if (!cancelledRef.current) setStatus('success');
          db.close();
          return;
        }

        // ── Step 4: fetch each gap ─────────────────────────────────────────────
        let anyNewBars = false;
        for (const gap of gaps) {
          console.info(
            `[KlineData] Fetching gap ${symbol}/${period} ` +
              `${new Date(gap.start).toISOString().slice(0, 10)} → ` +
              `${new Date(gap.end).toISOString().slice(0, 10)}`
          );

          const fetchedAt = Date.now();
          let newBars: DBKlineBar[] = [];

          try {
            const raw = await requestKline(symbol, period, gap.start, gap.end);
            if (raw.length > 0) {
              newBars = raw.map((b) => ({ ...b, fetchedAt }));
              await db.putKlineBars(newBars);
              anyNewBars = true;
            }
          } catch (gapErr) {
            console.warn(`[KlineData] Gap fetch failed for ${symbol}/${period}:`, gapErr);
            // Don't abort — serve from existing cache for this gap
          }

          // ── Step 5: persist cache-meta segment (even for 0 new bars) ────────
          // IMPORTANT: always use gap.start / gap.end as the segment bounds, not
          // the actual bar timestamps. The segment represents "we already queried
          // this date range" — not "bars happen to exist at these timestamps".
          //
          // If we stored the first/last bar timestamp instead, weekly and monthly
          // K-lines would create segments like [Friday, lastFriday] while the
          // next load requests from [Monday, today], producing a perpetual head
          // gap from Monday to Thursday that triggers a backend call every visit.
          await db.addKlineCacheMeta({
            symbol,
            period,
            segStart:  gap.start,
            segEnd:    gap.end,
            fetchedAt: Date.now()
          });
        }

        // ── Step 6: re-read merged bars if anything changed ────────────────────
        if (!cancelledRef.current) {
          if (anyNewBars) {
            const merged = await db.getKlineBars(symbol, period, startMs, endMs);
            setBars(merged.map(toKlineBar));
          }
          setStatus('success');
        }

        db.close();
      } catch (err) {
        if (!cancelledRef.current) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[KlineData] Load failed for ${symbol}/${period}:`, msg);
          setError(msg);
          setStatus('error');
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    // symbol and period are the only true deps — startMs/endMs are read via refs
    [symbol, period]
  );

  useEffect(() => {
    cancelledRef.current = false;
    if (!disabled) void load();

    return () => {
      cancelledRef.current = true;
      fetchingRef.current = false;
    };
  }, [load, disabled]);

  const refresh = useCallback(() => {
    void load(true);
  }, [load]);

  return { bars, status, error, refresh };
}
