import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Theme } from '@/hooks/useTheme';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * 主题状态管理（Zustand + 本地存储持久化）
 * 与 useTheme hook 配合使用
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme: Theme) => set({ theme })
    }),
    {
      name: 'app-theme-store',
      partialize: (state) => ({ theme: state.theme })
    }
  )
);
