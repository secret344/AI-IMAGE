/**
 * EXIF 字段常量配置
 * 定义常用的EXIF字段，用于：
 * 1. AI评估时的prompt参数（避免过多无用信息）
 * 2. 用户界面展示时的默认过滤
 */

/**
 * 常用EXIF字段列表
 * 包含摄影中最重要的拍摄参数
 */
export const COMMON_EXIF_KEYS = [
  // 曝光参数
  'ISO',
  'FNumber',
  'ExposureTime',
  'ShutterSpeedValue',
  'ApertureValue',
  'BrightnessValue',
  'ExposureBiasValue',

  // 焦距参数
  'FocalLength',
  'FocalLengthIn35mm',
  'FocalLengthIn35mmFilm',

  // 测光与白平衡
  'MeteringMode',
  'LightSource',
  'Flash',
  'WhiteBalance',

  // 相机与镜头信息
  'Make',
  'Model',
  'LensModel',

  // 时间信息
  'DateTimeOriginal',
  'DateTime'
];

/**
 * 常用EXIF字段的Set（用于快速查找）
 */
export const COMMON_EXIF_KEYS_SET = new Set<string>(COMMON_EXIF_KEYS);

/**
 * Filter EXIF data to keep only common fields
 * @param {Record<string, string|number>} exif - Complete EXIF data
 * @return {Record<string, string|number>} EXIF data containing only common fields
 */
export function filterCommonExif(
  exif: Record<string, string | number>
): Record<string, string | number> {
  if (!exif || Object.keys(exif).length === 0) {
    return {};
  }

  const filtered: Record<string, string | number> = {};

  for (const key of COMMON_EXIF_KEYS) {
    if (key in exif && exif[key] != null) {
      filtered[key] = exif[key];
    }
  }

  return filtered;
}
