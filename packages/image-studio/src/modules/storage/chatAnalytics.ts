/**
 * Lightweight chat failure analytics stored in localStorage.
 */

export type ChatFailureCategory = 'timeout' | 'network' | 'canceled' | 'unknown';

export interface ChatFailureStats {
  counts: Record<ChatFailureCategory, number>;
  lastAt: number | null;
  lastCategory: ChatFailureCategory | null;
  lastMessage: string | null;
}

const STORAGE_KEY = 'chat_failure_stats_v1';

const DEFAULT_STATS: ChatFailureStats = {
  counts: {
    timeout: 0,
    network: 0,
    canceled: 0,
    unknown: 0
  },
  lastAt: null,
  lastCategory: null,
  lastMessage: null
};

function readStats(): ChatFailureStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_STATS };
    }
    const parsed = JSON.parse(raw) as ChatFailureStats;
    return {
      ...DEFAULT_STATS,
      ...parsed,
      counts: {
        ...DEFAULT_STATS.counts,
        ...parsed.counts
      }
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function writeStats(next: ChatFailureStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors to avoid breaking chat flow.
  }
}

export function recordChatFailure(category: ChatFailureCategory, message?: string | null) {
  const stats = readStats();
  stats.counts[category] = (stats.counts[category] ?? 0) + 1;
  stats.lastAt = Date.now();
  stats.lastCategory = category;
  stats.lastMessage = message ?? null;
  writeStats(stats);
}

export function getChatFailureStats(): ChatFailureStats {
  return readStats();
}
