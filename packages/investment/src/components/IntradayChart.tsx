/**
 * IntradayChart — lightweight-charts line chart for intraday (分时) data.
 *
 * Displays the latest trading day's 1-minute bars as a line series.
 * Consumes `latestTradingDate` from TradingDayContext and stays idle until
 * the date is resolved (non-empty string).
 *
 * Props:
 *  - symbol          → stock/index symbol (lowercase, e.g. 'sh000001')
 *  - requestIntraday → optional IPC fetch function
 *  - height          → chart canvas height (default 320)
 *  - className       → extra class on the wrapping Card
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createChart,
  ColorType,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type HistogramData,
  type UTCTimestamp
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Button } from '@ui/button';
import { useTradingDay } from '@investment/context/TradingDayContext';
import { useIntradayData, type IntradayApiResult } from '@investment/hooks/useIntradayData';
import type { DBIntradayBar } from '@investment/lib/db';

// ─── Sub-period options ───────────────────────────────────────────────────────

type IntradayPeriod = DBIntradayBar['period'];

const INTRADAY_PERIOD_OPTIONS: { period: IntradayPeriod; labelKey: string }[] = [
  { period: '1',  labelKey: 'investment.kline.period.1m' },
  { period: '5',  labelKey: 'investment.kline.period.5m' },
  { period: '15', labelKey: 'investment.kline.period.15m' },
  { period: '30', labelKey: 'investment.kline.period.30m' },
  { period: '60', labelKey: 'investment.kline.period.60m' }
];

export interface IntradayChartProps {
  symbol: string;
  /** Initial sub-period. Default: '1' (1-minute). */
  defaultPeriod?: IntradayPeriod;
  /** Card title label */
  title?: string;
  /** Chart canvas height in px. Default 320. */
  height?: number;
  /** Extra class on Card wrapper */
  className?: string;
  /**
   * Async fetch function bridged to Electron IPC.
   * If omitted, chart uses cached data only.
   */
  requestIntraday?: (symbol: string, period: string) => Promise<IntradayApiResult>;
}

// ─── Theme helpers ─────────────────────────────────────────────────────────────

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function buildIntradayTheme() {
  return {
    background: cssVar('--background', '#ffffff'),
    text: cssVar('--foreground', '#0f172a'),
    grid: cssVar('--border', '#e2e8f0'),
    lineColor: '#2563eb', // blue-600
    volumeColor: 'rgba(37,99,235,0.3)'
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * IntradayChart — intraday line chart component with period selector and DB caching.
 *
 * @example
 * <IntradayChart
 *   symbol="sh000001"
 *   title="上证指数 分时"
 *   requestIntraday={(sym, per) => window.hostMarket.fetchIntraday(sym, per)}
 * />
 */
export function IntradayChart({
  symbol,
  defaultPeriod = '1',
  title,
  height = 320,
  className,
  requestIntraday
}: IntradayChartProps) {
  const { t, i18n } = useTranslation();
  const { latestTradingDate } = useTradingDay();
  const [period, setPeriod] = useState<IntradayPeriod>(defaultPeriod);

  const { bars, tradingDate, status, error, refresh } = useIntradayData({
    symbol,
    period,
    latestTradingDate,
    requestIntraday,
    disabled: !latestTradingDate
  });

  /** Clear chart when switching sub-period to avoid stale flash */
  const handlePeriodChange = (p: IntradayPeriod) => {
    if (p === period) return;
    lineRef.current?.setData([]);
    volumeRef.current?.setData([]);
    setPeriod(p);
  };

  const formatLocalDate = (isoDate: string): string => {
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(parsed);
  };

  // ── Chart lifecycle ──────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  /** Create chart once on mount, destroy on unmount */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const theme = buildIntradayTheme();
    const chart = createChart(container, {
      width: container.clientWidth,
      height: height - 48,
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
      localization: {
        locale: i18n.language
      },
      timeScale: {
        borderColor: theme.grid,
        timeVisible: true,
        secondsVisible: false
      }
    });

    const line = chart.addSeries(LineSeries, {
      color: theme.lineColor,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceLineVisible: true
    });

    const volume = chart.addSeries(HistogramSeries, {
      color: theme.volumeColor,
      priceFormat: { type: 'volume' },
      priceScaleId: 'intraday_vol'
    });
    chart.priceScale('intraday_vol').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 }
    });

    chartRef.current = chart;
    lineRef.current = line;
    volumeRef.current = volume;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      lineRef.current = null;
      volumeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Resize chart when height prop changes */
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({ height: height - 48 });
  }, [height]);

  /** Re-apply chart locale when language changes */
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      localization: { locale: i18n.language }
    });
  }, [i18n.language]);

  /** Push bar data to series whenever bars update */
  useEffect(() => {
    const line = lineRef.current;
    const volume = volumeRef.current;
    if (!line || !volume) return;

    if (bars.length === 0) {
      line.setData([]);
      volume.setData([]);
      return;
    }

    const lineData: LineData[] = bars.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      value: b.close
    }));
    const volumeData: HistogramData[] = bars.map((b) => ({
      time: (b.time / 1000) as UTCTimestamp,
      value: b.volume,
      color: b.close >= b.open ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.35)'
    }));

    line.setData(lineData);
    volume.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const displayTitle = title ?? `${symbol.toUpperCase()} ${t('investment.kline.period.intraday')}`;
  const tradingDateLabel = tradingDate
    ? ` · ${formatLocalDate(tradingDate)}`
    : latestTradingDate
      ? ` · ${formatLocalDate(latestTradingDate)}`
      : '';

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            {displayTitle}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {tradingDateLabel}
            </span>
          </CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            {INTRADAY_PERIOD_OPTIONS.map(({ period: p, labelKey }) => (
              <Button
                key={p}
                size="sm"
                variant={p === period ? 'default' : 'ghost'}
                className="h-6 px-2 text-xs"
                onClick={() => handlePeriodChange(p)}
              >
                {t(labelKey)}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={refresh}
              disabled={status === 'loading' || !latestTradingDate}
            >
              {t('investment.kline.actions.refresh')}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative p-0" style={{ height }}>
        {/* Waiting for trading day resolution */}
        {!latestTradingDate && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <span className="text-sm text-muted-foreground animate-pulse">
              {t('investment.kline.intraday.waitingTradingDay')}
            </span>
          </div>
        )}

        {/* Loading skeleton */}
        {latestTradingDate && status === 'loading' && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <span className="text-sm text-muted-foreground animate-pulse">
              {t('investment.kline.intraday.loading')}
            </span>
          </div>
        )}

        {/* Error overlay */}
        {latestTradingDate && status === 'error' && bars.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
            <span className="text-sm text-destructive">{t('investment.kline.intraday.error')}</span>
            {error && (
              <span className="text-xs text-muted-foreground max-w-xs text-center">{error}</span>
            )}
            <Button size="sm" variant="outline" onClick={refresh}>
              {t('investment.kline.actions.retry')}
            </Button>
          </div>
        )}

        {/* Empty state */}
        {latestTradingDate && status === 'success' && bars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">
              {t('investment.kline.intraday.empty')}
            </span>
          </div>
        )}

        {/* Chart canvas */}
        <div ref={containerRef} className="w-full h-full" />
      </CardContent>
    </Card>
  );
}
