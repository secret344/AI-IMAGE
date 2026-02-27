const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(plainText: string, passphrase: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plainText)
  );

  const payload = {
    iv: Array.from(iv),
    salt: Array.from(salt),
    data: Array.from(new Uint8Array(encrypted))
  };

  return btoa(JSON.stringify(payload));
}

export async function decryptText(cipherText: string, passphrase: string): Promise<string> {
  const payload = JSON.parse(atob(cipherText)) as { iv: number[]; salt: number[]; data: number[] };
  const iv = new Uint8Array(payload.iv);
  const salt = new Uint8Array(payload.salt);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    new Uint8Array(payload.data)
  );

  return decoder.decode(decrypted);
}
