/**
 * MarketDetailPage — K-line detail view for a single index or A-share stock.
 *
 * Route: /market/:symbol
 * Receives symbol via URL param, name + currentPrice via location.state (optional).
 *
 * Symbol conventions:
 *  - Index symbols:  'SH000001', 'SZ399001', 'SZ399006'  → uses fetchKline (index mode)
 *  - Stock symbols:  '000001', '600519', '300750'         → uses fetchStockKline (stock mode)
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@ui/card';
import { Button } from '@ui/button';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { KlineChart } from '@investment/components/KlineChart';
import type { KlinePeriod, DBKlineBar } from '@investment/lib/db';
import type { IntradayApiResult } from '@investment/hooks/useIntradayData';

/** State passed by the dashboard when navigating here */
export interface MarketDetailLocationState {
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
}

/**
 * Map the snapshot symbol key (e.g. "SH000001") → AKShare-style lowercase
 * symbol used by kline queries (e.g. "sh000001").
 */
function normalizeSymbol(raw: string): string {
  return raw.toLowerCase();
}

/**
 * Determine if a symbol is an individual A-share stock (pure numeric) vs an index
 * (which has a 'sh' or 'sz' prefix like 'sh000001').
 */
function isStockSymbol(sym: string): boolean {
  const lower = sym.toLowerCase();
  // Index symbols have sh/sz/cx prefix
  if (lower.startsWith('sh') || lower.startsWith('sz') || lower.startsWith('cx')) {
    return false;
  }
  // Pure numeric → individual stock
  return /^\d+$/.test(lower);
}

/** Shape returned by akshare_query.py --mode kline or stock_kline */
interface KlineApiBar {
  timestamp: number;
  tradingDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface KlineApiResult {
  source: string;
  symbol: string;
  period: string;
  updatedAt: string;
  bars: KlineApiBar[];
}

export function MarketDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { symbol = '' } = useParams<{ symbol: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as MarketDetailLocationState;

  const normalizedSymbol = normalizeSymbol(symbol);
  const displayName = state.name ?? symbol.toUpperCase();
  const price = state.price;
  const changePercent = state.changePercent;
  const isUp = (changePercent ?? 0) >= 0;

  /**
   * Fetch K-line bars via Electron IPC.
   * - For index symbols (sh/sz prefix): uses window.hostMarket.fetchKline
   * - For stock symbols (pure numeric):  uses window.hostMarket.fetchStockKline (qfq)
   * Falls back to empty array in browser / when IPC unavailable.
   */
  const requestKline = useCallback(
    async (
      sym: string,
      period: KlinePeriod,
      startMs: number,
      endMs: number
    ): Promise<Omit<DBKlineBar, 'fetchedAt'>[]> => {
      const bridge = window.hostMarket;
      if (!bridge) return [];

      const toDate = (ms: number) => {
        const d = new Date(ms);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      let raw: unknown;
      if (isStockSymbol(sym)) {
        if (!bridge.fetchStockKline) return [];
        raw = await bridge.fetchStockKline(sym, period, toDate(startMs), toDate(endMs), 'qfq');
      } else {
        if (!bridge.fetchKline) return [];
        raw = await bridge.fetchKline(sym, period, toDate(startMs), toDate(endMs));
      }

      const result = raw as KlineApiResult;
      if (!result?.bars?.length) return [];

      return result.bars.map(
        (bar): Omit<DBKlineBar, 'fetchedAt'> => ({
          symbol: sym,
          period,
          timestamp: bar.timestamp,
          tradingDate: bar.tradingDate,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume
        })
      );
    },
    []
  );

  /** Fetch intraday (分时) bars via Electron IPC. */
  const requestIntraday = useCallback(
    async (sym: string, per: string): Promise<IntradayApiResult> => {
      const bridge = window.hostMarket;
      if (!bridge?.fetchIntraday) {
        return { source: '', symbol: sym, period: per, tradingDate: '', updatedAt: '', bars: [] };
      }
      const raw = (await bridge.fetchIntraday(sym, per)) as IntradayApiResult;
      return raw ?? { source: '', symbol: sym, period: per, tradingDate: '', updatedAt: '', bars: [] };
    },
    []
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Back + header ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          {t('investment.marketDetail.back')}
        </Button>
      </div>

      {/* ── Symbol header card ── */}
      <Card className="border-border/50 bg-card/70">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{displayName}</CardTitle>
              <CardDescription className="mt-0.5 text-xs uppercase tracking-wide">
                {symbol}
              </CardDescription>
            </div>
            {price !== undefined && (
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">
                  {price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
                <p
                  className={`flex items-center justify-end gap-1 text-sm font-medium ${
                    isUp ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {isUp ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {changePercent !== undefined && (
                    <>
                      {isUp ? '+' : ''}
                      {changePercent.toFixed(2)}%
                    </>
                  )}
                  {state.change !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({state.change >= 0 ? '+' : ''}
                      {state.change.toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* ── K-line chart ── */}
      <KlineChart
        symbol={normalizedSymbol}
        title={t('investment.marketDetail.chartTitle', { name: displayName })}
        height={420}
        defaultPeriod="daily"
        requestKline={requestKline}
        requestIntraday={requestIntraday}
        className="border-border/50 bg-card/70"
      />

      {/* ── Placeholder panels ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/50 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t('investment.marketDetail.fundamentals.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('investment.marketDetail.fundamentals.placeholder')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('investment.marketDetail.news.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('investment.marketDetail.news.placeholder')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
