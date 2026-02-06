export function assertFileSize(file: File, maxSizeMb: number): void {
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`File exceeds ${maxSizeMb}MB.`);
  }
}
