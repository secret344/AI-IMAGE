/**
 * 验证翻译文件的一致性
 * 用法: node scripts/validate-i18n.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, '../src/i18n/locales');
const packageI18nDirs = [
  {
    name: 'investment',
    dir: path.join(__dirname, '../packages/investment/src/i18n/locales'),
    allowedTopLevel: new Set(['meta', 'host', 'investment'])
  },
  {
    name: 'image-studio',
    dir: path.join(__dirname, '../packages/image-studio/src/i18n/locales'),
    blockedTopLevel: new Set(['investment'])
  }
];

function getKeys(obj, prefix = '') {
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function validateI18n() {
  const zhPath = path.join(i18nDir, 'zh.json');
  const enPath = path.join(i18nDir, 'en.json');
  const jaPath = path.join(i18nDir, 'ja.json');

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  const ja = JSON.parse(fs.readFileSync(jaPath, 'utf-8'));

  const zhKeys = getKeys(zh).sort();
  const enKeys = getKeys(en).sort();
  const jaKeys = getKeys(ja).sort();

  const zhSet = new Set(zhKeys);
  const enSet = new Set(enKeys);
  const jaSet = new Set(jaKeys);

  let hasErrors = false;

  function validateParity(localeDir, scopeName) {
    const zhPath = path.join(localeDir, 'zh.json');
    const enPath = path.join(localeDir, 'en.json');
    const jaPath = path.join(localeDir, 'ja.json');

    const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    const ja = JSON.parse(fs.readFileSync(jaPath, 'utf-8'));

    const zhKeys = getKeys(zh).sort();
    const enKeys = getKeys(en).sort();
    const jaKeys = getKeys(ja).sort();

    const zhSet = new Set(zhKeys);
    const enSet = new Set(enKeys);
    const jaSet = new Set(jaKeys);

    for (const key of zhSet) {
      if (!enSet.has(key)) {
        console.error(`❌ [${scopeName}] 中文中存在，但英文中不存在: ${key}`);
        hasErrors = true;
      }
    }

    for (const key of jaSet) {
      if (!enSet.has(key)) {
        console.error(`❌ [${scopeName}] 日语中存在，但英文中不存在: ${key}`);
        hasErrors = true;
      }
    }

    for (const key of enSet) {
      if (!zhSet.has(key)) {
        console.error(`❌ [${scopeName}] 英文中存在，但中文中不存在: ${key}`);
        hasErrors = true;
      }
      if (!jaSet.has(key)) {
        console.error(`❌ [${scopeName}] 英文中存在，但日语中不存在: ${key}`);
        hasErrors = true;
      }
    }

    return { en, enKeys };
  }

  validateParity(i18nDir, 'root');

  for (const pkg of packageI18nDirs) {
    const { en: packageEn } = validateParity(pkg.dir, pkg.name);
    const topLevelKeys = Object.keys(packageEn);

    if (pkg.allowedTopLevel) {
      for (const key of topLevelKeys) {
        if (!pkg.allowedTopLevel.has(key)) {
          console.error(`❌ [${pkg.name}] 存在不允许的顶层命名空间: ${key}`);
          hasErrors = true;
        }
      }
    }

    if (pkg.blockedTopLevel) {
      for (const key of topLevelKeys) {
        if (pkg.blockedTopLevel.has(key)) {
          console.error(`❌ [${pkg.name}] 存在不应出现的顶层命名空间: ${key}`);
          hasErrors = true;
        }
      }
    }
  }

  if (!hasErrors) {
    console.log(`✅ 翻译文件一致性检查通过`);
    console.log(`   总计 ${enKeys.length} 个翻译键`);
    return 0;
  }

  console.log(`\n总计 ${zhKeys.length + enKeys.length + jaKeys.length} 个翻译键（重复计算）`);
  return 1;
}

const exitCode = validateI18n();
process.exit(exitCode);
