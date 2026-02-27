import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Button } from '@ui/button';
import { Menu, MenuItem } from '@ui/menu';
import { useInvestmentCapabilities } from '@investment/runtime/useInvestmentCapabilities';
import {
  loadMarketSnapshot,
  type MarketErrorCategory,
  type MarketSnapshot
} from '@investment/modules/market/loadMarketSnapshot';
import {
  MarketDetailPage,
  type MarketDetailLocationState
} from '@investment/components/MarketDetailPage';
import {
  TradingDayProvider,
  deriveTradingDate
} from '@investment/context/TradingDayContext';

type InvestmentPageKey = '/dashboard' | '/news' | '/strategy' | '/portfolio' | '/settings';

interface InvestmentNavItem {
  key: InvestmentPageKey;
  routePath: InvestmentPageKey;
  labelKey: string;
  descriptionKey: string;
}

const MARKET_REFRESH_MS = 15 * 60 * 1000;

export function InvestmentApp() {
  const { t, i18n } = useTranslation();
  const capabilities = useInvestmentCapabilities();
  const { notify, loadMarketSnapshot: requestMarketSnapshot } = capabilities;
  const navigate = useNavigate();
  const location = useLocation();
  const [previewItems, setPreviewItems] = useState<string[]>([]);
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [marketSource, setMarketSource] = useState<'remote' | 'cache' | 'fallback'>('fallback');
  const [marketErrorCategory, setMarketErrorCategory] = useState<MarketErrorCategory | null>(null);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const canReturnToHostLauncher = window.location.pathname.startsWith('/packages/');

  // Derive the latest trading date from the snapshot for intraday caching.
  // Empty string while snapshot not yet loaded — child charts wait for this.
  const latestTradingDate = deriveTradingDate(marketSnapshot?.updatedAt);

  // Stable refs for values that change every render but don't need to re-trigger effects.
  // Using refs prevents useCallback/useEffect dependency churn → avoids infinite update loops.
  const notifyRef = useRef(notify);
  const requestMarketSnapshotRef = useRef(requestMarketSnapshot);
  const tRef = useRef(t);
  useEffect(() => {
    notifyRef.current = notify;
  });
  useEffect(() => {
    requestMarketSnapshotRef.current = requestMarketSnapshot;
  });
  useEffect(() => {
    tRef.current = t;
  });

  const navItems: InvestmentNavItem[] = useMemo(
    () => [
      {
        key: '/dashboard',
        routePath: '/dashboard',
        labelKey: 'investment.nav.dashboard',
        descriptionKey: 'investment.nav.dashboardDescription'
      },
      {
        key: '/news',
        routePath: '/news',
        labelKey: 'investment.nav.news',
        descriptionKey: 'investment.nav.newsDescription'
      },
      {
        key: '/strategy',
        routePath: '/strategy',
        labelKey: 'investment.nav.strategy',
        descriptionKey: 'investment.nav.strategyDescription'
      },
      {
        key: '/portfolio',
        routePath: '/portfolio',
        labelKey: 'investment.nav.portfolio',
        descriptionKey: 'investment.nav.portfolioDescription'
      },
      {
        key: '/settings',
        routePath: '/settings',
        labelKey: 'investment.nav.settings',
        descriptionKey: 'investment.nav.settingsDescription'
      }
    ],
    []
  );

  const activeNavItem = useMemo(() => {
    return navItems.find((item) => item.routePath === location.pathname) ?? navItems[0];
  }, [location.pathname, navItems]);

  const handleSaveDraft = async () => {
    await capabilities.saveDraftSetting(true);
    capabilities.notify(t('investment.actions.saved'));
  };

  const handleLoadPreview = async () => {
    const response = await capabilities.loadNewsPreview();
    setPreviewItems(response.items ?? []);
    capabilities.notify(t('investment.actions.previewLoaded'));
  };

  const loadDashboardSnapshot = useCallback(
    async (withNotice = false) => {
      setIsMarketLoading(true);
      const result = await loadMarketSnapshot({
        requestSnapshot: requestMarketSnapshotRef.current
      });
      setMarketSnapshot(result.snapshot);
      setMarketSource(result.source);
      setMarketErrorCategory(result.errorCategory);
      setIsMarketLoading(false);

      if (withNotice) {
        notifyRef.current(tRef.current('investment.dashboard.actions.refreshCompleted'));
      }
    },
    [] // stable: all volatile deps accessed through refs
  );

  useEffect(() => {
    void loadDashboardSnapshot(false);
    const timer = window.setInterval(() => {
      void loadDashboardSnapshot(false);
    }, MARKET_REFRESH_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadDashboardSnapshot]);

  const formatPrice = useCallback(
    (value: number) => {
      return new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    },
    [i18n.language]
  );

  const formatPercent = useCallback(
    (value: number) => {
      const signal = value > 0 ? '+' : '';
      return `${signal}${new Intl.NumberFormat(i18n.language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value)}%`;
    },
    [i18n.language]
  );

  const formatDateTime = useCallback(
    (isoValue: string) => {
      const parsed = new Date(isoValue);
      return new Intl.DateTimeFormat(i18n.language, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(parsed);
    },
    [i18n.language]
  );

  const renderDashboardPage = () => {
    return (
      <Card className="border-border/50 bg-card/70">
        <CardHeader>
          <CardTitle>{t('investment.dashboard.title')}</CardTitle>
          <CardDescription>{t('investment.dashboard.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void loadDashboardSnapshot(true);
              }}
            >
              {t('investment.dashboard.actions.refresh')}
            </Button>
            <p className="text-xs text-muted-foreground">
              {marketSnapshot
                ? t('investment.dashboard.updatedAt', {
                    time: formatDateTime(marketSnapshot.updatedAt)
                  })
                : t('investment.dashboard.loading')}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(`investment.dashboard.marketSource.${marketSource}`)}
          </p>
          {marketErrorCategory ? (
            <p className="text-xs text-amber-500">
              {t(`investment.dashboard.errorCategory.${marketErrorCategory}`)}
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {marketSnapshot?.indices.map((item) => (
              <Card
                key={item.symbol}
                className="border-border/60 bg-card/70 cursor-pointer transition-colors hover:bg-accent/60"
                onClick={() => {
                  const state: MarketDetailLocationState = {
                    name: item.name,
                    price: item.price,
                    change: item.change,
                    changePercent: item.changePercent
                  };
                  navigate(`/market/${item.symbol}`, { state });
                }}
              >
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-sm">{item.name}</CardTitle>
                  <CardDescription className="text-xs">{item.symbol}</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-2">
                  <p className="text-base font-semibold">{formatPrice(item.price)}</p>
                  <p
                    className={`text-sm ${
                      item.changePercent >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {item.change >= 0 ? '+' : ''}
                    {formatPrice(item.change)} ({formatPercent(item.changePercent)})
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          {!marketSnapshot && !isMarketLoading ? (
            <p className="text-sm text-muted-foreground">{t('investment.dashboard.empty')}</p>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  const renderNewsPage = () => {
    return (
      <Card className="border-border/50 bg-card/70">
        <CardHeader>
          <CardTitle>{t('investment.news.title')}</CardTitle>
          <CardDescription>{t('investment.news.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button type="button" variant="outline" onClick={handleLoadPreview}>
            {t('investment.news.actions.loadPreview')}
          </Button>
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <p className="text-xs text-muted-foreground">{t('investment.previewTitle')}</p>
            {previewItems.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('investment.previewEmpty')}</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {previewItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStrategyPage = () => {
    const strategies = [
      'investment.strategy.items.factorRotation',
      'investment.strategy.items.eventDriven',
      'investment.strategy.items.trendFollowing'
    ];
    return (
      <Card className="border-border/50 bg-card/70">
        <CardHeader>
          <CardTitle>{t('investment.strategy.title')}</CardTitle>
          <CardDescription>{t('investment.strategy.description')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {strategies.map((key) => (
            <Card key={key} className="border-border/60 bg-card/70">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">{t(`${key}.title`)}</CardTitle>
                <CardDescription className="text-xs">{t(`${key}.status`)}</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-sm text-muted-foreground">{t(`${key}.description`)}</p>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    );
  };

  const renderPortfolioPage = () => {
    /** A-share only watchlist — pure 6-digit codes routed to stock_kline API */
    const ASHARE_WATCHLIST: Array<{ symbol: string; name: string }> = [
      { symbol: '000001', name: '平安银行' },
      { symbol: '600519', name: '贵州茅台' },
      { symbol: '300750', name: '宁德时代' },
      { symbol: '000858', name: '五粮液' },
      { symbol: '601318', name: '中国平安' },
      { symbol: '000333', name: '美的集团' }
    ];
    return (
      <Card className="border-border/50 bg-card/70">
        <CardHeader>
          <CardTitle>{t('investment.portfolio.title')}</CardTitle>
          <CardDescription>{t('investment.portfolio.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('investment.portfolio.placeholder')}</p>
          <div className="rounded-md border border-border/60 bg-card/60 p-3">
            <p className="text-xs text-muted-foreground">
              {t('investment.portfolio.watchListTitle')}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ASHARE_WATCHLIST.map(({ symbol, name }) => (
                <Card
                  key={symbol}
                  className="border-border/60 bg-card/70 cursor-pointer transition-colors hover:bg-accent/60"
                  onClick={() => {
                    const state: MarketDetailLocationState = { name };
                    navigate(`/market/${symbol}`, { state });
                  }}
                >
                  <CardHeader className="p-3 pb-0">
                    <CardTitle className="text-sm">{name}</CardTitle>
                    <CardDescription className="text-xs">{symbol}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      {t('investment.portfolio.clickToView')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSettingsPage = () => {
    return (
      <Card className="border-border/50 bg-card/70">
        <CardHeader>
          <CardTitle>{t('investment.settings.title')}</CardTitle>
          <CardDescription>{t('investment.settings.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{t('investment.settings.placeholder')}</p>
          <Button type="button" variant="outline" onClick={handleSaveDraft}>
            {t('investment.actions.saveDraft')}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <TradingDayProvider latestTradingDate={latestTradingDate}>
    <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-3 md:flex-row">
      <Card className="w-full border-border/50 bg-card/70 md:w-64">
        <CardHeader className="p-4">
          <CardTitle>{t('investment.title')}</CardTitle>
          <CardDescription>{t('investment.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 p-4 pt-0">
          {canReturnToHostLauncher ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.assign('/packages/host/index.html');
              }}
            >
              {t('host.actions.backToLauncher')}
            </Button>
          ) : null}
          <Menu>
            {navItems.map((item) => (
              <MenuItem
                key={item.key}
                active={location.pathname === item.routePath}
                onClick={() => {
                  navigate(item.routePath);
                }}
              >
                {t(item.labelKey)}
              </MenuItem>
            ))}
          </Menu>
          <p className="px-1 text-xs text-muted-foreground">{t(activeNavItem.descriptionKey)}</p>
        </CardContent>
      </Card>
      <div className="min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={renderDashboardPage()} />
          <Route path="/news" element={renderNewsPage()} />
          <Route path="/strategy" element={renderStrategyPage()} />
          <Route path="/portfolio" element={renderPortfolioPage()} />
          <Route path="/settings" element={renderSettingsPage()} />
          <Route path="/market/:symbol" element={<MarketDetailPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
    </TradingDayProvider>
  );
}
