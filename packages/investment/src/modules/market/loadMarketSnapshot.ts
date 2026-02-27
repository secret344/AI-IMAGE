/**
 * 投资首页大盘快照加载模块
 * 职责：拉取服务端快照、读取/写入 IndexedDB 缓存、提供降级结果
 *
 * Cache hierarchy:
 *   1. IndexedDB market_snapshots (feedKey = FEED_KEY)
 *      - After market close for cached tradingDate → permanent (never stale)
 *      - During market hours → TTL 15 min
 *      - Pre/post-market gap → TTL 15 min
 *   2. Fallback mock data
 */

import {
  openInvestmentDB,
  MARKET_SNAPSHOT_TTL_MS,
  type DBMarketSnapshot
} from '@investment/lib/db';

export type MarketErrorCategory = 'timeout' | 'network' | 'unknown';

export interface MarketIndexItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

export interface MarketSnapshot {
  source: string;
  updatedAt: string;
  indices: MarketIndexItem[];
}

export interface LoadMarketSnapshotResult {
  snapshot: MarketSnapshot;
  source: 'remote' | 'cache' | 'fallback';
  errorCategory: MarketErrorCategory | null;
}

interface LoadMarketSnapshotOptions {
  requestSnapshot: () => Promise<unknown>;
  now?: () => number;
}

/** Feed key used as IndexedDB primary key for the CN index snapshot */
const FEED_KEY = 'akshare.cn_index';

// ─── Trading-hours helpers ─────────────────────────────────────────────────────

/**
 * Check if the A-share market is currently open (CST Mon–Fri 09:30–11:30 / 13:00–15:00).
 */
function isMarketOpenNow(nowMs: number): boolean {
  const cst = new Date(nowMs + 8 * 60 * 60 * 1000);
  const dow = cst.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  const hhmm = cst.getUTCHours() * 100 + cst.getUTCMinutes();
  return (hhmm >= 930 && hhmm < 1130) || (hhmm >= 1300 && hhmm < 1500);
}

/**
 * Return the effective TTL for a market snapshot:
 *  - If the snapshot's tradingDate is today CST AND market has closed (≥ 15:00) → Infinity
 *    (data won't change until the next session)
 *  - Otherwise → MARKET_SNAPSHOT_TTL_MS (15 min)
 */
function snapshotTtl(row: DBMarketSnapshot, nowMs: number): number {
  const cst = new Date(nowMs + 8 * 60 * 60 * 1000);
  const todayCST = cst.toISOString().slice(0, 10);
  if (row.tradingDate === todayCST) {
    const hhmm = cst.getUTCHours() * 100 + cst.getUTCMinutes();
    if (hhmm >= 1500) return Infinity; // market closed today
  } else if (row.tradingDate < todayCST) {
    // Snapshot from a past trading day — permanently valid until today's session opens
    if (!isMarketOpenNow(nowMs)) return Infinity;
  }
  return MARKET_SNAPSHOT_TTL_MS;
}

const FALLBACK_INDICES: MarketIndexItem[] = [
  {
    symbol: 'SH000001',
    name: 'SSE Composite',
    price: 3118.42,
    change: 4.12,
    changePercent: 0.13,
    updatedAt: new Date().toISOString()
  },
  {
    symbol: 'SZ399001',
    name: 'SZSE Component',
    price: 9951.8,
    change: -22.47,
    changePercent: -0.23,
    updatedAt: new Date().toISOString()
  },
  {
    symbol: 'SZ399006',
    name: 'ChiNext',
    price: 1913.27,
    change: 6.41,
    changePercent: 0.34,
    updatedAt: new Date().toISOString()
  },
  {
    symbol: '^HSI',
    name: 'Hang Seng',
    price: 16895.1,
    change: 55.33,
    changePercent: 0.33,
    updatedAt: new Date().toISOString()
  },
  {
    symbol: '^IXIC',
    name: 'NASDAQ',
    price: 18217.44,
    change: 48.58,
    changePercent: 0.27,
    updatedAt: new Date().toISOString()
  }
];

function classifyError(error: unknown): MarketErrorCategory {
  const message = String(error ?? '').toLowerCase();
  if (message.includes('timeout') || message.includes('超时')) {
    return 'timeout';
  }
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('offline') ||
    message.includes('网络')
  ) {
    return 'network';
  }
  return 'unknown';
}

function isValidIndexItem(value: unknown): value is MarketIndexItem {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<MarketIndexItem>;
  return (
    typeof item.symbol === 'string' &&
    typeof item.name === 'string' &&
    typeof item.price === 'number' &&
    typeof item.change === 'number' &&
    typeof item.changePercent === 'number' &&
    typeof item.updatedAt === 'string'
  );
}

function normalizeSnapshot(payload: unknown): MarketSnapshot | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const data = payload as Partial<MarketSnapshot>;
  if (typeof data.source !== 'string' || typeof data.updatedAt !== 'string') {
    return null;
  }
  if (!Array.isArray(data.indices) || !data.indices.every((item) => isValidIndexItem(item))) {
    return null;
  }
  return {
    source: data.source,
    updatedAt: data.updatedAt,
    indices: data.indices
  };
}

function createFallbackSnapshot(now: number): MarketSnapshot {
  const iso = new Date(now).toISOString();
  return {
    source: 'fallback-mock',
    updatedAt: iso,
    indices: FALLBACK_INDICES.map((item) => ({ ...item, updatedAt: iso }))
  };
}

/** Convert a validated MarketSnapshot to the DB row shape. */
function toDBSnapshot(
  snapshot: MarketSnapshot,
  feedKey: string,
  fetchedAt: number
): DBMarketSnapshot {
  const tradingDate = snapshot.updatedAt.slice(0, 10);
  return {
    feedKey,
    source: snapshot.source,
    fetchedAt,
    updatedAt: snapshot.updatedAt,
    tradingDate,
    indices: snapshot.indices.map((idx) => ({ ...idx, tradingDate }))
  };
}

/** Convert a DB row back to the app MarketSnapshot shape. */
function fromDBSnapshot(row: DBMarketSnapshot): MarketSnapshot {
  return {
    source: row.source,
    updatedAt: row.updatedAt,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    indices: row.indices.map(({ tradingDate: _tradingDate, ...rest }) => rest)
  };
}

/**
 * 加载首页大盘快照 — 缓存优先策略
 *
 * 优先级：IndexedDB 缓存（TTL 内）→ 远端 AKShare → 内置降级数据
 *
 * 当缓存命中时直接返回，不发起网络请求；
 * 仅在缓存缺失或 TTL 过期时才调用 AKShare。
 *
 * @param {LoadMarketSnapshotOptions} options
 * @return {Promise<LoadMarketSnapshotResult>}
 */
export async function loadMarketSnapshot(
  options: LoadMarketSnapshotOptions
): Promise<LoadMarketSnapshotResult> {
  const now = options.now?.() ?? Date.now();

  // Open DB — if IndexedDB is unavailable, fall through gracefully
  let db: Awaited<ReturnType<typeof openInvestmentDB>> | null = null;
  try {
    db = await openInvestmentDB();
  } catch {
    // IndexedDB unavailable (private browsing, etc.) — continue without cache
  }

  // ── Step 1: Cache-first — return immediately if snapshot is fresh ───────────
  if (db) {
    try {
      const row = await db.getMarketSnapshot(FEED_KEY, Infinity); // read without built-in TTL
      if (row) {
        const ttl = snapshotTtl(row, now);
        if (now - row.fetchedAt <= ttl) {
          return { snapshot: fromDBSnapshot(row), source: 'cache', errorCategory: null };
        }
      }
    } catch {
      // Ignore cache read errors — fall through to remote fetch
    }
  }

  // ── Step 2: Cache miss or stale — fetch from AKShare ────────────────────────
  try {
    const payload = await options.requestSnapshot();
    const snapshot = normalizeSnapshot(payload);
    if (!snapshot) {
      throw new Error('Invalid market snapshot payload');
    }
    // Persist fresh data to IndexedDB
    if (db) {
      try {
        await db.putMarketSnapshot(toDBSnapshot(snapshot, FEED_KEY, now));
        await db.logQuery({
          queryKey: `market:fetch-snapshot:${FEED_KEY}`,
          requestedAt: now,
          outcome: 'success'
        });
      } catch {
        // Cache write failure is non-fatal
      }
    }
    return { snapshot, source: 'remote', errorCategory: null };
  } catch (error) {
    const category = classifyError(error);
    if (db) {
      try {
        await db.logQuery({
          queryKey: `market:fetch-snapshot:${FEED_KEY}`,
          requestedAt: now,
          outcome: 'error',
          note: String(error)
        });
      } catch {
        /* ignore */
      }
    }
    // ── Step 3: Remote failed — try stale cache as last resort ────────────────
    if (db) {
      try {
        // Read without TTL filter — accept any cached snapshot as stale fallback
        const staleRow = await db.getMarketSnapshot(FEED_KEY, Infinity);
        if (staleRow) {
          return { snapshot: fromDBSnapshot(staleRow), source: 'cache', errorCategory: category };
        }
      } catch {
        /* ignore */
      }
    }
    const fallbackSnapshot = createFallbackSnapshot(now);
    return { snapshot: fallbackSnapshot, source: 'fallback', errorCategory: category };
  }
}
