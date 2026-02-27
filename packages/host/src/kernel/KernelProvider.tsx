import { createContext, useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import type { KernelContextValue, KernelPermission } from '@ai-image/contracts';
import { createInMemoryKernelTelemetry } from '@host/kernel/telemetry';

export const KernelContext = createContext<KernelContextValue | null>(null);

const I18N_LANGUAGE_KEY = 'i18n-language';

interface KernelProviderProps extends PropsWithChildren {
  activeAppId: string;
  permissions: KernelPermission[];
}

export function KernelProvider({ activeAppId, permissions, children }: KernelProviderProps) {
  const telemetryRef = useRef<KernelContextValue['telemetry'] | null>(null);

  const kernel = useMemo<KernelContextValue>(() => {
    const telemetry = telemetryRef.current ?? createInMemoryKernelTelemetry();
    telemetryRef.current = telemetry;

    const storage: KernelContextValue['storage'] = {
      async get<T>(key: string): Promise<T | null> {
        const raw = localStorage.getItem(key);
        if (!raw) {
          return null;
        }
        return JSON.parse(raw) as T;
      },
      async set<T>(key: string, value: T): Promise<void> {
        localStorage.setItem(key, JSON.stringify(value));
      },
      async remove(key: string): Promise<void> {
        localStorage.removeItem(key);
      }
    };

    const os: KernelContextValue['os'] = {
      notify(message: string): void {
        const startedAt = performance.now();

        if (!permissions.includes('notify')) {
          telemetry.recordEvent({
            appId: activeAppId,
            eventName: 'os.notify',
            success: false,
            durationMs: performance.now() - startedAt,
            errorMessage: 'Permission denied: notify'
          });
          console.warn(`[kernel.notify] blocked for app ${activeAppId}`);
          return;
        }

        telemetry.recordEvent({
          appId: activeAppId,
          eventName: 'os.notify',
          success: true,
          durationMs: performance.now() - startedAt
        });
        console.info(`[kernel.notify] ${message}`);
      },
      async openAppWindow(entryPath: string): Promise<boolean> {
        const normalizedPath = entryPath.startsWith('/') ? entryPath : `/${entryPath}`;

        if (window.hostKernel?.runtime === 'electron' && window.hostKernel.openSubAppWindow) {
          return window.hostKernel.openSubAppWindow(normalizedPath);
        }

        const openedWindow = window.open(normalizedPath, '_blank', 'noopener,noreferrer');
        return openedWindow !== null;
      }
    };

    return {
      storage,
      os,
      telemetry
    };
  }, [activeAppId, permissions]);

  useEffect(() => {
    window.hostKernelRuntime = {
      appId: activeAppId,
      os: {
        notify: kernel.os.notify
      },
      i18n: {
        getLanguage: () => localStorage.getItem(I18N_LANGUAGE_KEY),
        setLanguage: (language: string) => {
          localStorage.setItem(I18N_LANGUAGE_KEY, language);
          window.dispatchEvent(
            new CustomEvent('host:i18n-language-changed', {
              detail: { language }
            })
          );
        }
      }
    };

    return () => {
      if (window.hostKernelRuntime?.appId === activeAppId) {
        delete window.hostKernelRuntime;
      }
    };
  }, [activeAppId, kernel.os.notify]);

  return <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>;
}
