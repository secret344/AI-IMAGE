# GitHub Copilot Custom Instructions

This file provides repository-wide guidance for GitHub Copilot.  
For detailed, path-specific instructions, see `.github/instructions/` directory.

---

## Project Overview / 项目概述

**Monorepo desktop/web app** with host + subapps architecture. Current primary subapps:

- `packages/image-studio` (AI image quality evaluation)
- `packages/investment` (investment/news analysis)
- `packages/host` (micro-kernel launcher/runtime)
- `packages/contracts` (shared typed contracts)

**单仓多包桌面/网页应用**，采用 host + subapp 微内核结构。当前核心子包：

- `packages/image-studio`（AI 图片评估）
- `packages/investment`（投资/资讯分析）
- `packages/host`（基座启动台与运行时）
- `packages/contracts`（共享类型契约）

**Tech Stack**: React 18 + TypeScript, Vite 5.4.21, Zustand, shadcn/ui + Tailwind CSS, react-i18next, IndexedDB + Web Crypto AES-GCM

---

## Core Constraints / 核心约束

- ✅ **Zero backend storage**: Browser-only (IndexedDB + localStorage)
- ✅ **BYOK**: Client-side encrypted API keys (never sent to servers)
- ✅ **Strict JSON**: Always validate AI responses with fallback
- ✅ **i18n parity**: Keep en.json, zh.json, and ja.json synchronized
- ✅ **Mobile-first**: Responsive design, max image 2048px edge
- ✅ **shadcn/ui mandatory**: No native HTML for UI elements
- ✅ **TypeScript strict**: No `any`, optional chaining, type safety
- ✅ **No generated artifacts**: Do not commit Vite/TypeScript outputs (e.g., `.vite/`, `vite.config.d.ts`, `*.tsbuildinfo`)

---

## Essential Commands / 基本命令

```bash
npm install          # Install dependencies
npm run dev          # Local dev (http://localhost:5173)
npm run type-check   # TypeScript check
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # Production build
```

**Before Commit**:

1. `npm run type-check` → 0 errors
2. `npm run lint` → no warnings
3. `npm run build` → success

---

## Project Structure / 项目结构

```
packages/
├── host/                   # Host launcher + kernel runtime
├── image-studio/           # AI image app
├── investment/             # Investment app
├── contracts/              # Shared contracts/types
└── ui/                     # Shared shadcn/ui wrapper layer

src/
├── entries/                # Root entry files (host/bootstrap)
├── i18n/                   # Root i18n resources
└── styles/                 # Root shared styles
```

---

## Key Rules / 核心规则

### Code Quality

- Strict TypeScript: `strictNullChecks: true`, no `any` types
- Absolute imports with `@/` alias
- Early returns, optional chaining (`?.`), nullish coalescing (`??`)
- Try/catch for async operations, avoid promise chains
- JSDoc comments: File-level + Props interface + Export function

### UI & Styling

- **ALL UI elements use shadcn/ui** (no native HTML tags for UI)
- Tailwind semantic tokens: `text-foreground`, `bg-card`, `border-border`
- 8px spacing scale: `gap-2` (8px), `gap-3` (12px), `p-4` (16px), etc.
- Mobile-first responsive: `flex flex-col sm:flex-row lg:grid`

### Data & Storage

- Zero backend persistence (IndexedDB/localStorage only)
- Never expose/log API keys (client-side AES-GCM encryption)
- Validate all external data (strict JSON from AI)
- Safe EXIF serialization/deserialization

### State Management

- Use Zustand store with selectors (never subscribe to entire store)
- Application settings: `useAppStore((s) => s.globalProviderSettings) ?? getDefaults()`
- Track state changes with `useRef` to avoid duplicate updates
- Pass settings to children via props, not store access

### Error Handling & Analytics

- Classify errors: timeout, network, canceled, unknown
- Support both English & Chinese error detection
- Record errors once per unique message (use `useRef` to track)
- Return typed object: `{ category: 'timeout'|'network'|..., label: string|null }`

### Internationalization

- All user text via i18n (import `useTranslation()` from react-i18next)
- Pattern: `namespace.key` (e.g., `upload.title`, `result.score`)
- Update en.json, zh.json, and ja.json together
- No hardcoded strings in components
- Host-first policy: when running inside host, subapps must prioritize host language settings; local settings are fallback only

### Contracts & Boundaries

- Shared contracts must be imported from `@ai-image/contracts`, `@ai-image/contracts/kernel`, `@ai-image/contracts/manifest`, or `@ai-image/contracts/manifest-schema`
- Do not import removed/internal subpaths (e.g., `@ai-image/contracts/kernel-types`, `@ai-image/contracts/service-contracts`)
- Host no longer supports subapp business service registration (`services.ts` / `serviceRegistry`); expose only standardized host capabilities
- Keep contracts minimal: remove unused wrappers/exports and prefer single authoritative function per flow
- Add JSDoc for exported contract interfaces/functions to keep host/subapp collaboration explicit

### Advanced Patterns

- **Checkpoint/Rollback**: Support rollback for multi-round conversations
- **useRef for deduplication**: Detect state changes without causing re-renders
- **API Key Passphrase**: Support encrypted key encryption with optional passphrase
- **Avoid duplicated logic**: Before adding any new logic, search for existing helpers/utilities and reuse or extend them. Keep shared operations centralized (e.g., `src/utils/`) instead of re-implementing per module. For thinking/content separation, centralize in `src/utils/thinking.ts` and do not re-implement per module.
- **Important Technical Details**:
  - Image limits: ≤50MB (recommended ≤10MB)
  - Canvas preprocessing: 4096px max, JPEG 0.85 quality
  - EXIF: Remove GPS/serial before processing
  - Agent execution: Clear temp files on completion

---

## Path-Specific Instructions / 路径特定指令

This repository includes detailed path-specific instructions in `.github/instructions/`:

1. **react-components.instructions.md** (`src/components/**/*.tsx`)
   - Component patterns, shadcn/ui mandatory rules, i18n, responsive design

2. **modules.instructions.md** (`src/modules/**/*.ts`)
   - Module structure, error handling, JSON validation, encryption safety

3. **state-types.instructions.md** (`src/state/**/*.ts,src/types/**/*.ts`)
   - Zustand single store, type definitions, type safety patterns

4. **i18n.instructions.md** (`src/i18n/**/*`)
   - Translation structure, namespace organization, EN-ZH-JA consistency

5. **contracts.instructions.md** (`packages/contracts/src/**/*.ts`)
   - Contracts boundary, API surface minimization, JSDoc and compatibility rules

> Note: The actual codebase is monorepo-based. Apply these rules to equivalent package paths under `packages/*/src/**` as well.

6. **akshare-apis.instructions.md** (`electron/**/*.py`, `electron/**/*.cjs`, `packages/investment/src/**`)
   - AKShare Python interface contracts for all A-share market APIs
   - Correct parameter names, period values, date formats, and column mappings
   - Mode dispatch table: which AKShare function to call for each `--mode` and period
   - **Critical rules**: minute K uses `stock_zh_a_hist_min_em` (not `stock_zh_a_hist`), date format differs between daily and minute APIs

---

## References / 参考

- [README.md](../README.md) / [README_cn.md](../README_cn.md)
- [V1_TECHNICAL_SPEC_EN.md](../V1_TECHNICAL_SPEC_EN.md) / [V1_TECHNICAL_SPEC_CN.md](../V1_TECHNICAL_SPEC_CN.md)
