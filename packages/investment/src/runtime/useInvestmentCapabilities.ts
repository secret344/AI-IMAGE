import { useKernelCapabilities } from '@investment/runtime/useKernel';
import type { KernelMarketSnapshot } from '@ai-image/contracts/kernel';

// AKShare IPC bridge is exposed by electron/preload.cjs into window.hostMarket
function getHostMarket() {
  return typeof window !== 'undefined' ? (window.hostMarket ?? null) : null;
}

export interface MarketSnapshotResponse {
  source: string;
  updatedAt: string;
  indices: Array<{
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    updatedAt: string;
  }>;
}

export interface NewsPreviewResponse {
  items: string[];
}

export interface InvestmentCapabilities {
  saveDraftSetting: (enabled: boolean) => Promise<void>;
  loadNewsPreview: () => Promise<NewsPreviewResponse>;
  loadMarketSnapshot: () => Promise<MarketSnapshotResponse>;
  notify: (message: string) => void;
}

const INVESTMENT_DRAFT_KEY = 'investment.draft.enabled';

/** In-memory throttle: skip IPC call if last success was < 60 s ago */
const MARKET_REMOTE_MIN_INTERVAL_MS = 60 * 1000;
let lastRemoteRequestAt = 0;
let lastRemoteSnapshot: MarketSnapshotResponse | null = null;

const NEWS_PREVIEW_ITEMS = [
  'HBM supply update and expected impact on AI server shipments',
  'Enterprise SSD pricing trend shows stabilization this week',
  'Foundry utilization uptick may support storage controller demand'
];

/**
 * Adapt a KernelMarketSnapshot (from AKShare IPC) to the app's MarketSnapshotResponse shape.
 */
function adaptKernelSnapshot(kernel: KernelMarketSnapshot): MarketSnapshotResponse {
  return {
    source: kernel.source,
    updatedAt: kernel.updatedAt,
    indices: kernel.indices.map((idx) => ({
      symbol: idx.symbol,
      name: idx.name,
      price: idx.price,
      change: idx.change,
      changePercent: idx.changePercent,
      updatedAt: idx.updatedAt
    }))
  };
}

async function loadMarketSnapshotCapability(
  fetchAKShareSnapshot?: () => Promise<KernelMarketSnapshot>
): Promise<MarketSnapshotResponse> {
  const now = Date.now();
  const elapsed = now - lastRemoteRequestAt;

  console.info(
    `[Market] loadMarketSnapshotCapability called. ` +
      `hasAKShare=${Boolean(fetchAKShareSnapshot)}, ` +
      `lastFetchedMsAgo=${lastRemoteRequestAt ? elapsed : 'never'}, ` +
      `throttleMs=${MARKET_REMOTE_MIN_INTERVAL_MS}`
  );

  // ─── In-memory throttle (fastest path) ─────────────────────────────────────
  if (lastRemoteSnapshot && elapsed < MARKET_REMOTE_MIN_INTERVAL_MS) {
    console.info(
      `[Market] ✓ Returning in-memory snapshot (throttled, ${elapsed}ms < ${MARKET_REMOTE_MIN_INTERVAL_MS}ms)`
    );
    return lastRemoteSnapshot;
  }

  // ─── Priority 1: AKShare via Electron IPC → persisted to IndexedDB ─────────
  if (fetchAKShareSnapshot) {
    console.info('[Market] → Attempting AKShare IPC fetch...');
    const t0 = Date.now();
    try {
      const kernelSnapshot = await fetchAKShareSnapshot();
      const durationMs = Date.now() - t0;
      const snapshot = adaptKernelSnapshot(kernelSnapshot);
      lastRemoteRequestAt = now;
      lastRemoteSnapshot = snapshot;
      console.info(
        `[Market] ✓ AKShare fetch succeeded in ${durationMs}ms. ` +
          `source=${snapshot.source}, indices=${snapshot.indices.length}, ` +
          `updatedAt=${snapshot.updatedAt}`
      );
      snapshot.indices.forEach((idx) => {
        const sign = idx.changePercent >= 0 ? '+' : '';
        console.info(
          `[Market]   ${idx.name} (${idx.symbol}): ${idx.price} ${sign}${idx.changePercent}%`
        );
      });
      return snapshot;
    } catch (err) {
      const durationMs = Date.now() - t0;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Market] ✗ AKShare fetch failed after ${durationMs}ms: ${msg}`);
    }
  } else {
    console.info('[Market] → AKShare IPC not available (non-Electron environment)');
  }

  // ─── Priority 2 & 3 delegated to loadMarketSnapshot (IndexedDB → mock) ─────
  // Return a rejected promise so InvestmentApp.tsx falls through to loadMarketSnapshot's
  // cache/fallback logic (which handles IndexedDB reads automatically).
  throw new Error('AKShare unavailable — delegate to loadMarketSnapshot cache/fallback');
}

async function saveDraftSetting(enabled: boolean): Promise<void> {
  localStorage.setItem(INVESTMENT_DRAFT_KEY, JSON.stringify(Boolean(enabled)));
}

async function loadNewsPreview(): Promise<NewsPreviewResponse> {
  return { items: NEWS_PREVIEW_ITEMS };
}

export function useInvestmentCapabilities(): InvestmentCapabilities {
  const kernel = useKernelCapabilities();
  const market = getHostMarket();

  return {
    saveDraftSetting,
    loadNewsPreview,
    loadMarketSnapshot: () =>
      loadMarketSnapshotCapability(
        market ? () => market.fetchSnapshot() as Promise<KernelMarketSnapshot> : undefined
      ),
    notify: kernel.notify
  };
}
