/**
 * Public exports for the investment DB layer.
 */
export {
  openInvestmentDB,
  InvestmentDB,
  MARKET_SNAPSHOT_TTL_MS,
  NEWS_ITEM_TTL_MS,
  QUERY_LOG_MAX_ROWS
} from './investmentDB';
export type {
  DBMarketSnapshot,
  DBMarketIndex,
  DBNewsItem,
  DBQueryLog,
  DBKlineBar,
  DBKlineCacheMeta,
  DBIntradayBar,
  DBIntradayCacheMeta,
  KlinePeriod,
  StoreName
} from './types';
export {
  DB_NAME,
  DB_VERSION,
  STORE,
  KLINE_DAILY_STALE_MS,
  KLINE_MINUTE_TTL_MS,
  KLINE_MAX_BARS,
  INTRADAY_LIVE_TTL_MS,
  INTRADAY_MAX_AGE_MS
} from './types';
