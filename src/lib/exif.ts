import piexif from 'piexifjs';

// Per V1 Technical Spec: Only preserve safe EXIF keys, strip GPS and device serials
const SAFE_EXIF_KEYS = {
  33434: 'ExposureTime', // Exposure time
  33437: 'FNumber', // F-number
  34855: 'ISO', // ISO speed rating
  34864: 'SensitivityType',
  37377: 'ShutterSpeedValue',
  37378: 'ApertureValue',
  37379: 'BrightnessValue',
  37380: 'ExposureBiasValue',
  37381: 'MaxAperture',
  37383: 'MeteringMode',
  37384: 'LightSource',
  37385: 'Flash',
  37386: 'FocalLength',
  41483: 'FlashPixVersion',
  41486: 'FocalPlaneXResolution',
  41487: 'FocalPlaneYResolution',
  41488: 'FocalPlaneResolutionUnit',
  41989: 'FocalLengthIn35mm',
  41990: 'SceneCaptureType',
  41991: 'GainControl',
  41992: 'Contrast',
  41993: 'Saturation',
  41994: 'Sharpness'
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
    // piexifjs only supports JPEG EXIF parsing
    if (!file.type.toLowerCase().includes('jpeg') && !file.type.toLowerCase().includes('jpg')) {
      return {};
    }

    // Read file as Data URL for piexifjs (recommended approach)
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binary = piexif.load(dataUrl) as any;
    const data: Record<string, string | number> = {};

    // Extract from Exif IFD (main EXIF data)
    if (binary.Exif) {
      Object.entries(binary.Exif).forEach(([tagId, value]) => {
        const id = Number(tagId);
        if (SAFE_EXIF_KEYS[id as keyof typeof SAFE_EXIF_KEYS]) {
          const key = SAFE_EXIF_KEYS[id as keyof typeof SAFE_EXIF_KEYS];
          // Handle different value types
          if (Array.isArray(value)) {
            const firstVal = value[0];
            if (typeof firstVal === 'string' || typeof firstVal === 'number') {
              data[key] = firstVal;
            }
          } else if (typeof value === 'string' || typeof value === 'number') {
            data[key] = value;
          }
        }
      });
    }

    // Extract ISO from main IFD if available
    if (binary['0th']) {
      Object.entries(binary['0th']).forEach(([tagId, value]) => {
        const id = Number(tagId);
        if (id === 34855) {
          // ISO tag
          if (Array.isArray(value)) {
            const firstVal = value[0];
            if (typeof firstVal === 'string' || typeof firstVal === 'number') {
              data.ISO = firstVal;
            }
          } else if (typeof value === 'string' || typeof value === 'number') {
            data.ISO = value;
          }
        }
      });
    }
    console.log('Extracted EXIF data:', data);
    return data;
  } catch (error) {
    // If EXIF reading fails, return empty object (no crash)
    console.warn('Failed to extract EXIF:', error);
    return {};
  }
}
