#!/usr/bin/env node

/**
 * 验证 i18n 配置的脚本
 * 检查：
 * 1. STYLE_TAGS 配置中的所有标签在翻译文件中都有对应的键
 * 2. 中文和英文翻译都是完整的
 */

import fs from 'fs';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

// 读取配置
const styleTagsPath = path.join(__dirname, 'src/config/style-tags.ts');
const styleTagsContent = fs.readFileSync(styleTagsPath, 'utf-8');

// 提取 STYLE_TAGS 数组
const match = styleTagsContent.match(/export const STYLE_TAGS = \[([\s\S]*?)\] as const/);
if (!match) {
  console.error('❌ 无法找到 STYLE_TAGS 定义');
  process.exit(1);
}

const tags = match[1]
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('//'))
  .map((line) => line.replace(/[',]/g, '').trim())
  .filter((line) => line.length > 0);

console.log(`✓ 找到 ${tags.length} 个风格标签`);

// 读取翻译文件
const zhPath = path.join(__dirname, 'src/i18n/zh.json');
const enPath = path.join(__dirname, 'src/i18n/en.json');

const zh = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

console.log(`✓ 中文翻译包含 ${Object.keys(zh.styleTags).length} 个标签`);
console.log(`✓ 英文翻译包含 ${Object.keys(en.styleTags).length} 个标签`);

// 检查所有标签是否都有翻译
let missingZh = [];
let missingEn = [];

for (const tag of tags) {
  if (!zh.styleTags[tag]) {
    missingZh.push(tag);
  }
  if (!en.styleTags[tag]) {
    missingEn.push(tag);
  }
}

if (missingZh.length === 0 && missingEn.length === 0) {
  console.log('\n✅ 所有验证通过！');
  console.log('   - 所有标签在中文翻译中都有对应的键');
  console.log('   - 所有标签在英文翻译中都有对应的键');
  process.exit(0);
} else {
  console.error('\n❌ 验证失败！');
  if (missingZh.length > 0) {
    console.error(`   缺失中文翻译的标签: ${missingZh.join(', ')}`);
  }
  if (missingEn.length > 0) {
    console.error(`   缺失英文翻译的标签: ${missingEn.join(', ')}`);
  }
  process.exit(1);
}
