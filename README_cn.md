# AI 图片质量分析助手

隐私优先的浏览器工具，帮助摄影师快速评估和改进作品。零后端存储，支持多个AI供应商。

**核心特性：**

- 🔐 **零后端存储** - 所有处理在浏览器内完成，图片不上传到服务器
- 🎯 **5位摄影师风格** - 卡蒂埃-布列松、安塞尔·亚当斯、范何、彼得·林德伯格、柯达Portra
- 📊 **4维度评分** - 构图、光线、色彩、主体（0-100分 + 评分理由）
- 💬 **结果讨论** - 与AI进行多轮对话，深入讨论评分和改进建议
- 🖼️ **Lightroom导出** - 生成XMP侧车文件，一键导入修图参数
- ⚡ **BYOK模式** - 自带API密钥，无需账户，仅需付费使用

**多语言支持：** 英文、简体中文、日语

## 快速开始

### 1. 上传图片
- 拖拽或点击选择 JPEG、PNG、WebP 格式图片
- 大小限制：最多 50MB（推荐 ≤10MB）
- EXIF 元数据会自动提取并清理（保护隐私）

### 2. 风格识别
- 自动识别图片风格标签（城市、纪实、景观、人像等）
- 推荐最匹配的摄影师风格

### 3. AI评估
- 选择目标摄影师风格
- 获得 4 个维度的评分（构图、光线、色彩、主体）
- 包含详细的评分理由和改进建议

### 4. 结果讨论
- 与 AI 进行多轮对话讨论评分
- 提出改进想法并获得建议
- 深入理解各维度的评分逻辑

### 5. 导出结果
- 下载 Lightroom XMP 文件
- 导出修图步骤和参数
- 查看历史记录和任务链接

## 技术栈

| 层级 | 技术 |
|:--|:--|
| **构建** | Vite 5+ |
| **框架** | React 18 + TypeScript |
| **样式** | Tailwind CSS 3.3+ (Material Design 3) |
| **组件** | shadcn/ui + Radix UI |
| **状态管理** | Zustand |
| **存储** | IndexedDB (Dexie.js) + localStorage |
| **加密** | Web Crypto AES-GCM |
| **国际化** | react-i18next (en, zh, ja) |
| **部署** | 静态托管 (Vercel/Netlify/GitHub Pages) |

## 核心设计原则

- **零后端存储** - 图片和结果永不上传服务器；完全在浏览器计算
- **BYOK模式** - 用户自带API密钥，无需账户，无订阅费用
- **隐私优先** - EXIF自动清理，密钥AES-GCM加密，无追踪无分析
- **静态部署** - 支持Vercel/Netlify/GitHub Pages，零服务器维护

## 发展路线图

- **第1版 (已完成)** - 浏览器应用、5种风格、3个AI供应商、本地存储
- **第2版** - 批量评估、自定义Agent、高级对话、模型对比
- **第3版** - 移动应用、离线模式、社区样本库、可选API网关

## 安装与配置

### 开发环境

```bash
git clone <repository-url>
cd ai-image
npm install
npm run dev     # http://localhost:5173
```

### 添加 API 密钥

在设置面板添加密钥（AES-GCM加密保存于浏览器localStorage）：
- [OpenAI Vision](https://platform.openai.com/api-keys)
- [Google Gemini](https://aistudio.google.com/app/apikey)
- [Claude](https://console.anthropic.com/account/keys)

## 成本指南

| 供应商 | 成本 |
|:--|:--|
| OpenAI Vision (GPT-4V) | ~$0.015-0.03/张 |
| Google Gemini Pro | ~$0.005-0.01/张 |
| Claude 3 Vision | ~$0.005-0.015/张 |

**优化建议**: 图片哈希去重(节省20-30%)、风格预检(过滤低置信图片)

## 安全与隐私

- **EXIF清理** - 自动移除GPS和设备序列号
- **密钥加密** - AES-GCM 256位加密存储于浏览器
- **无数据收集** - 无追踪、无分析、无广告
- **GDPR合规** - 数据最小化、用户同意、可删除数据

## 文档

- [完整技术规格](V1_TECHNICAL_SPEC_CN.md)
- [English Version](README.md)
- [同步状态](SYNC_STATUS.md)
