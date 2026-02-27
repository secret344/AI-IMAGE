import { clearHistory } from '@/modules/storage/history';

const KEYS = ['ai-image-keys', 'ai-image-provider-settings'];

export async function clearLocalData(): Promise<void> {
  KEYS.forEach((key) => localStorage.removeItem(key));
  await clearHistory();
}
