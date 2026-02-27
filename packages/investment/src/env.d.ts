import type { KernelRuntimeBridge } from '@ai-image/contracts/kernel';

/** Exposed by electron/preload.cjs via contextBridge */
interface HostMarketBridge {
  /** Fetch A-share market snapshot via AKShare Python subprocess (Electron only). */
  fetchSnapshot: () => Promise<unknown>;
  /**
   * Fetch historical K-line bars for an A-share INDEX symbol.
   * @param symbol    e.g. 'sh000001'
   * @param period    'daily' | 'weekly' | 'monthly'
   * @param startDate 'YYYY-MM-DD'
   * @param endDate   'YYYY-MM-DD'
   */
  fetchKline: (
    symbol: string,
    period: string,
    startDate: string,
    endDate: string
  ) => Promise<unknown>;
  /**
   * Fetch historical K-line bars for an individual A-share STOCK.
   * @param symbol    e.g. '000001' (pure numeric, no sh/sz prefix)
   * @param period    'daily' | 'weekly' | 'monthly'
   * @param startDate 'YYYY-MM-DD'
   * @param endDate   'YYYY-MM-DD'
   * @param adjust    '' | 'qfq' | 'hfq' (default: 'qfq')
   */
  fetchStockKline: (
    symbol: string,
    period: string,
    startDate: string,
    endDate: string,
    adjust?: string
  ) => Promise<unknown>;
  /**
   * Fetch intraday (分时) bars for a symbol.
   * @param symbol  e.g. 'sh000001' or '000001'
   * @param period  '1' | '5' | '15' | '30' | '60' (minutes)
   * @param adjust  '' | 'qfq' | 'hfq' (default: '')
   */
  fetchIntraday: (
    symbol: string,
    period?: string,
    adjust?: string
  ) => Promise<unknown>;
}

declare global {
  interface Window {
    hostKernelRuntime?: KernelRuntimeBridge;
    hostMarket?: HostMarketBridge;
  }
}

export {};
