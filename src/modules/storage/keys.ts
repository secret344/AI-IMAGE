import { encryptText, decryptText } from '@/lib/crypto';

const STORAGE_KEY = 'ai-image-keys';

export async function saveApiKey(label: string, value: string, passphrase: string): Promise<void> {
  const encrypted = await encryptText(value, passphrase);
  const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  payload[label] = encrypted;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export async function loadApiKey(label: string, passphrase: string): Promise<string | null> {
  const payload = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  const encrypted = payload[label];
  if (!encrypted) {
    return null;
  }
  return decryptText(encrypted, passphrase);
}
