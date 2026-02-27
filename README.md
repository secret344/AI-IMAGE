# AI-IMAGE Monorepo

[中文版 README](README_cn.md)

## Overview

AI-IMAGE is a privacy-first, frontend-focused monorepo with a **host + subapps** architecture.

Current primary packages:

- `packages/host`: host launcher and micro-kernel runtime
- `packages/image-studio`: AI image quality evaluation app
- `packages/investment`: A-share market analysis app (AKShare via Electron bridge)
- `packages/contracts`: shared typed contracts across host and subapps
- `packages/ui`: shared shadcn/ui wrapper components

Supported languages: **English (en), Simplified Chinese (zh), Japanese (ja)**

## Core Principles

- **Zero backend storage**: browser-only persistence (IndexedDB/localStorage)
- **BYOK**: API keys are encrypted client-side (Web Crypto AES-GCM)
- **Strict JSON validation**: AI outputs are validated with fallback strategy
- **Host-first i18n**: host language has priority when running subapps in host
- **Mobile-first UI**: responsive layouts and constrained image preprocessing

## Repository Structure

```text
packages/
   host/          # Host launcher/runtime
   image-studio/  # AI image evaluation subapp
   investment/    # Investment/news analysis subapp
   contracts/     # Shared contracts and schemas
   ui/            # Shared UI components

electron/
   main.cjs
   preload.cjs
   akshare_query.py

src/
   entries/       # Root entries for host/subapps
   i18n/          # Root i18n resources
```

## Quick Start

```bash
npm install

# Root app dev
npm run dev

# Package-level dev
npm run dev:host:pkg
npm run dev:image-studio:pkg
npm run dev:investment:pkg

# Run host + subapps together
npm run dev:packages
```

## Scripts

- `npm run dev`: root Vite development server
- `npm run dev:host:pkg`: run `@ai-image/host`
- `npm run dev:image-studio:pkg`: run `@ai-image/image-studio`
- `npm run dev:investment:pkg`: run `@ai-image/investment`
- `npm run dev:packages`: run all package dev servers in parallel
- `npm run electron:dev`: start Vite + Electron desktop shell flow
- `npm run electron:start`: launch Electron directly
- `npm run type-check`: TypeScript project references check
- `npm run lint`: ESLint over workspace
- `npm run build`: production build
- `npm run test:contracts`: run contracts package tests
- `npm run i18n:validate`: validate EN/ZH/JA key parity

## Technology Stack

- React 19 + TypeScript
- Vite 7
- Zustand
- shadcn/ui + Tailwind CSS
- react-i18next
- IndexedDB + Web Crypto (AES-GCM)
- Electron (desktop host bridge)

## Documentation

- [README_cn.md](README_cn.md)
- [V1_TECHNICAL_SPEC_EN.md](V1_TECHNICAL_SPEC_EN.md)
- [V1_TECHNICAL_SPEC_CN.md](V1_TECHNICAL_SPEC_CN.md)
- [docs/micro_kernel_architecture.md](docs/micro_kernel_architecture.md)
- [docs/a股市场接口.md](docs/a股市场接口.md)
- [MIGRATION_DRILL.md](MIGRATION_DRILL.md)
- [SYNC_STATUS.md](SYNC_STATUS.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Open a pull request with a clear scope and test notes

## License

MIT License. See [LICENSE](LICENSE).

---

**Version**: 0.1.0  
**Status**: Active Development  
**Last Updated**: 2026-02-27
