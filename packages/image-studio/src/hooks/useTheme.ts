import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeHookReturn {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

/**
 * 主题管理 Hook
 * 支持：亮色、暗色、跟随系统
 * 本地存储到 localStorage，键为 'app-theme'
 * @return {ThemeHookReturn} 返回主题状态和设置函数
 */
export function useTheme(): ThemeHookReturn {
  const [theme, setThemeState] = useState<Theme>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark');
  const [mounted, setMounted] = useState(false);

  // 初始化主题（从 localStorage 读取）
  useEffect(() => {
    const stored = localStorage.getItem('app-theme') as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    } else {
      setThemeState('system');
    }
    setMounted(true);
  }, []);

  // 监听系统主题变化并应用主题
  useEffect(() => {
    if (!mounted) return;

    const applyTheme = () => {
      let effectiveThemeValue: 'light' | 'dark';

      if (theme === 'system') {
        // 检查系统偏好
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveThemeValue = isDark ? 'dark' : 'light';
      } else {
        effectiveThemeValue = theme;
      }

      setEffectiveTheme(effectiveThemeValue);

      // 应用到 DOM
      const root = document.documentElement;
      if (effectiveThemeValue === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // 监听系统主题变化（仅在 system 模式下）
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();

      // 新版 API
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
      }
      // 旧版 API 回退
      else {
        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
      }
    }
  }, [theme, mounted]);

  // 切换主题并保存到 localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app-theme', newTheme);
  };

  return {
    theme,
    effectiveTheme,
    setTheme
  };
}
