import { useEffect } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/state/useThemeStore';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * 主题提供者组件
 * 应在应用根部使用，初始化主题系统
 * @param {ThemeProviderProps} props - 提供者组件属性
 * @return {JSX.Element} 返回提供者组件
 */
export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const { theme: storedTheme } = useThemeStore();
  const { setTheme: setCurrentTheme } = useTheme();

  // 同步存储的主题到 hook
  useEffect(() => {
    if (storedTheme) {
      setCurrentTheme(storedTheme);
    }
  }, [storedTheme, setCurrentTheme]);

  return <>{children}</>;
}

/**
 * 暴露全局的主题 hook 以供任何组件使用
 * @return {object} 返回主题配置和设置函数
 */
export function useThemeConfig() {
  const { theme: storedTheme, setTheme: setStoredTheme } = useThemeStore();
  const { effectiveTheme } = useTheme();

  const setTheme = (newTheme: typeof storedTheme) => {
    setStoredTheme(newTheme);
    // 更新 DOM
    const root = document.documentElement;
    if (newTheme === 'light') {
      root.classList.remove('dark');
    } else if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      // system 模式，由 useTheme hook 处理
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  return {
    theme: storedTheme,
    effectiveTheme,
    setTheme
  };
}
