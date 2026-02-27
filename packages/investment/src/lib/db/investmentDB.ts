/**
 * InvestmentDB — IndexedDB access layer for the investment sub-app.
 *
 * Usage:
 *   const db = await openInvestmentDB();
 *   await db.putMarketSnapshot(snapshot);
 *   const cached = await db.getMarketSnapshot('akshare.cn_index');
 */

import {
  DB_NAME,
  DB_VERSION,
  STORE,
  KLINE_MAX_BARS,
  KLINE_MINUTE_TTL_MS,
  type DBMarketSnapshot,
  type DBNewsItem,
  type DBQueryLog,
  type DBKlineBar,
  type DBKlineCacheMeta,
  type DBIntradayBar,
  type DBIntradayCacheMeta,
  type KlinePeriod
} from './types';

// ─── TTL constants ─────────────────────────────────────────────────────────────

/** Market snapshots older than this are considered stale (15 min). */
export const MARKET_SNAPSHOT_TTL_MS = 15 * 60 * 1000;

/** News items older than 24 h are swept during periodic cleanup. */
export const NEWS_ITEM_TTL_MS = 24 * 60 * 60 * 1000;

/** Maximum rows kept in query_log (FIFO trim). */
export const QUERY_LOG_MAX_ROWS = 500;

/**
 * Re-export from types for callers that import only from investmentDB.
 * Day/week/month K-line bars are kept permanently (never swept by TTL).
 * Minute K-line bars are swept after KLINE_MINUTE_TTL_MS.
 */
export { KLINE_DAILY_STALE_MS, KLINE_MINUTE_TTL_MS, INTRADAY_LIVE_TTL_MS, INTRADAY_MAX_AGE_MS } from './types';
export type { DBIntradayCacheMeta } from './types';

/** Minute K-line periods — used to decide sweep eligibility. */
const KLINE_MINUTE_PERIODS = new Set<KlinePeriod>(['5', '15', '30', '60']);

// ─── Open / upgrade ────────────────────────────────────────────────────────────

function upgradeDB(db: IDBDatabase, oldVersion: number): void {
  // ── v1 → v2: market_snapshots, news_items, query_log, kline_bars, kline_fetch_range ──
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains(STORE.MARKET_SNAPSHOTS)) {
      const s = db.createObjectStore(STORE.MARKET_SNAPSHOTS, { keyPath: 'feedKey' });
      s.createIndex('fetchedAt', 'fetchedAt');
      s.createIndex('tradingDate', 'tradingDate');
    }
    if (!db.objectStoreNames.contains(STORE.NEWS_ITEMS)) {
      const s = db.createObjectStore(STORE.NEWS_ITEMS, { keyPath: 'id', autoIncrement: true });
      s.createIndex('source', 'source');
      s.createIndex('publishedAt', 'publishedAt');
      s.createIndex('source_dedupe', ['source', 'dedupeKey'], { unique: true });
    }
    if (!db.objectStoreNames.contains(STORE.QUERY_LOG)) {
      const s = db.createObjectStore(STORE.QUERY_LOG, { keyPath: 'id', autoIncrement: true });
      s.createIndex('queryKey', 'queryKey');
      s.createIndex('requestedAt', 'requestedAt');
    }
    if (!db.objectStoreNames.contains(STORE.KLINE_BARS)) {
      const s = db.createObjectStore(STORE.KLINE_BARS, {
        keyPath: ['symbol', 'period', 'timestamp']
      });
      s.createIndex('symbol_period_ts', ['symbol', 'period', 'timestamp']);
      s.createIndex('fetchedAt', 'fetchedAt');
    }
    // kline_fetch_range existed in v2 — created here so v2→v3 migration can drop it
    if (!db.objectStoreNames.contains('kline_fetch_range')) {
      db.createObjectStore('kline_fetch_range', { keyPath: ['symbol', 'period'] });
    }
  }

  // ── v2 → v3: drop kline_fetch_range, create kline_cache_meta ──────────────
  if (oldVersion < 3) {
    if (db.objectStoreNames.contains('kline_fetch_range')) {
      db.deleteObjectStore('kline_fetch_range');
    }
    if (!db.objectStoreNames.contains(STORE.KLINE_CACHE_META)) {
      const s = db.createObjectStore(STORE.KLINE_CACHE_META, {
        keyPath: 'id',
        autoIncrement: true
      });
      s.createIndex('symbol_period', ['symbol', 'period']);
      s.createIndex('fetchedAt', 'fetchedAt');
    }
  }

  // ── v3 → v4: repair — ensure kline_cache_meta exists even if v3 migration ──
  // failed or was skipped (e.g. partial upgrade, manual version bump).
  if (oldVersion < 4) {
    if (db.objectStoreNames.contains('kline_fetch_range')) {
      db.deleteObjectStore('kline_fetch_range');
    }
    if (!db.objectStoreNames.contains(STORE.KLINE_CACHE_META)) {
      const s = db.createObjectStore(STORE.KLINE_CACHE_META, {
        keyPath: 'id',
        autoIncrement: true
      });
      s.createIndex('symbol_period', ['symbol', 'period']);
      s.createIndex('fetchedAt', 'fetchedAt');
    }
  }

  // ── v4 → v5: create intraday_bars store ──────────────────────────────
  if (oldVersion < 5) {
    if (!db.objectStoreNames.contains(STORE.INTRADAY_BARS)) {
      const s = db.createObjectStore(STORE.INTRADAY_BARS, {
        keyPath: ['symbol', 'period', 'timestamp']
      });
      // Range query by [symbol, period, timestamp]
      s.createIndex('symbol_period_ts', ['symbol', 'period', 'timestamp']);
      // Filter by trading date (to read / clear one day at a time)
      s.createIndex('symbol_period_date', ['symbol', 'period', 'tradingDate']);
    }
  }

  // ── v5 → v6: create intraday_cache_meta store ─────────────────────────
  // Records each completed intraday fetch. Enables:
  //   - After-close: cache hit on same tradingDate → never re-fetch.
  //   - During trading hours: re-fetch only if fetchedAt > INTRADAY_LIVE_TTL_MS ago.
  if (oldVersion < 6) {
    if (!db.objectStoreNames.contains(STORE.INTRADAY_CACHE_META)) {
      const s = db.createObjectStore(STORE.INTRADAY_CACHE_META, {
        keyPath: 'id',
        autoIncrement: true
      });
      // Primary lookup: exact [symbol, period, tradingDate]
      s.createIndex('symbol_period_date', ['symbol', 'period', 'tradingDate']);
      // TTL sweep
      s.createIndex('fetchedAt', 'fetchedAt');
    }
  }
}

/** Open (or create) the investment IndexedDB. Returns a typed handle. */
export function openInvestmentDB(): Promise<InvestmentDB> {
  return new Promise<InvestmentDB>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => upgradeDB(req.result, e.oldVersion);
    req.onsuccess = () => resolve(new InvestmentDB(req.result));
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('InvestmentDB blocked by another tab'));
  });
}

// ─── Helper: wrap IDBRequest as Promise ────────────────────────────────────────

function wrapRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── InvestmentDB class ────────────────────────────────────────────────────────

export class InvestmentDB {
  private readonly idb: IDBDatabase;

  constructor(idb: IDBDatabase) {
    this.idb = idb;
  }

  close(): void {
    this.idb.close();
  }

  // ─── market_snapshots ──────────────────────────────────────────────────────

  /**
   * Upsert a market snapshot. Overwrites any previous record for the same feedKey.
   */
  async putMarketSnapshot(snapshot: DBMarketSnapshot): Promise<void> {
    const tx = this.idb.transaction(STORE.MARKET_SNAPSHOTS, 'readwrite');
    await wrapRequest(tx.objectStore(STORE.MARKET_SNAPSHOTS).put(snapshot));
  }

  /**
   * Return the snapshot for `feedKey` if it exists and is still within TTL.
   * Returns `null` if absent or expired.
   */
  async getMarketSnapshot(
    feedKey: string,
    ttlMs: number = MARKET_SNAPSHOT_TTL_MS
  ): Promise<DBMarketSnapshot | null> {
    const tx = this.idb.transaction(STORE.MARKET_SNAPSHOTS, 'readonly');
    const row = await wrapRequest<DBMarketSnapshot | undefined>(
      tx.objectStore(STORE.MARKET_SNAPSHOTS).get(feedKey)
    );
    if (!row) return null;
    if (Date.now() - row.fetchedAt > ttlMs) return null;
    return row;
  }

  /**
   * Delete all market snapshot records older than `ttlMs`.
   * Call during app startup to avoid stale data accumulating.
   */
  async sweepMarketSnapshots(ttlMs: number = MARKET_SNAPSHOT_TTL_MS): Promise<number> {
    const cutoff = Date.now() - ttlMs;
    const tx = this.idb.transaction(STORE.MARKET_SNAPSHOTS, 'readwrite');
    const store = tx.objectStore(STORE.MARKET_SNAPSHOTS);
    const index = store.index('fetchedAt');
    const range = IDBKeyRange.upperBound(cutoff);
    const keys = await wrapRequest<IDBValidKey[]>(index.getAllKeys(range));
    for (const key of keys) {
      store.delete(key);
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return keys.length;
  }

  // ─── news_items ────────────────────────────────────────────────────────────

  /**
   * Insert a news item, silently ignoring duplicates (same source + dedupeKey).
   * Returns the assigned id, or `null` if it was a duplicate.
   */
  async insertNewsItem(item: Omit<DBNewsItem, 'id'>): Promise<number | null> {
    const tx = this.idb.transaction(STORE.NEWS_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE.NEWS_ITEMS);
    // Check for existing deduplication key first
    const existing = await wrapRequest<IDBValidKey | undefined>(
      store.index('source_dedupe').getKey([item.source, item.dedupeKey])
    );
    if (existing !== undefined) return null;
    const id = await wrapRequest<IDBValidKey>(store.add(item));
    return id as number;
  }

  /**
   * Fetch all news items for a given source, sorted by publishedAt descending.
   * Optionally limited to items newer than `sinceMs` epoch ms.
   */
  async getNewsBySource(
    source: string,
    options: { limit?: number; sinceMs?: number } = {}
  ): Promise<DBNewsItem[]> {
    const tx = this.idb.transaction(STORE.NEWS_ITEMS, 'readonly');
    const all = await wrapRequest<DBNewsItem[]>(
      tx.objectStore(STORE.NEWS_ITEMS).index('source').getAll(source)
    );
    let items = all;
    if (options.sinceMs !== undefined) {
      items = items.filter((n) => new Date(n.publishedAt).getTime() >= options.sinceMs!);
    }
    items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    if (options.limit !== undefined) {
      items = items.slice(0, options.limit);
    }
    return items;
  }

  /**
   * Delete news items older than `ttlMs`.
   */
  async sweepNewsItems(ttlMs: number = NEWS_ITEM_TTL_MS): Promise<number> {
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    const tx = this.idb.transaction(STORE.NEWS_ITEMS, 'readwrite');
    const store = tx.objectStore(STORE.NEWS_ITEMS);
    const all = await wrapRequest<DBNewsItem[]>(store.getAll());
    const toDelete = all.filter((n) => n.publishedAt < cutoff);
    for (const item of toDelete) {
      if (item.id !== undefined) store.delete(item.id);
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return toDelete.length;
  }

  // ─── query_log ─────────────────────────────────────────────────────────────

  /**
   * Append a query log entry.
   * Automatically trims the store when it exceeds QUERY_LOG_MAX_ROWS.
   */
  async logQuery(entry: Omit<DBQueryLog, 'id'>): Promise<void> {
    const tx = this.idb.transaction(STORE.QUERY_LOG, 'readwrite');
    const store = tx.objectStore(STORE.QUERY_LOG);
    store.add(entry);
    // Async trim — fire and forget inside same transaction
    const countReq = store.count();
    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count > QUERY_LOG_MAX_ROWS) {
        const overflow = count - QUERY_LOG_MAX_ROWS;
        // Delete oldest `overflow` entries via cursor on requestedAt index
        const cursor = store.index('requestedAt').openCursor();
        let deleted = 0;
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c && deleted < overflow) {
            c.delete();
            deleted++;
            c.continue();
          }
        };
      }
    };
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Look up the most recent log entry for a queryKey.
   * Useful to check: "did we request this in the last N ms?"
   */
  async getLastQueryLog(queryKey: string): Promise<DBQueryLog | null> {
    const tx = this.idb.transaction(STORE.QUERY_LOG, 'readonly');
    const all = await wrapRequest<DBQueryLog[]>(
      tx.objectStore(STORE.QUERY_LOG).index('queryKey').getAll(queryKey)
    );
    if (all.length === 0) return null;
    return all.reduce((a, b) => (a.requestedAt > b.requestedAt ? a : b));
  }

  // ─── kline_bars ────────────────────────────────────────────────────────────

  /**
   * Batch upsert K-line bars. Existing bars with the same [symbol, period, timestamp]
   * are overwritten (ensures latest data always wins).
   */
  async putKlineBars(bars: DBKlineBar[]): Promise<void> {
    if (bars.length === 0) return;
    const tx = this.idb.transaction(STORE.KLINE_BARS, 'readwrite');
    const store = tx.objectStore(STORE.KLINE_BARS);
    for (const bar of bars) store.put(bar);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Read K-line bars for [symbol, period] within [startMs, endMs] (inclusive),
   * returned in ascending timestamp order.
   * Returns at most KLINE_MAX_BARS records.
   */
  async getKlineBars(
    symbol: string,
    period: KlinePeriod,
    startMs: number,
    endMs: number
  ): Promise<DBKlineBar[]> {
    const tx = this.idb.transaction(STORE.KLINE_BARS, 'readonly');
    const range = IDBKeyRange.bound([symbol, period, startMs], [symbol, period, endMs]);
    const bars = await wrapRequest<DBKlineBar[]>(
      tx.objectStore(STORE.KLINE_BARS).index('symbol_period_ts').getAll(range, KLINE_MAX_BARS)
    );
    return bars.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Sweep minute-level K-line bars older than `ttlMs`.
   * Daily/weekly/monthly bars are never swept.
   */
  async sweepKlineBars(ttlMs: number = KLINE_MINUTE_TTL_MS): Promise<number> {
    const cutoff = Date.now() - ttlMs;
    const tx = this.idb.transaction(STORE.KLINE_BARS, 'readwrite');
    const store = tx.objectStore(STORE.KLINE_BARS);
    const old = await wrapRequest<DBKlineBar[]>(
      store.index('fetchedAt').getAll(IDBKeyRange.upperBound(cutoff))
    );
    const toDelete = old.filter((b) => KLINE_MINUTE_PERIODS.has(b.period));
    for (const bar of toDelete) store.delete([bar.symbol, bar.period, bar.timestamp]);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return toDelete.length;
  }

  // ─── kline_cache_meta ──────────────────────────────────────────────────────

  /**
   * Append a cache-segment record after a successful remote fetch.
   * Each call to AKShare that returns data produces one record here.
   * Multiple non-contiguous segments for the same symbol+period are all stored.
   */
  async addKlineCacheMeta(meta: Omit<DBKlineCacheMeta, 'id'>): Promise<void> {
    const tx = this.idb.transaction(STORE.KLINE_CACHE_META, 'readwrite');
    tx.objectStore(STORE.KLINE_CACHE_META).add(meta);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Return all cache-segment records for [symbol, period], sorted by segStart asc.
   * Used by useKlineData to compute which date ranges still need fetching.
   */
  async getKlineCacheMetas(symbol: string, period: KlinePeriod): Promise<DBKlineCacheMeta[]> {
    const tx = this.idb.transaction(STORE.KLINE_CACHE_META, 'readonly');
    const rows = await wrapRequest<DBKlineCacheMeta[]>(
      tx.objectStore(STORE.KLINE_CACHE_META)
        .index('symbol_period')
        .getAll(IDBKeyRange.only([symbol, period]))
    );
    return rows.sort((a, b) => a.segStart - b.segStart);
  }

  /**
   * Delete all cache-segment records for [symbol, period].
   * Called when minute K TTL expires (full invalidation).
   */
  async clearKlineCacheMetas(symbol: string, period: KlinePeriod): Promise<void> {
    const tx = this.idb.transaction(STORE.KLINE_CACHE_META, 'readwrite');
    const store = tx.objectStore(STORE.KLINE_CACHE_META);
    const rows = await wrapRequest<DBKlineCacheMeta[]>(
      store.index('symbol_period').getAll(IDBKeyRange.only([symbol, period]))
    );
    for (const row of rows) {
      if (row.id !== undefined) store.delete(row.id);
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Sweep kline_cache_meta records older than `ttlMs` (wall-clock fetchedAt).
   * Used for minute-K full invalidation sweep.
   */
  async sweepKlineCacheMetas(ttlMs: number = KLINE_MINUTE_TTL_MS): Promise<number> {
    const cutoff = Date.now() - ttlMs;
    const tx = this.idb.transaction(STORE.KLINE_CACHE_META, 'readwrite');
    const store = tx.objectStore(STORE.KLINE_CACHE_META);
    const old = await wrapRequest<DBKlineCacheMeta[]>(
      store.index('fetchedAt').getAll(IDBKeyRange.upperBound(cutoff))
    );
    // Only sweep minute-period segments
    const toDelete = old.filter((m) => KLINE_MINUTE_PERIODS.has(m.period));
    for (const m of toDelete) {
      if (m.id !== undefined) store.delete(m.id);
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return toDelete.length;
  }

  // ─── intraday_bars ──────────────────────────────────────────────────────────

  /**
   * Upsert a batch of intraday bars. Existing bars with the same
   * [symbol, period, timestamp] composite key are overwritten.
   */
  async putIntradayBars(bars: DBIntradayBar[]): Promise<void> {
    if (bars.length === 0) return;
    const tx = this.idb.transaction(STORE.INTRADAY_BARS, 'readwrite');
    const store = tx.objectStore(STORE.INTRADAY_BARS);
    for (const bar of bars) store.put(bar);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Read all intraday bars for [symbol, period, tradingDate] in timestamp order.
   */
  async getIntradayBars(
    symbol: string,
    period: DBIntradayBar['period'],
    tradingDate: string
  ): Promise<DBIntradayBar[]> {
    const tx = this.idb.transaction(STORE.INTRADAY_BARS, 'readonly');
    const rows = await wrapRequest<DBIntradayBar[]>(
      tx.objectStore(STORE.INTRADAY_BARS)
        .index('symbol_period_date')
        .getAll(IDBKeyRange.only([symbol, period, tradingDate]))
    );
    return rows.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Return intraday bars for the latest cached trading date of [symbol, period].
   *
   * Useful when caller's expected tradingDate (derived from market snapshot)
   * is a non-trading day but we already cached the most recent valid session.
   */
  async getLatestIntradayBars(
    symbol: string,
    period: DBIntradayBar['period']
  ): Promise<{ tradingDate: string; bars: DBIntradayBar[] } | null> {
    const tx = this.idb.transaction(STORE.INTRADAY_BARS, 'readonly');
    const store = tx.objectStore(STORE.INTRADAY_BARS);
    const byTs = store.index('symbol_period_ts');
    const range = IDBKeyRange.bound(
      [symbol, period, 0],
      [symbol, period, Number.MAX_SAFE_INTEGER]
    );

    const latest = await new Promise<DBIntradayBar | null>((resolve, reject) => {
      const req = byTs.openCursor(range, 'prev');
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });

    if (!latest) return null;

    const rows = await wrapRequest<DBIntradayBar[]>(
      store.index('symbol_period_date').getAll(IDBKeyRange.only([symbol, period, latest.tradingDate]))
    );

    return {
      tradingDate: latest.tradingDate,
      bars: rows.sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  /**
   * Delete all intraday bars for [symbol, period] EXCEPT those belonging to
   * `keepDate`. Called when we receive a fresh trading day to evict stale data.
   */
  async evictIntradayBars(
    symbol: string,
    period: DBIntradayBar['period'],
    keepDate: string
  ): Promise<void> {
    const tx = this.idb.transaction(STORE.INTRADAY_BARS, 'readwrite');
    const store = tx.objectStore(STORE.INTRADAY_BARS);
    // Fetch ALL bars for this symbol+period, delete those not on keepDate
    const all = await wrapRequest<DBIntradayBar[]>(
      store.index('symbol_period_ts')
        .getAll(IDBKeyRange.bound([symbol, period, 0], [symbol, period, Number.MAX_SAFE_INTEGER]))
    );
    for (const bar of all) {
      if (bar.tradingDate !== keepDate) {
        store.delete([bar.symbol, bar.period, bar.timestamp]);
      }
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  // ─── intraday_cache_meta ───────────────────────────────────────────────────

  /**
   * Record that we successfully fetched intraday data for [symbol, period, tradingDate].
   * Overwrites any existing record for the same triple (upsert via cursor-delete + add).
   * This prevents unbounded growth — one meta row per [symbol, period, tradingDate].
   */
  async putIntradayCacheMeta(meta: Omit<DBIntradayCacheMeta, 'id'>): Promise<void> {
    const tx = this.idb.transaction(STORE.INTRADAY_CACHE_META, 'readwrite');
    const store = tx.objectStore(STORE.INTRADAY_CACHE_META);
    // Delete any existing record for this triple so we keep exactly one per key
    const existing = await wrapRequest<DBIntradayCacheMeta[]>(
      store.index('symbol_period_date')
        .getAll(IDBKeyRange.only([meta.symbol, meta.period, meta.tradingDate]))
    );
    for (const row of existing) {
      if (row.id !== undefined) store.delete(row.id);
    }
    store.add(meta);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }

  /**
   * Return the most recent intraday cache-meta record for [symbol, period, tradingDate],
   * or null if never fetched.
   */
  async getIntradayCacheMeta(
    symbol: string,
    period: DBIntradayBar['period'],
    tradingDate: string
  ): Promise<DBIntradayCacheMeta | null> {
    const tx = this.idb.transaction(STORE.INTRADAY_CACHE_META, 'readonly');
    const rows = await wrapRequest<DBIntradayCacheMeta[]>(
      tx.objectStore(STORE.INTRADAY_CACHE_META)
        .index('symbol_period_date')
        .getAll(IDBKeyRange.only([symbol, period, tradingDate]))
    );
    if (rows.length === 0) return null;
    return rows.reduce((a, b) => (a.fetchedAt > b.fetchedAt ? a : b));
  }

  /**
   * Delete all intraday_cache_meta records for [symbol, period] except those
   * for `keepDate`. Called when we step to a new trading day.
   */
  async evictIntradayCacheMeta(
    symbol: string,
    period: DBIntradayBar['period'],
    keepDate: string
  ): Promise<void> {
    const tx = this.idb.transaction(STORE.INTRADAY_CACHE_META, 'readwrite');
    const store = tx.objectStore(STORE.INTRADAY_CACHE_META);
    const all = await wrapRequest<DBIntradayCacheMeta[]>(store.getAll());
    for (const row of all) {
      if (row.symbol === symbol && row.period === period && row.tradingDate !== keepDate) {
        if (row.id !== undefined) store.delete(row.id);
      }
    }
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
}
