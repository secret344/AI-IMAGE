# AI-IMAGE Monorepo

[English README](README.md)

## 概述

AI-IMAGE 是一个隐私优先、以前端为主的 monorepo，采用 **host + subapps** 微内核架构。

当前核心包：

- `packages/host`：基座启动台与运行时
- `packages/image-studio`：AI 图片评估子应用
- `packages/investment`：A 股行情/资讯分析子应用（通过 Electron + AKShare）
- `packages/contracts`：host 与子应用共享类型契约
- `packages/ui`：共享 shadcn/ui 封装组件

支持语言：**英文 (en)、简体中文 (zh)、日语 (ja)**

## 核心约束

- **零后端存储**：仅使用浏览器 IndexedDB/localStorage
- **BYOK**：API Key 客户端本地加密（Web Crypto AES-GCM）
- **严格 JSON**：AI 输出必须校验并带回退策略
- **基座优先 i18n**：在 host 中运行时优先使用 host 语言
- **移动优先 UI**：响应式布局与图片预处理约束

## 仓库结构

```text
packages/
   host/          # 基座运行时
   image-studio/  # 图片评估子应用
   investment/    # 投资分析子应用
   contracts/     # 共享契约与 schema
   ui/            # 共享 UI 组件

electron/
   main.cjs
   preload.cjs
   akshare_query.py

src/
   entries/       # host/subapps 根入口
   i18n/          # 根级国际化资源
```

## 快速开始

```bash
npm install

# 根应用开发
npm run dev

# 包级开发
npm run dev:host:pkg
npm run dev:image-studio:pkg
npm run dev:investment:pkg

# 并行启动所有包
npm run dev:packages
```

## 常用脚本

- `npm run dev`：根 Vite 开发服务
- `npm run dev:host:pkg`：启动 `@ai-image/host`
- `npm run dev:image-studio:pkg`：启动 `@ai-image/image-studio`
- `npm run dev:investment:pkg`：启动 `@ai-image/investment`
- `npm run dev:packages`：并行启动所有子包
- `npm run electron:dev`：启动 Vite + Electron 联调流程
- `npm run electron:start`：直接启动 Electron
- `npm run type-check`：TypeScript 工程引用检查
- `npm run lint`：全仓 ESLint
- `npm run build`：生产构建
- `npm run test:contracts`：运行 contracts 包测试
- `npm run i18n:validate`：校验 EN/ZH/JA 键一致性

## 技术栈

- React 19 + TypeScript
- Vite 7
- Zustand
- shadcn/ui + Tailwind CSS
- react-i18next
- IndexedDB + Web Crypto (AES-GCM)
- Electron（桌面壳与桥接）

## 文档

- [README.md](README.md)
- [V1_TECHNICAL_SPEC_CN.md](V1_TECHNICAL_SPEC_CN.md)
- [V1_TECHNICAL_SPEC_EN.md](V1_TECHNICAL_SPEC_EN.md)
- [docs/micro_kernel_architecture.md](docs/micro_kernel_architecture.md)
- [docs/a股市场接口.md](docs/a股市场接口.md)
- [MIGRATION_DRILL.md](MIGRATION_DRILL.md)
- [SYNC_STATUS.md](SYNC_STATUS.md)

## 参与贡献

1. Fork 仓库
2. 创建功能分支
3. 提交包含清晰范围与测试说明的 Pull Request

## 许可证

MIT License，详见 [LICENSE](LICENSE)。

---

**版本**: 0.1.0  
**状态**: 积极开发中  
**最后更新**: 2026-02-27
