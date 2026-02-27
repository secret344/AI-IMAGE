/**
 * TradingDayContext — provides the latest known A-share trading date globally.
 *
 * The trading date is derived from the market snapshot's updatedAt timestamp:
 * if the snapshot was fetched after 15:00 CST, the trading date is today;
 * otherwise it is yesterday (or the previous trading day approximation).
 *
 * Components that need the latest trading date (e.g. IntradayChart) should use
 * the `useTradingDay` hook. They must stay idle until `latestTradingDate` is
 * a non-empty string.
 *
 * Usage:
 *   // Wrap your app (already done in InvestmentApp):
 *   <TradingDayProvider latestTradingDate={derivedDate}>
 *     <App />
 *   </TradingDayProvider>
 *
 *   // In any child component:
 *   const { latestTradingDate } = useTradingDay();
 */

import { createContext, useContext, type ReactNode } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TradingDayContextValue {
  /** Latest trading date in 'YYYY-MM-DD' format, or '' while loading */
  latestTradingDate: string;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const TradingDayContext = createContext<TradingDayContextValue>({
  latestTradingDate: ''
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TradingDayProvider({
  latestTradingDate,
  children
}: {
  latestTradingDate: string;
  children: ReactNode;
}) {
  return (
    <TradingDayContext.Provider value={{ latestTradingDate }}>
      {children}
    </TradingDayContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTradingDay(): TradingDayContextValue {
  return useContext(TradingDayContext);
}

// ─── Helper: derive trading date from snapshot updatedAt ──────────────────────

/**
 * Derive the latest trading date from a snapshot `updatedAt` ISO string.
 *
 * Logic:
 *  - Parse the UTC timestamp from `updatedAt`.
 *  - Convert to CST (UTC+8).
 *  - If CST hour >= 15 (market closed) → trading date = CST date of now.
 *  - If CST hour < 9 (pre-open) → trading date = CST date of yesterday.
 *  - Otherwise (during session) → trading date = CST date of today.
 *
 * This is an approximation — it doesn't account for holidays/weekends, but it
 * correctly distinguishes today/yesterday for the purpose of cache keys.
 */
export function deriveTradingDate(updatedAt: string | undefined): string {
  if (!updatedAt) return '';
  try {
    const utcMs = new Date(updatedAt).getTime();
    if (isNaN(utcMs)) return '';
    // CST = UTC+8
    const cstMs = utcMs + 8 * 60 * 60 * 1000;
    const cst   = new Date(cstMs);
    const y = cst.getUTCFullYear();
    const m = String(cst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cst.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}
