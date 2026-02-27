import { useEffect } from 'react';
import { useAppStore } from '@/state/useAppStore';

/**
 * Manages network status tracking
 * Updates app store when online/offline status changes
 */
export function useNetworkStatus() {
  const { setIsOnline } = useAppStore();

  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [setIsOnline]);
}
