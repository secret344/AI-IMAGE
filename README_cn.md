# AI 图片质量分析助手

[English README](README.md)

## 概述

**AI 图片质量分析助手** 是一款隐私优先的浏览器工具，帮助摄影师通过 AI 分析来评估和改进作品。具有零后端存储、5位摄影师风格多人格评估，以及 4 大维度评分（构图、光线、色彩、主体）的特点。

**支持语言**: 英文、简体中文、日语

**核心特性：**

- 🔐 **隐私优先** - 所有处理在浏览器内完成，图片永不上传服务器
- 🎯 **5位摄影师风格** - 卡蒂埃-布列松、安塞尔·亚当斯、范何、彼得·林德伯格、柯达Portra
- 📊 **4维度评分** - 构图、光线、色彩、主体（0-100分含评分理由）
- 💬 **AI对话讨论** - 与评估结果深度对话，探索更多见解
- 🖼️ **XMP导出** - 支持Lightroom集成
- 🔑 **BYOK模式** - 自带API密钥（无需订阅）

---

## 快速开始

1. **上传** → 拖拽或点击 JPEG、PNG、WebP（≤50MB，推荐 ≤10MB）
2. **等待** → 自动风格识别（~1-2秒）
3. **查看** → 选择摄影师风格并查看AI评分
4. **讨论** → 与Agent对话深入了解
5. **导出** → 下载Lightroom XMP侧车文件

---

## 特性

### 核心工作流

- **图片上传** - 拖拽/点击上传，自动Canvas压缩（4096px最大，质量0.85）
- **风格识别** - 规则引擎分类至16个风格类别
- **AI评估** - 多人格评分含维度理由
- **结果讨论** - 与AI对话探索反馈和后续问题
- **智能历史** - IndexedDB保存最近10张评估，支持一键重评
- **XMP导出** - 生成Lightroom兼容侧车文件

### 摄影师风格

| 风格     | 摄影师        | 重点                 |
| :------- | :------------ | :------------------- |
| 街拍叙事 | 卡蒂埃-布列松 | 决定性瞬间、构图     |
| 风景史诗 | 安塞尔·亚当斯 | 色调范围、景深       |
| 城市几何 | 范何          | 光影几何、极简       |
| 人像质感 | 彼得·林德伯格 | 肌理、眼神光、自然感 |
| 胶片色彩 | 柯达Portra    | 柔和色调、色彩层次   |

### 隐私与安全

- **EXIF清理** - 移除GPS、设备序列号，保留曝光数据
- **密钥加密** - AES-GCM 256位本地存储
- **离线处理** - 无需后端
- **GDPR合规** - 无追踪，一键数据清除

---

## 技术栈

| 组件         | 技术                  | 用途         |
| :----------- | :-------------------- | :----------- |
| **构建**     | Vite 5.0+             | 快速打包     |
| **框架**     | React 18 + TypeScript | UI与逻辑     |
| **样式**     | Tailwind + ShadcnUI   | 设计系统     |
| **状态管理** | Zustand               | 全局状态     |
| **存储**     | IndexedDB (Dexie)     | 任务历史     |
| **加密**     | Web Crypto API        | AES-GCM密钥  |
| **国际化**   | react-i18next         | EN/ZH/JP支持 |
| **AI集成**   | OpenAI/Gemini/Claude  | 评估引擎     |
| **部署**     | Vercel/Netlify        | 静态托管     |

---

## 安装与配置

```bash
# 克隆仓库
git clone <repository-url>
cd ai-image

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建
npm run build

# 类型检查
npm run type-check
```

### 配置

1. **在设置面板添加API密钥：**
   - OpenAI Vision: https://platform.openai.com/api-keys
   - Google Gemini: https://aistudio.google.com/app/apikey
   - Claude: https://console.anthropic.com/account/keys

2. **密钥本地加密** (AES-GCM)，永远不会发送至第三方

3. **本地Ollama开发：**
   - 安装Ollama: https://ollama.ai
   - 拉取视觉模型: `ollama pull llama2-vision`
   - 无需API密钥

---

## 设计原则

### 🔐 隐私优先

- 图片永不上传服务器
- 所有计算在浏览器内
- EXIF数据自动清理（移除GPS、设备序列号）
- API密钥本地加密（AES-GCM 256位）

### 💰 BYOK模式（自带密钥）

- 无需账户
- 无订阅费用
- 完全成本透明
- 用户控制API支出

### ⚡ 零后端

- 仅支持静态部署（Vercel/Netlify/GitHub Pages）
- 无需服务器维护
- 全球CDN支持
- API调用可选CORS代理

## API 成本指南

| 供应商          | 单张成本     | 说明                |
| :-------------- | :----------- | :------------------ |
| OpenAI Vision   | ~$0.01-0.03  | 基于图像大小+提示词 |
| Google Gemini   | ~$0.005-0.01 | 按字符计费          |
| Claude 3 Vision | ~$0.01-0.02  | 输入/输出Token计费  |

**成本优化建议：**

- 使用Ollama本地评估（免费）
- 同图同Agent重评 = 零成本（缓存）
- 消息历史自动限制以防止Token膨胀

---

## 安全与隐私

### 数据保护

- **EXIF清理**: 移除GPS坐标、设备序列号
- **密钥加密**: AES-GCM 256位加密所有API密钥
- **仅本地存储**: 图片仅存储在IndexedDB，无传输
- **无追踪**: 零第三方分析或Cookie

### GDPR合规

- 数据最小化（图片不在服务器持久化）
- 一键"清除所有数据"选项
- 无个人数据收集
- 可选加密密码保护密钥存储

---

## 文档与支持

- 📖 **技术规范**: [V1_TECHNICAL_SPEC_CN.md](V1_TECHNICAL_SPEC_CN.md)
- 🌐 **English README**: [README.md](README.md)
- ✅ **完成检查清单**: [COMPLETION_CHECKLIST.md](COMPLETION_CHECKLIST.md)
- 🔄 **同步状态**: [SYNC_STATUS.md](SYNC_STATUS.md)

## 参与贡献

我们欢迎贡献！请：

1. Fork本仓库
2. 创建功能分支
3. 提交包含清晰描述的Pull Request

## 许可证

MIT License - 详见LICENSE文件

---

**版本**: 1.0.0  
**状态**: ✅ 积极开发  
**最后更新**: 2026-02-08
