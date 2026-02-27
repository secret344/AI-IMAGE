/**
 * InvestmentDB — IndexedDB schema for the investment sub-app.
 *
 * Object stores:
 *  - market_snapshots   行情快照，按 feedKey 归档，含 TTL
 *  - news_items         新闻条目，按来源+标题去重
 *  - query_log          请求日志，防止短期内重复发请求（滚动保留 500 条）
 *  - kline_bars         K 线柱数据，复合主键 [symbol, period, timestamp]
 *  - kline_fetch_range  已拉取区间元信息，防止重复请求历史数据
 */

// ─── market_snapshots ─────────────────────────────────────────────────────────

/**
 * Single index item stored inside a snapshot record.
 */
export interface DBMarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  tradingDate: string; // ISO date string, e.g. "2026-02-18"
  updatedAt: string; // ISO datetime
}

/**
 * One row in the `market_snapshots` store.
 *
 * keyPath: `feedKey`
 * Indexes: `fetchedAt` (for TTL sweep), `tradingDate`
 */
export interface DBMarketSnapshot {
  /** Identifies the data feed, e.g. "akshare.cn_index" */
  feedKey: string;
  /** Source tag forwarded from the Python script, e.g. "market.akshare.index_spot" */
  source: string;
  /** Epoch ms when we fetched this record from the remote source */
  fetchedAt: number;
  /** ISO datetime of the data itself */
  updatedAt: string;
  /** Trading date of the snapshot, e.g. "2026-02-18" */
  tradingDate: string;
  indices: DBMarketIndex[];
}

// ─── news_items ───────────────────────────────────────────────────────────────

/**
 * One row in the `news_items` store.
 *
 * keyPath: auto-increment `id`
 * Indexes: `source`, `publishedAt`, `[source+dedupeKey]` (unique)
 */
export interface DBNewsItem {
  id?: number;
  /** Feed identifier, e.g. "akshare.news_cls" */
  source: string;
  /** Stable deduplication key — typically a URL slug or hash of title */
  dedupeKey: string;
  title: string;
  summary?: string;
  url?: string;
  /** ISO datetime of publication */
  publishedAt: string;
  /** Epoch ms when we inserted this record */
  fetchedAt: number;
}

// ─── query_log ────────────────────────────────────────────────────────────────

/**
 * One row in the `query_log` store.
 * Used to gate outbound requests and avoid hammering remote endpoints.
 *
 * keyPath: auto-increment `id`
 * Indexes: `queryKey` (for latest-lookup), `requestedAt`
 */
export interface DBQueryLog {
  id?: number;
  /**
   * Opaque identifier for the logical query,
   * e.g. "market:fetch-snapshot:akshare.cn_index"
   */
  queryKey: string;
  /** Epoch ms of request start */
  requestedAt: number;
  /** 'success' | 'error' | 'cache-hit' */
  outcome: 'success' | 'error' | 'cache-hit';
  /** Optional human-readable note for debugging */
  note?: string;
}

// ─── kline_bars ──────────────────────────────────────────────────────────────

/**
 * K 线周期标识，与 AKShare 参数对应。
 * 'daily' | 'weekly' | 'monthly' = 日/周/月 K
 * '60' | '30' | '15' | '5'       = 分钟 K（字符串与 AKShare period 参数一致）
 * '1'                             = 1分钟分时（stock_zh_a_minute）
 */
export type KlinePeriod = 'daily' | 'weekly' | 'monthly' | '60' | '30' | '15' | '5' | '1';

/**
 * 一根 K 线柱。
 *
 * keyPath:  复合键 [symbol, period, timestamp]
 * Indexes:
 *   symbol_period_ts  → [symbol, period, timestamp]  范围查询（最常用）
 *   fetchedAt         → TTL 清扫（仅分钟 K 使用）
 */
export interface DBKlineBar {
  /** 标的代码，小写，e.g. "sh000001" */
  symbol: string;
  /** 周期 */
  period: KlinePeriod;
  /** 交易日起始时间，epoch ms（UTC 00:00 of trading date） */
  timestamp: number;
  /** ISO date "2026-02-18"，冗余存储便于阅读与过滤 */
  tradingDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 成交量（手） */
  volume: number;
  /** 成交额（元），部分源可能缺失 */
  amount?: number;
  /** 入库时间 epoch ms */
  fetchedAt: number;
}

/**
 * 记录某个 [symbol, period] 已成功拉取的一段连续日期区间。
 *
 * 设计要点：
 * - 每次拉取生成一条记录，支持非连续缓存（e.g. 仅有 2024 和 2026 数据）。
 * - 读取时将所有 segment 合并，与请求区间做差集，得到真正缺失的段。
 * - wall-clock `fetchedAt` 用于判断「尾端是否过期」，与 bar.timestamp 无关。
 *
 * keyPath: auto-increment `id`
 * Indexes:
 *   symbol_period   → [symbol, period]   查某标的所有 segment
 *   fetchedAt       → number             TTL 清扫
 */
export interface DBKlineCacheMeta {
  /** 自增主键 */
  id?: number;
  symbol: string;
  period: KlinePeriod;
  /** 本段已缓存数据的最早交易日 epoch ms（UTC 00:00） */
  segStart: number;
  /** 本段已缓存数据的最新交易日 epoch ms（UTC 00:00） */
  segEnd: number;
  /** 本次拉取发起时的 wall-clock epoch ms */
  fetchedAt: number;
}
/**
 * 分时数据一根 bar（新浪 stock_zh_a_minute）。
 *
 * keyPath:  复合键 [symbol, period, timestamp]
 * Indexes:
 *   symbol_period_ts  → [symbol, period, timestamp]  范围查询
 *   tradingDate       → string                         按交易日过滤
 */
export interface DBIntradayBar {
  /** 标的代码，小写，含交易所前缀 e.g. "sh000001" */
  symbol: string;
  /** 分时周期， '1' | '5' | '15' | '30' | '60' */
  period: '1' | '5' | '15' | '30' | '60';
  /** 此根 bar 对应的交易日，'YYYY-MM-DD' */
  tradingDate: string;
  /** bar 开始时刻 epoch ms（包含时分秒） */
  timestamp: number;
  /** 'YYYY-MM-DD HH:MM:SS' 字符串，便于显示 */
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  /** 成交量（手） */
  volume: number;
  /** 入库时刻 epoch ms */
  fetchedAt: number;
}

/**
 * 分时数据拉取元信息 — 记录某个 [symbol, period, tradingDate] 已完成的拉取。
 *
 * 作用：
 *  - 非交易时段（收盘后）该交易日数据稳定，命中后永不再拉。
 *  - 交易时段：fetchedAt < now - INTRADAY_LIVE_TTL_MS 时才重新拉取。
 *
 * keyPath: auto-increment `id`
 * Indexes:
 *   symbol_period_date → [symbol, period, tradingDate]  精确查找（最常用）
 *   fetchedAt          → number                          TTL 清扫
 */
export interface DBIntradayCacheMeta {
  /** 自增主键 */
  id?: number;
  symbol: string;
  /** 分时周期 */
  period: '1' | '5' | '15' | '30' | '60';
  /** 此次拉取对应的交易日 'YYYY-MM-DD' */
  tradingDate: string;
  /** 拉取完成时刻 epoch ms */
  fetchedAt: number;
}
// ─── DB meta ──────────────────────────────────────────────────────────────────

export const DB_NAME = 'investment_db';

/**
 * v1 → 初始版本
 * v2 → 新增 kline_bars + kline_fetch_range (单区间元信息，已废弃)
 * v3 → kline_fetch_range 替换为 kline_cache_meta（多段元信息，auto-increment pk）
 * v4 → 修复：确保 kline_cache_meta 一定存在（防止 v3 migration 未完成时卡住）
 * v5 → 新增 intraday_bars（分时数据，新浪 stock_zh_a_minute）
 * v6 → 新增 intraday_cache_meta（分时拉取元信息，支持收盘后永久缓存 + 盘中短 TTL）
 */
export const DB_VERSION = 6;

// ─── K-line TTL / stale thresholds ───────────────────────────────────────────

/**
 * 日/周/月 K 线尾端过期阈值：4 小时。
 * 含义：最近一次拉取尾端距今超过 4h，则尾端视为陈旧，允许增量补拉。
 * 历史段永不过期（只拉一次）。
 */
export const KLINE_DAILY_STALE_MS = 4 * 60 * 60 * 1000;

/**
 * 分钟 K 全量过期阈值：7 天。
 * 含义：距最近一次拉取超过 7 天，则视该标的分钟 K 缓存整体失效，重新全量拉取。
 */
export const KLINE_MINUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** getKlineBars 单次返回上限，防止 getAll 无限制扫描 DB */
export const KLINE_MAX_BARS = 5000;

/**
 * 分时数据——盘中刷新间隔：3 分钟。
 * 仅在 A 股交易时段（09:30–11:30, 13:00–15:00 CST）内使用；
 * 收盘后当日数据稳定，命中 intraday_cache_meta 后永不再拉。
 */
export const INTRADAY_LIVE_TTL_MS = 3 * 60 * 1000;

/**
 * 分时数据——非交易日/跨日 fallback 过期阈值：24 小时。
 * 当无法判断是否在交易时段时，超过此时长强制重拉。
 */
export const INTRADAY_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const STORE = {
  MARKET_SNAPSHOTS: 'market_snapshots',
  NEWS_ITEMS: 'news_items',
  QUERY_LOG: 'query_log',
  KLINE_BARS: 'kline_bars',
  KLINE_CACHE_META: 'kline_cache_meta',
  INTRADAY_BARS: 'intraday_bars',
  INTRADAY_CACHE_META: 'intraday_cache_meta'
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];
