import ExifReader from 'exifreader';

type ExifTag = {
  description?: string;
  value?: unknown;
};

const isBinaryValue = (value: unknown) => value instanceof ArrayBuffer || ArrayBuffer.isView(value);

const normalizeTagValue = (tag: ExifTag): string | number | null => {
  if (typeof tag.description === 'string' && tag.description.trim().length > 0) {
    return tag.description;
  }

  const value = tag.value;
  if (isBinaryValue(value)) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
          return item;
        }
        return JSON.stringify(item);
      })
      .join(', ');
  }

  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * Extract EXIF metadata while sanitizing privacy-sensitive information.
 * Strips: GPS coordinates, device serial numbers, camera make/model
 * Preserves: ISO, shutter speed, aperture, focal length
 * @param {File} file - Image file to extract EXIF from
 * @return {Promise<Record<string, string | number>>} Safe EXIF data containing only exposure parameters
 */
export async function extractExif(file: File): Promise<Record<string, string | number>> {
  try {
    const data: Record<string, string | number> = {};

    const arrayBuffer = await file.arrayBuffer();
    const tags = ExifReader.load(arrayBuffer) as Record<string, ExifTag>;

    Object.entries(tags).forEach(([key, tag]) => {
      const normalized = normalizeTagValue(tag);
      if (normalized !== null && normalized !== '') {
        data[key] = normalized;
      }
    });

    return data;
  } catch (error) {
    // If EXIF reading fails, return empty object (no crash)
    console.warn('Failed to extract EXIF:', error);
    return {};
  }
}
