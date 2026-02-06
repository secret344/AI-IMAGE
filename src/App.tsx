import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { UploadPanel } from '@/components/UploadPanel';
import { ResultPanel } from '@/components/ResultPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { CustomAgentsPanel } from '@/components/CustomAgentsPanel';
import { useAppStore } from '@/state/useAppStore';

export function App() {
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

  return (
    <Layout>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <UploadPanel />
          <HistoryPanel />
          <CustomAgentsPanel />
        </div>
        <ResultPanel />
      </div>
    </Layout>
  );
}
