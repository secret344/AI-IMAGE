import { create } from 'zustand';
import type { ProviderSettings } from '@/modules/storage/settings';
interface AppState {
  isOnline: boolean;
  globalProviderSettings: ProviderSettings | null;
  setIsOnline: (value: boolean) => void;
  setGlobalProviderSettings: (value: ProviderSettings) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  globalProviderSettings: null,
  setIsOnline: (value) => set({ isOnline: value }),
  setGlobalProviderSettings: (value) => set({ globalProviderSettings: value })
}));
