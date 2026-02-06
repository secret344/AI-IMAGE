/**
 * 验证翻译文件的一致性
 * 用法: node scripts/validate-i18n.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, '../src/i18n');

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

  const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
  const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

  const zhKeys = getKeys(zh).sort();
  const enKeys = getKeys(en).sort();

  const zhSet = new Set(zhKeys);
  const enSet = new Set(enKeys);

  let hasErrors = false;

  // 检查中文中存在但英文中不存在的键
  for (const key of zhSet) {
    if (!enSet.has(key)) {
      console.error(`❌ 中文中存在，但英文中不存在: ${key}`);
      hasErrors = true;
    }
  }

  // 检查英文中存在但中文中不存在的键
  for (const key of enSet) {
    if (!zhSet.has(key)) {
      console.error(`❌ 英文中存在，但中文中不存在: ${key}`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log(`✅ 翻译文件一致性检查通过`);
    console.log(`   总计 ${zhKeys.length} 个翻译键`);
    return 0;
  }

  console.log(`\n总计 ${zhKeys.length + enKeys.length} 个翻译键（重复计算）`);
  return 1;
}

const exitCode = validateI18n();
process.exit(exitCode);
