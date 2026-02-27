/**
 * KlineChart — lightweight-charts based candlestick component.
 *
 * Props:
 *  - symbol / period / startMs / endMs    → forwarded to useKlineData
 *  - requestKline                         → optional IPC fetch function
 *  - title                                → card header label
 *  - height                               → chart canvas height (default 320)
 *  - className                            → extra class on the wrapping Card
 *
 * Features:
 *  - Renders candlestick + volume histogram (separate pane)
 *  - Period selector tabs (日/周/月/60m/30m/15m/5m)
 *  - Responsive: resizes with ResizeObserver
 *  - Themed: reads CSS variables for colors (dark/light safe)
 *  - Loading skeleton + error state
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Button } from '@ui/button';
import { useKlineData } from '@investment/hooks/useKlineData';
import { IntradayChart } from '@investment/components/IntradayChart';
import type { IntradayApiResult } from '@investment/hooks/useIntradayData';
import type { KlinePeriod } from '@investment/lib/db';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PeriodOption {
  period: KlinePeriod;
  labelKey: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { period: 'daily',   labelKey: 'investment.kline.period.daily' },
  { period: 'weekly',  labelKey: 'investment.kline.period.weekly' },
  { period: 'monthly', labelKey: 'investment.kline.period.monthly' }
];

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Default window per period — minute K shows 1 month, others 1 year */
function defaultStartMs(period: KlinePeriod): number {
  const minutePeriods = new Set<KlinePeriod>(['5', '15', '30', '60']);
  return Date.now() - (minutePeriods.has(period) ? ONE_MONTH_MS : ONE_YEAR_MS);
}

export interface KlineChartProps {
  symbol: string;
  /** Initial period (can be changed via UI). Default: 'daily' */
  defaultPeriod?: KlinePeriod;
  /**
   * Async function that fetches intraday bars via Electron IPC.
   * If omitted, IntradayChart only uses cached data.
   */
  requestIntraday?: (symbol: string, period: string) => Promise<IntradayApiResult>;
  /** Card title. Falls back to symbol. */
  title?: string;
  /** Chart canvas height in px. Default 320. */
  height?: number;
  /** Extra class on the Card wrapper */
  className?: string;
  /**
   * Async function that fetches raw bar data from IPC / remote.
   * If omitted, the chart only uses cached data.
   */
  requestKline?: (
    symbol: string,
    period: KlinePeriod,
    startMs: number,
    endMs: number
  ) => Promise<
    Array<{
      symbol: string;
      period: KlinePeriod;
      timestamp: number;
      tradingDate: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      amount?: number;
    }>
  >;
}

// ─── Theme helpers ─────────────────────────────────────────────────────────────

/** Read a CSS variable from :root, with a fallback value. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function buildChartTheme() {
  return {
    background: cssVar('--background', '#ffffff'),
    text: cssVar('--foreground', '#0f172a'),
    grid: cssVar('--border', '#e2e8f0'),
    upColor: '#16a34a', // green-600
    downColor: '#dc2626', // red-600
    borderUp: '#16a34a',
    borderDown: '#dc2626',
    wickUp: '#16a34a',
    wickDown: '#dc2626',
    volumeUp: 'rgba(22,163,74,0.4)',
    volumeDown: 'rgba(220,38,38,0.4)'
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * KlineChart — candlestick + volume chart with period selector and IndexedDB caching.
 *
 * @example
 * <KlineChart
 *   symbol="sh000001"
 *   title="SSE Composite"
 *   requestKline={(sym, per, s, e) => ipc.fetchKline(sym, per, s, e)}
 * />
 */
/** Sentinel value used as the "period" when the intraday tab is active. */
const INTRADAY_TAB = '__intraday__' as const;
type TabValue = KlinePeriod | typeof INTRADAY_TAB;

export function KlineChart({
  symbol,
  defaultPeriod = 'daily',
  title,
  height = 320,
  className,
  requestKline,
  requestIntraday
}: KlineChartProps) {
  const { t } = useTranslation();
  /** Active tab: '__intraday__' for 分时, otherwise a KlinePeriod */
  const [tab, setTab] = useState<TabValue>(INTRADAY_TAB);
  const period: KlinePeriod = tab === INTRADAY_TAB ? defaultPeriod : tab;
  const startMs = useMemo(() => defaultStartMs(period), [period]);
  const endMs = useMemo(() => Date.now(), []);

  const { bars, status, error, refresh } = useKlineData({
    symbol,
    period,
    startMs,
    endMs,
    requestKline,
    disabled: tab === INTRADAY_TAB
  });

  // ── Chart lifecycle ──────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  /** Create chart on first mount, destroy on unmount */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const theme = buildChartTheme();
    const chart = createChart(container, {
      width: container.clientWidth,
      height: height - 48, // subtract header row
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid }
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: theme.grid },
      timeScale: { borderColor: theme.grid, timeVisible: true }
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: theme.upColor,
      downColor: theme.downColor,
      borderUpColor: theme.borderUp,
      borderDownColor: theme.borderDown,
      wickUpColor: theme.wickUp,
      wickDownColor: theme.wickDown
    });

    const volume = chart.addSeries(HistogramSeries, {
      color: theme.volumeUp,
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 }
    });

    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;

    // ResizeObserver for responsive width
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once — period/height changes handled separately

  /** Resize chart when height prop changes */
  useEffect(() => {
    const container = containerRef.current;
    if (!chartRef.current || !container) return;
    chartRef.current.applyOptions({ height: height - 48 });
  }, [height]);

  /** Push bar data to series whenever bars change */
  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    if (!candle || !volume || bars.length === 0) return;

    const theme = buildChartTheme();
    const candleData: CandlestickData[] = bars.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close
    }));
    const volumeData: HistogramData[] = bars.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open ? theme.volumeUp : theme.volumeDown
    }));

    candle.setData(candleData);
    volume.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // ── Tab / period change ─────────────────────────────────────────────────────
  const handleTabChange = useCallback(
    (next: TabValue) => {
      if (next === tab) return;
      // Clear candlestick chart when switching away from intraday
      if (next !== INTRADAY_TAB) {
        candleRef.current?.setData([]);
        volumeRef.current?.setData([]);
      }
      setTab(next);
    },
    [tab]
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  const displayTitle = title ?? symbol.toUpperCase();

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{displayTitle}</CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {/* 分时 tab — always first */}
            <Button
              key={INTRADAY_TAB}
              size="sm"
              variant={tab === INTRADAY_TAB ? 'default' : 'ghost'}
              className="h-6 px-2 text-xs"
              onClick={() => handleTabChange(INTRADAY_TAB)}
            >
              {t('investment.kline.period.intraday')}
            </Button>
            {PERIOD_OPTIONS.map(({ period: p, labelKey }) => (
              <Button
                key={p}
                size="sm"
                variant={p === tab ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => handleTabChange(p)}
              >
                {t(labelKey)}
              </Button>
            ))}
            {tab !== INTRADAY_TAB && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={refresh}
                disabled={status === 'loading'}
              >
                {t('investment.kline.actions.refresh')}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative" style={{ height }}>
        {/* ── Intraday (分时) tab ── */}
        {tab === INTRADAY_TAB && (
          <IntradayChart
            symbol={symbol}
            height={height}
            requestIntraday={requestIntraday}
            className="border-0 shadow-none rounded-none"
          />
        )}

        {/* ── K-line (candlestick) tabs ── */}
        {/* The canvas div is ALWAYS in the DOM so the chart init useEffect can
            attach lightweight-charts on first render. We only hide it via CSS
            while the intraday tab is active. Overlays are rendered on top. */}
        <div className={tab === INTRADAY_TAB ? 'hidden' : 'relative w-full h-full'}>
          {/* Loading skeleton */}
          {status === 'loading' && bars.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <span className="text-sm text-muted-foreground animate-pulse">
                {t('investment.kline.loading')}
              </span>
            </div>
          )}

          {/* Error overlay */}
          {status === 'error' && bars.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
              <span className="text-sm text-destructive">{t('investment.kline.error')}</span>
              {error && (
                <span className="text-xs text-muted-foreground max-w-xs text-center">{error}</span>
              )}
              <Button size="sm" variant="outline" onClick={refresh}>
                {t('investment.kline.actions.retry')}
              </Button>
            </div>
          )}

          {/* Empty state */}
          {status === 'success' && bars.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-muted-foreground">{t('investment.kline.empty')}</span>
            </div>
          )}

          {/* Chart canvas — lightweight-charts manages its own DOM */}
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </CardContent>
    </Card>
  );
}
