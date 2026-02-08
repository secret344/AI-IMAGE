# AI Agent Instructions / AI 智能体指引 (ai-image)

## 1. High-Level Details / 高级概述

### Project Summary / 项目摘要

This repo is a **browser-only SPA** for AI image quality evaluation: upload → preprocess → style tags → agent recommendation → prompt assembly → AI call → JSON validation → results → XMP export → local history. See [README.md](../README.md) and [V1_TECHNICAL_SPEC_EN.md](../V1_TECHNICAL_SPEC_EN.md).

本仓库是**纯前端 SPA**：上传 → 预处理 → 风格标签 → 角色推荐 → 提示词组装 → AI 调用 → JSON 校验 → 结果展示 → XMP 导出 → 本地历史。参考 [README.md](../README.md) 与 [V1_TECHNICAL_SPEC_CN.md](../V1_TECHNICAL_SPEC_CN.md)。

### Technology Stack / 技术栈

- React 18 + TypeScript, Vite 5.4.21
- Zustand for global state
- UI: shadcn/ui (Radix UI) + Tailwind CSS 3.3+ (Material Design 3 spacing/typography)
- i18n: react-i18next (en, zh)
- Storage: IndexedDB (Dexie.js) + localStorage; crypto: Web Crypto AES-GCM
- Lint/format: ESLint + Prettier; strict TypeScript

### Core Constraints / 核心约束

- agent执行结束清除掉生成的临时文件，历史总结报告。
- **Zero backend storage**: images/results never persist on servers; only browser storage.
- **BYOK**: user keys (OpenAI/Gemini/Claude) are client-side encrypted (AES-GCM), never sent to third parties.
- **Browser-only**: all compute runs in-browser; static hosting only.
- Image limits: ≤50MB (recommended ≤10MB); mobile prefer 2048px max edge.
- Output must be strict JSON; always validate and provide fallback.
- Personas fixed: Cartier-Bresson, Ansel Adams, Fan Ho, Peter Lindbergh, Kodak Portra.
- Global provider settings must be loaded by the Settings modal and synced into `useAppStore.globalProviderSettings`; other modules must NOT read localStorage directly for config.

### Multi-Round Conversation & Cost Control / 多轮对话与成本控制

- **messages 格式**：多轮对话必须用 `messages` 数组传递上下文，每条消息结构为 `{"role":"user|assistant","content":"..."}`；**不要**添加 `reasoning_content` 字段；`content` 仅允许字符串。
- **多模态消息**：本项目 `messages` 不使用数组形式；图像内容通过供应商请求体的图像字段单独传递。
- **上下文管理**：
  - **截断**：保留最近 N 轮对话，避免超出模型上下文限制。
  - **滚动摘要**：当上下文接近上限（如 70%）时，对早期对话生成“记忆摘要”，用摘要替换旧消息并拼接近期消息。
  - **向量化召回**：保存历史对话向量，按需检索相关片段并拼接入请求。
- **成本控制**：通过上下文管理减少输入 Token；优先使用支持 **上下文缓存** 的模型（如 qwen-max / qwen-plus）。

### Data Flow / 数据流

Upload & preprocess (Canvas 4096px, JPEG 0.85, EXIF scrub GPS/serial) → Style recognition (rule engine; top-3 tags+weights) → Agent recommendation (stable scoring) → Prompt assembly (system + agent + EXIF + tags, JSON-only) → AI call (OpenAI/Gemini/Claude) → JSON validation (fallback on failure) → Results display → Export XMP (Exposure/Contrast/Highlights/Shadows) → History (IndexedDB last 10, with parentTaskId chains).

### Key References / 关键参考

[README.md](../README.md) · [README_cn.md](../README_cn.md) · [V1_TECHNICAL_SPEC_EN.md](../V1_TECHNICAL_SPEC_EN.md) · [V1_TECHNICAL_SPEC_CN.md](../V1_TECHNICAL_SPEC_CN.md)

---

## 2. Build & Validation / 构建与验证

### Prerequisites / 前置条件

- Node.js 18+ (recommend 20 LTS), npm 9+
- Verify: `node --version`, `npm --version`

### Install & Dev / 安装与开发

```bash
npm install          # always after pull
npm run dev          # Vite dev server (http://localhost:5173)
npm run type-check   # TS only
npm run lint         # ESLint
npm run build        # production build to dist/
npm run preview      # serve built assets
npm run format       # Prettier
```

### Validation Before Commit / 提交前验证

1. `npm run type-check` → 0 errors
2. `npm run lint` → no warnings
3. `npm run build` → success; dist/assets/index-\*.js ~900-950 kB (uncompressed), ~300 kB gzipped

### Deployment / 部署

Static hosting only (Vercel/Netlify/GitHub Pages). Optional CORS proxy (Edge/Workers) for API calls. Deploy `dist/`.

---

## 3. Project Layout / 项目布局

### Directory Map / 目录地图

```
ai-image/
├── .github/
│   ├── copilot-instructions.md       # repository-wide instructions
│   └── workflows/                    # CI
├── src/
│   ├── components/                   # React components (PascalCase)
│   │   ├── ui/                       # shadcn/ui wrappers
│   │   ├── layout/                   # Header, SettingsModal
│   │   ├── history/                  # History panel suite
│   │   ├── upload/                   # Upload flow
│   │   ├── result/                   # Result display
│   │   └── ...
│   ├── modules/                      # Business logic (camelCase)
│   │   ├── ai/                       # Provider calls
│   │   ├── storage/                  # IndexedDB/localStorage
│   │   ├── upload/                   # Canvas + EXIF
│   │   ├── agent/                    # Recommendation engine
│   │   ├── export/                   # XMP generation
│   │   └── style-recognition/        # Style tagging
│   ├── state/                        # Zustand store (useAppStore.ts)
│   ├── types/                        # Types
│   ├── i18n/                         # locales/*.json, useLanguage.ts
│   ├── config/                       # agents.ts, style-tags.ts
│   ├── utils/                        # crypto, string, etc.
│   ├── styles/                       # globals.css, Tailwind
│   ├── App.tsx, main.tsx
├── public/
├── vite.config.ts, tsconfig.json, tailwind.config.ts
├── eslint.config.js, prettier.config.js
├── README.md, README_cn.md
├── V1_TECHNICAL_SPEC_EN.md, V1_TECHNICAL_SPEC_CN.md
```

### Key Modules / 关键模块

- State: `src/state/useAppStore.ts` single store
- History: `src/components/HistoryPanel.tsx` + `history/` subcomponents
- Upload: `src/components/UploadPanel.tsx`, `modules/upload/processImage.ts`
- Result: `src/components/ResultPanel.tsx`, `result/EvaluationResults.tsx`
- Settings: `src/components/SettingsPanel.tsx`, `layout/SettingsModal.tsx`
- AI: `modules/ai/callProvider.ts`, `modules/agent/recommendAgents.ts`
- Export: `modules/export/xmp.ts`

### Configuration / 配置

- `tsconfig.json`: strict true, path alias `@/`
- `tailwind.config.ts`: design tokens, dark mode
- `eslint.config.js`: @typescript-eslint/recommended, react-hooks/recommended
- `.github/workflows/`: CI runs type-check/lint/build

### Important Rules / 重要规则

- Strict TypeScript; absolute imports with `@/`
- All user-facing text via i18n (react-i18next)
- i18n JSON files must live ONLY in src/i18n/locales/_.json; do not create or keep duplicates in src/i18n/_.json
- Mobile-first responsive; semantic Tailwind tokens (text-foreground, bg-card, border-border)
- Zero backend storage; BYOK only; never log keys
- **Documentation Sync**: When modifying README.md, must also update README_cn.md with equivalent Chinese content. Both files should stay in sync.
- **文档同步**：修改 README.md 时，必须同步更新 README_cn.md 的对应中文内容。两个文件应保持同步。

---

## 4. Code Style Guide / 代码风格指南

This section outlines the coding standards and guidelines for the AI Image project, ensuring consistency, maintainability, and high-quality code. These guidelines are based on Google JavaScript/TypeScript Style Guide and React Best Practices, tailored to the project's browser-only SPA architecture.

本部分概述了AI Image项目的编码标准和指南，确保代码的一致性、可维护性和高质量。这些指南基于Google JavaScript/TypeScript风格指南和React最佳实践，针对项目的纯浏览器SPA架构进行了调整。

### General Principles / 一般原则

- **Readability First**: Code should be self-documenting and easy to understand.
- **Consistency**: Follow established patterns throughout the codebase.
- **Zero Backend Storage**: Respect the hard constraint of no server-side persistence.
- **Browser-Only**: All functionality must work in the browser environment.
- **TypeScript**: Use TypeScript for type safety and better developer experience.
- **Avoid Over-Engineering**: Keep solutions simple and focused; avoid unnecessary complexity or premature optimization.

- **可读性优先**：代码应自文档化且易于理解。
- **一致性**：在整个代码库中遵循既定模式。
- **零后端存储**：尊重无服务器端持久化的硬性约束。
- **仅浏览器**：所有功能必须在浏览器环境中工作。
- **TypeScript**：使用TypeScript以获得类型安全和更好的开发体验。
- **避免过度设计**：保持解决方案简单且专注；避免不必要的复杂性或过早优化。

### File Structure / 文件结构

Follow the Google project structure guidelines with React-specific adaptations:

遵循Google项目结构指南，并针对React进行调整：

```
src/
├── components/          # React components (PascalCase)
│   ├── ui/             # Reusable UI components
│   └── feature/        # Feature-specific components
├── modules/            # Business logic modules
│   ├── ai/            # AI provider integrations
│   ├── storage/       # Local storage utilities
│   └── upload/        # File upload processing
├── state/             # Global state management (Zustand)
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── i18n/              # Internationalization
├── config/            # Configuration files
└── styles/            # Styling (Tailwind CSS)
```

### Naming Conventions / 命名约定

#### Files and Directories / 文件和目录

- **Components**: PascalCase (e.g., `UploadPanel.tsx`)
- **Utilities/Modules**: camelCase (e.g., `processImage.ts`)
- **Types**: PascalCase with `Type` suffix (e.g., `StyleTagScore.ts`)
- **Directories**: lowercase with hyphens if needed (e.g., `style-recognition`)

- **组件**：PascalCase（例如，`UploadPanel.tsx`）
- **工具/模块**：camelCase（例如，`processImage.ts`）
- **类型**：PascalCase并以`Type`后缀（例如，`StyleTagScore.ts`）
- **目录**：小写，必要时使用连字符（例如，`style-recognition`）

#### Variables and Functions / 变量和函数

- **camelCase** for variables, functions, and methods
- **PascalCase** for classes, interfaces, and types
- **UPPER_SNAKE_CASE** for constants
- **Prefix with `_`** for private members (TypeScript private fields preferred)

- 变量、函数和方法使用**camelCase**
- 类、接口和类型使用**PascalCase**
- 常量使用**UPPER_SNAKE_CASE**
- 私有成员前缀`_`（首选TypeScript私有字段）

#### React-Specific / React特定

- **Components**: PascalCase function names
- **Hooks**: `use` prefix (e.g., `useAppStore`)
- **Props**: camelCase
- **Event Handlers**: `handle` prefix (e.g., `handleFileChange`)

- **组件**：PascalCase函数名
- **Hooks**：`use`前缀（例如，`useAppStore`）
- **Props**：camelCase
- **事件处理器**：`handle`前缀（例如，`handleFileChange`）

### TypeScript Guidelines / TypeScript指南

#### Type Definitions / 类型定义

```typescript
// Good: Explicit interface for complex objects
interface StyleRecognitionResult {
  styleTags: StyleTagScore[];
  inferenceTime: number;
  modelUsed: string;
}

// Good: Union types for constrained values
type Provider = 'openai' | 'gemini' | 'claude' | 'ollama';

// Avoid: Generic any types
// Bad: function process(data: any) { ... }
```

#### Null Safety / 空安全

- Use strict null checks (`strictNullChecks: true`)
- Prefer optional chaining (`?.`) over explicit null checks
- Use `??` for default values

- 使用严格空检查（`strictNullChecks: true`）
- 优先使用可选链（`?.`）而非显式空检查
- 使用`??`设置默认值

### React Best Practices / React最佳实践

#### Component Design / 组件设计

- **Functional Components**: Prefer function components over class components
- **Hooks**: Use built-in hooks appropriately
- **Custom Hooks**: Extract reusable logic into custom hooks
- **Composition**: Favor composition over inheritance

- **函数组件**：优先使用函数组件而非类组件
- **Hooks**：适当使用内置hooks
- **自定义Hooks**：将可重用逻辑提取到自定义hooks中
- **组合**：优先组合而非继承

#### State Management / 状态管理

- **Local State**: Use `useState` for component-specific state
- **Global State**: Use Zustand store for app-wide state
- **Derived State**: Compute from existing state when possible

- **本地状态**：使用`useState`处理组件特定状态
- **全局状态**：使用Zustand store处理应用级状态
- **派生状态**：尽可能从现有状态计算

#### Component Structure and Responsibilities / 组件结构与职责

- **Single Responsibility**: Each component should have one clear purpose and responsibility
- **Separation of Concerns**: Separate UI rendering, business logic, and side effects
- **Props Interface**: Define clear, typed props interfaces; avoid prop drilling with context or custom hooks
- **Event Handlers**: Use descriptive names (e.g., `handleSubmit`, `handleInputChange`); extract complex logic to custom hooks
- **Conditional Rendering**: Use early returns or ternary operators for clarity; avoid deeply nested conditionals
- **Component Naming**: Use descriptive names that reflect the component's purpose (e.g., `UserProfileCard` instead of `Card`)

- **单一职责**：每个组件应有一个明确的用途和职责
- **关注点分离**：将UI渲染、业务逻辑和副作用分离
- **Props接口**：定义清晰、类型化的props接口；使用context或自定义hooks避免props drilling
- **事件处理器**：使用描述性名称（例如，`handleSubmit`、`handleInputChange`）；将复杂逻辑提取到自定义hooks
- **条件渲染**：使用提前返回或三元运算符以提高清晰度；避免深度嵌套的条件语句
- **组件命名**：使用反映组件用途的描述性名称（例如，`UserProfileCard` 而非 `Card`）

#### Performance Optimization / 性能优化

- **Memoization**: Use `React.memo` for components that re-render frequently with same props
- **useMemo**: Cache expensive computations
- **useCallback**: Memoize event handlers passed to child components
- **Avoid Unnecessary Renders**: Ensure proper dependency arrays in hooks

- **记忆化**：对频繁重新渲染且props相同的组件使用`React.memo`
- **useMemo**：缓存昂贵的计算
- **useCallback**：记忆化传递给子组件的事件处理器
- **避免不必要的渲染**：确保hooks中的依赖数组正确

#### Component Patterns / 组件模式

- **Container/Presentational**: Separate data fetching (container) from presentation (component)
- **Compound Components**: Group related components together with shared state
- **Render Props**: For reusable logic that needs to render differently
- **Higher-Order Components**: For cross-cutting concerns (use sparingly, prefer hooks)

- **容器/展示组件**：将数据获取（容器）与展示（组件）分离
- **复合组件**：将相关组件与共享状态组合在一起
- **Render Props**：用于需要不同渲染的可重用逻辑
- **高阶组件**：用于横切关注点（谨慎使用，优先使用hooks）

#### Effects and Lifecycle / 效果与生命周期

```typescript
// Good: Proper dependency array
useEffect(() => {
  const handler = () => setOnline(navigator.onLine);
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}, []); // Empty array for mount/unmount only
```

- **useEffect**：处理副作用；在返回函数中清理
- **依赖数组**：包含所有依赖；使用ESLint规则捕获缺失的依赖
- **避免无限循环**：确保效果不会导致触发自身的重新渲染

### Code Organization / 代码组织

#### Import Order / 导入顺序

```typescript
// 1. React imports
import React, { useState, useEffect } from 'react';

// 2. Third-party libraries
import { useTranslation } from 'react-i18next';

// 3. Project modules (absolute imports)
import { useAppStore } from '@/state/useAppStore';
import { processImage } from '@/modules/upload/processImage';

// 4. Relative imports (rarely used)
import type { StyleTagScore } from '../config/style-tags';
```

#### Function Organization / 函数组织

- **Single Responsibility**: Each function should do one thing
- **Early Returns**: Use early returns to reduce nesting
- **Error Handling**: Use try/catch for async operations
- **Async/Await**: Prefer over Promise chains

- **单一职责**：每个函数应只做一件事
- **提前返回**：使用提前返回减少嵌套
- **错误处理**：对异步操作使用try/catch
- **Async/Await**：优先于Promise链

### Error Handling / 错误处理

#### API Calls / API调用

```typescript
// Good: Centralized error handling
try {
  const result = await callAiProvider(request);
  return result;
} catch (error) {
  console.error('AI call failed:', error);
  throw new AiError('Failed to process image', undefined, true);
}
```

- **集中错误处理**：对API调用使用集中错误处理

### Tool Configuration / 工具配置

#### ESLint / ESLint

- Extends: `@typescript-eslint/recommended`, `react-hooks/recommended`
- Custom rules for project-specific patterns

- 扩展：`@typescript-eslint/recommended`、`react-hooks/recommended`
- 项目特定模式的自定义规则

#### Prettier / Prettier

- Single quotes for strings
- Semicolons: required
- Trailing commas: ES5
- Tab width: 2 spaces

- 字符串使用单引号
- 分号：必需
- 尾随逗号：ES5
- 制表符宽度：2个空格

### Security Considerations / 安全考虑

- **Input Validation**: Validate all user inputs
- **API Keys**: Never log or expose API keys
- **CORS**: Handle CORS properly for API calls
- **Local Storage**: Encrypt sensitive data (AES-GCM)

- **输入验证**：验证所有用户输入
- **API密钥**：绝不记录或暴露API密钥
- **CORS**：正确处理API调用的CORS
- **本地存储**：加密敏感数据（AES-GCM）

### Performance Guidelines / 性能指南

- **Bundle Size**: Keep initial bundle under 1MB
- **Image Processing**: Use Canvas API efficiently
- **Memory Management**: Clean up event listeners and timers
- **Lazy Loading**: Load components and modules on demand

- **包大小**：保持初始包小于1MB
- **图像处理**：高效使用Canvas API
- **内存管理**：清理事件监听器和定时器
- **懒加载**：按需加载组件和模块

### Internationalization / 国际化

- **Strict i18n Usage**: All user-facing text must use i18n; never hardcode strings in components
- **Translation Keys**: Use descriptive keys following the pattern `namespace.key` (e.g., `upload.title`)
- **Language Support**: Support English (`en`) and Simplified Chinese (`zh`) as primary languages
- **Dynamic Content**: Use interpolation for dynamic values in translations
- **Pluralization**: Handle plural forms appropriately using i18n features
- **Date/Number Formatting**: Use i18n for locale-specific formatting
- **Accessibility**: Ensure translated text maintains accessibility features

- **严格使用i18n**：所有面向用户的文本必须使用i18n；组件中绝不硬编码字符串
- **翻译键**：使用描述性键遵循`namespace.key`模式（例如，`upload.title`）
- **语言支持**：主要支持英语（`en`）和简体中文（`zh`）
- **动态内容**：在翻译中使用插值处理动态值
- **复数形式**：使用i18n功能适当处理复数形式
- **日期/数字格式化**：使用i18n进行区域特定的格式化
- **可访问性**：确保翻译文本保持可访问性功能

#### i18n Implementation / i18n实现

```typescript
// Good: Using i18n in components
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('component.title')}</h1>
      <p>{t('component.description', { count: items.length })}</p>
    </div>
  );
}

// Avoid: Hardcoded strings
// Bad: <h1>Upload Image</h1>
```

#### Translation File Structure / 翻译文件结构

- **Namespaces**: Organize translations by feature (e.g., `upload`, `result`, `settings`)
- **Key Naming**: Use dot notation for hierarchical organization
- **Consistency**: Maintain consistent terminology across languages
- **Context**: Provide context comments for translators

- **命名空间**：按功能组织翻译（例如，`upload`、`result`、`settings`）
- **键命名**：使用点号表示层次结构
- **一致性**：在不同语言中保持一致的术语
- **上下文**：为翻译者提供上下文注释

### Documentation / 文档

#### Code Comments / 代码注释

- **JSDoc**: For public APIs and complex functions
- **Inline Comments**: For complex logic only
- **TODO Comments**: Use for temporary fixes or future improvements

- **JSDoc**：用于公共API和复杂函数
- **内联注释**：仅用于复杂逻辑
- **TODO注释**：用于临时修复或未来改进

#### README and Docs / README和文档

- Keep README up-to-date
- Document API interfaces
- Provide setup and usage instructions

- 保持README最新
- 记录API接口
- 提供设置和使用说明

### Agent-Specific Guidelines / Agent特定指南

For AI-assisted coding (GitHub Copilot, etc.):

针对AI辅助编码（GitHub Copilot等）：

#### Code Generation / 代码生成

- **Context Awareness**: Provide sufficient context for accurate suggestions
- **Pattern Consistency**: Follow existing code patterns in the project
- **Type Safety**: Ensure generated code is fully typed
- **Error Handling**: Include appropriate error handling in generated code
- **Simplicity**: Avoid over-engineering; implement the simplest solution that works

- **上下文意识**：提供足够上下文以获得准确建议
- **模式一致性**：遵循项目中的现有代码模式
- **类型安全**：确保生成的代码完全类型化
- **错误处理**：在生成的代码中包含适当的错误处理
- **简单性**：避免过度设计；实现最简单的可行解决方案

#### Component Generation Guidelines / 组件生成指南

- **Component Structure**: Always separate component logic from JSX; use early returns for conditional rendering
- **Props Design**: Define clear interfaces for props; use destructuring in function parameters
- **Hooks Usage**: Prefer custom hooks for complex logic; ensure proper dependency arrays
- **Performance**: Use memoization judiciously; avoid over-optimization
- **Accessibility**: Include ARIA attributes where appropriate; ensure keyboard navigation
- **Styling**: Use Tailwind CSS classes consistently; follow project's design system
- **Internationalization**: Always use i18n for user-facing text; never hardcode strings

- **组件结构**：始终将组件逻辑与JSX分离；对条件渲染使用提前返回
- **Props设计**：为props定义清晰的接口；在函数参数中使用解构
- **Hooks使用**：对复杂逻辑优先使用自定义hooks；确保正确的依赖数组
- **性能**：谨慎使用记忆化；避免过度优化
- **可访问性**：在适当的地方包含ARIA属性；确保键盘导航
- **样式**：一致使用Tailwind CSS类；遵循项目设计系统
- **国际化**：始终对面向用户的文本使用i18n；绝不硬编码字符串

#### Review Generated Code / 审查生成的代码

- **Manual Verification**: Always review and test generated code
- **Integration Testing**: Ensure generated code integrates properly
- **Performance Check**: Verify performance implications
- **Security Audit**: Check for potential security issues
- **Type Errors**: After each change, resolve any TypeScript/type errors before finishing

- **手动验证**：始终审查和测试生成的代码
- **集成测试**：确保生成的代码正确集成
- **性能检查**：验证性能影响
- **安全审计**：检查潜在安全问题
- **类型错误**：每次修改后先修复所有 TypeScript/类型错误再结束

This style guide should be followed by all contributors and AI agents to maintain code quality and consistency.

本风格指南应由所有贡献者和AI agent遵循，以维护代码质量和一致性。

## 5. UI Component Library Requirements / UI 组件库要求

### Design System / 设计系统

**框架 / Framework**

- Tailwind CSS 3.3+ with Material Design 3 principles (Material Design 3 原则)
- shadcn/ui component library (built on Radix UI) (组件库，基于 Radix UI)
- Google Material Design standards for spacing, typography, and interactions (谷歌 Material Design 标准)

### Mandatory shadcn/ui Components / 强制使用 shadcn/ui 组件

**CRITICAL RULE / 关键规则**
✅ **ALL UI elements MUST use shadcn/ui components** - No HTML tags for UI elements  
✅ **所有 UI 元素必须使用 shadcn/ui 组件** - 禁止使用原生 HTML 标签  
✅ **Import from `@/components/ui` exclusively** - 仅从 `@/components/ui` 导入

#### Layout & Container / 布局与容器

| Component                                                                           | Usage / 用途                                   | Do NOT / 禁止                           |
| :---------------------------------------------------------------------------------- | :--------------------------------------------- | :-------------------------------------- |
| `<Card />` + `<CardHeader />`, `<CardTitle />`, `<CardContent />`, `<CardFooter />` | All content boxes (所有内容框)                 | ❌ `<div className="...">`, `<section>` |
| `<Separator />`                                                                     | Dividing lines (分割线)                        | ❌ `<hr>`, custom borders               |
| `<AspectRatio />`                                                                   | Fixed aspect ratio containers (固定宽高比容器) | ❌ Custom ratio hacks                   |

#### Navigation / 导航

| Component                                                         | Usage / 用途                            | Do NOT / 禁止            |
| :---------------------------------------------------------------- | :-------------------------------------- | :----------------------- |
| `<NavigationMenu />`                                              | Complex navigation menus (复杂导航菜单) | ❌ Custom nav bars       |
| `<Breadcrumb />`                                                  | Breadcrumb navigation (面包屑导航)      | ❌ Hardcoded links       |
| `<Pagination />`                                                  | Page navigation (分页导航)              | ❌ Custom pagination UI  |
| `<Sidebar />` + `<SidebarContent />`, `<SidebarMenu />`           | Side navigation (侧边导航)              | ❌ Custom sidebars       |
| `<Tabs />` + `<TabsList />`, `<TabsTrigger />`, `<TabsContent />` | Tab switching (标签页切换)              | ❌ Custom tab components |

#### Forms / 表单

| Component                                                                 | Usage / 用途                              | Do NOT / 禁止                       |
| :------------------------------------------------------------------------ | :---------------------------------------- | :---------------------------------- |
| `<Button />`                                                              | All clickable actions (所有可点击操作)    | ❌ `<button>`, `<a href>`           |
| `<Input />`                                                               | Text inputs (文本输入)                    | ❌ `<input type="text">`            |
| `<Textarea />`                                                            | Multi-line text (多行文本)                | ❌ `<textarea>`                     |
| `<Label />`                                                               | Form labels (表单标签)                    | ❌ `<label>`                        |
| `<Checkbox />`                                                            | Boolean selection (布尔选择)              | ❌ `<input type="checkbox">`        |
| `<RadioGroup />` + `<RadioGroupItem />`                                   | Single choice (单选)                      | ❌ `<input type="radio">`           |
| `<Select />` + `<SelectTrigger />`, `<SelectContent />`, `<SelectItem />` | Dropdown selection (下拉选择)             | ❌ `<select>`, custom dropdowns     |
| `<Switch />`                                                              | Toggle switch (切换开关)                  | ❌ `<input type="checkbox">` styled |
| `<Slider />`                                                              | Value range (值范围)                      | ❌ `<input type="range">`           |
| `<Combobox />`                                                            | Searchable select (可搜索选择)            | ❌ Custom autocomplete              |
| `<Calendar />` + `<Popover />`                                            | Date picker (日期选择)                    | ❌ Custom date inputs               |
| `<Toggle />`                                                              | Button state toggle (按钮状态切换)        | ❌ Custom toggles                   |
| `<ToggleGroup />`                                                         | Multiple toggle buttons (多个切换按钮)    | ❌ Button group workarounds         |
| `<Form />`                                                                | Form container with validation (表单容器) | ❌ Plain `<form>` tags              |

#### Content Display / 内容展示

| Component                                              | Usage / 用途                      | Do NOT / 禁止                |
| :----------------------------------------------------- | :-------------------------------- | :--------------------------- |
| `<Badge />`                                            | Status labels (状态标签)          | ❌ Custom badges             |
| `<Alert />` + `<AlertTitle />`, `<AlertDescription />` | Alert messages (警告消息)         | ❌ Custom alert boxes        |
| `<Avatar />` + `<AvatarImage />`, `<AvatarFallback />` | User avatars (用户头像)           | ❌ `<img>` + custom fallback |
| `<Progress />`                                         | Progress bars (进度条)            | ❌ `<div>` based progress    |
| `<Skeleton />`                                         | Loading placeholders (加载占位符) | ❌ Custom skeleton screens   |
| `<Tooltip />`                                          | Hover tooltips (悬停提示)         | ❌ Custom tooltips           |
| `<Popover />`                                          | Floating content (浮动内容)       | ❌ Custom popovers           |
| `<HoverCard />`                                        | Hover preview cards (悬停预览卡)  | ❌ Custom hover behaviors    |

#### Overlays & Dialogs / 浮层与对话框

| Component                                                                                          | Usage / 用途                      | Do NOT / 禁止                       |
| :------------------------------------------------------------------------------------------------- | :-------------------------------- | :---------------------------------- |
| `<Dialog />` + `<DialogContent />`, `<DialogTitle />`, `<DialogDescription />`, `<DialogHeader />` | Modal dialogs (模态对话框)        | ❌ Custom modals, `position: fixed` |
| `<AlertDialog />` + `<AlertDialogContent />`, `<AlertDialogTitle />`, etc.                         | Confirmation dialogs (确认对话框) | ❌ Custom confirmation popups       |
| `<Drawer />`                                                                                       | Slide-out panels (滑出面板)       | ❌ Custom drawers                   |
| `<Sheet />`                                                                                        | Full-height overlays (全高浮层)   | ❌ Custom sheets                    |

#### Menus & Dropdowns / 菜单与下拉菜单

| Component                                                                                         | Usage / 用途                     | Do NOT / 禁止                       |
| :------------------------------------------------------------------------------------------------ | :------------------------------- | :---------------------------------- |
| `<DropdownMenu />` + `<DropdownMenuTrigger />`, `<DropdownMenuContent />`, `<DropdownMenuItem />` | Dropdown menus (下拉菜单)        | ❌ Custom dropdowns, nested `<div>` |
| `<ContextMenu />` + `<ContextMenuContent />`, etc.                                                | Right-click menus (右键菜单)     | ❌ Custom context menus             |
| `<Command />` + `<CommandInput />`, `<CommandList />`, `<CommandItem />`                          | Command palette (命令行调色板)   | ❌ Custom search inputs             |
| `<Menubar />`                                                                                     | Application menubar (应用菜单栏) | ❌ Custom menu bars                 |

#### Data Display / 数据展示

| Component                                                                         | Usage / 用途                       | Do NOT / 禁止                |
| :-------------------------------------------------------------------------------- | :--------------------------------- | :--------------------------- |
| `<Table />` + `<TableHeader />`, `<TableBody />`, `<TableRow />`, `<TableCell />` | Data tables (数据表格)             | ❌ `<table>`, custom tables  |
| `<DataTable />`                                                                   | Advanced data grids (高级数据网格) | ❌ DIY table implementations |

#### Feedback / 反馈

| Component                    | Usage / 用途                       | Do NOT / 禁止                 |
| :--------------------------- | :--------------------------------- | :---------------------------- |
| `<Toast />` (via Sonner)     | Temporary notifications (临时通知) | ❌ Custom toast notifications |
| `<Spinner />` / `<Loader />` | Loading indicators (加载指示器)    | ❌ Custom spinners            |

#### Utility / 工具

| Component            | Usage / 用途                               | Do NOT / 禁止             |
| :------------------- | :----------------------------------------- | :------------------------ |
| `<Collapsible />`    | Expandable sections (可展开部分)           | ❌ Custom collapse/expand |
| `<Resizable />`      | Resizable panels (可调整大小面板)          | ❌ Manual resize handlers |
| `<ScrollArea />`     | Scrollable containers (可滚动容器)         | ❌ Overflow divs          |
| `<VisuallyHidden />` | Screen reader only text (仅屏幕阅读器文本) | ❌ `display: none`        |

### Styling System / 样式系统

#### Spacing Scale (8px baseline) / 间距尺度（8px 基准）

```typescript
// ✅ CORRECT scale / 正确的比例
gap-2: 8px       gap-3: 12px      gap-4: 16px      gap-6: 24px
p-2: 8px         p-3: 12px        p-4: 16px        p-6: 24px
mt-3: 12px       mt-4: 16px       mt-6: 24px

// ❌ WRONG / 错误做法
gap-5, p-[13px], m-7, arbitrary spacing
```

#### Color Tokens (Semantic) / 色彩标记（语义化）

```typescript
// ✅ Always use / 始终使用
text-foreground              // Primary text (主要文本)
text-muted-foreground        // Secondary text (次要文本)
bg-card, bg-background       // Backgrounds (背景)
border-border                // Dividers (分隔线)
text-primary                 // Brand/actions (品牌/操作)
text-destructive             // Danger (危险)

// ❌ Never hardcode / 禁止硬编码
text-white, bg-black, border-slate-700, #fff, rgba(...)
```

#### Typography Hierarchy / 排版层级

```typescript
// Headlines / 标题
text-3xl font-bold           // H1 - Page title
text-2xl font-semibold       // H2 - Section header
text-xl font-semibold        // H3 - Subsection

// Body text / 正文
text-base font-normal        // Desktop body (桌面正文)
text-sm font-normal          // Mobile body (移动正文)

// Supporting / 辅助
text-xs text-muted-foreground // Captions (标题)
text-sm font-medium          // Labels (标签)
```

#### Responsive Design (Mobile-First) / 响应式设计（移动优先）

```typescript
// ✅ CORRECT / 正确
flex flex-col sm:flex-row    // Mobile: column, Desktop: row
text-sm sm:text-base lg:text-lg  // Scale by screen
gap-3 sm:gap-4 lg:gap-6      // Scale spacing
p-3 sm:p-4 lg:p-6            // Scale padding
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

// ❌ WRONG / 错误
flex flex-row md:flex-col    // Desktop-first (wrong order)
hidden md:block              // Hide mobile content
```

### Component Pattern Examples / 组件模式示例

**Pattern 1: Form Card / 表单卡片**

```tsx
<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
  <CardHeader className="pb-3 sm:pb-4">
    <CardTitle className="text-lg sm:text-xl">{t('title')}</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4 sm:space-y-5">
    <div className="space-y-2">
      <Label htmlFor="input">{t('label')}</Label>
      <Input id="input" placeholder={t('placeholder')} />
    </div>
    <div className="flex gap-2 pt-4 border-t border-border/50">
      <Button variant="outline" className="flex-1">
        {t('cancel')}
      </Button>
      <Button variant="default" className="flex-1">
        {t('confirm')}
      </Button>
    </div>
  </CardContent>
</Card>
```

**Pattern 2: Card Grid / 卡片网格**

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {items.map((item) => (
    <Card key={item.id} className="overflow-hidden flex flex-col">
      <div className="relative h-40 bg-muted">
        <img src={item.image} className="h-full w-full object-cover" />
        <Badge className="absolute right-2 top-2">{item.score}</Badge>
      </div>
      <CardContent className="flex-1 space-y-3 pt-4">
        <p className="text-sm font-medium">{item.title}</p>
        <Button size="sm" variant="outline" className="w-full">
          {t('action')}
        </Button>
      </CardContent>
    </Card>
  ))}
</div>
```

**Pattern 3: Action Bar / 操作栏**

```tsx
<div
  className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between 
                p-4 border border-border/50 rounded-lg"
>
  <div className="text-sm text-muted-foreground">
    <span className="font-medium text-foreground">{count}</span> selected
  </div>
  <div className="flex gap-2">
    <Button size="sm" variant="outline">
      {t('selectAll')}
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          {t('more')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>{t('export')}</DropdownMenuItem>
        <DropdownMenuItem>{t('delete')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
```

### Accessibility & Best Practices / 无障碍访问与最佳实践

**Required for All Components / 所有组件必需:**

```typescript
// Form labels must be associated / 表单标签必须关联
<Label htmlFor="id">{t('label')}</Label>
<Input id="id" />

// Dialogs require semantic structure / 对话框需要语义结构
<Dialog>
  <DialogTrigger asChild><Button>{t('open')}</Button></DialogTrigger>
  <DialogContent>
    <DialogTitle>{t('title')}</DialogTitle>
    <DialogDescription>{t('description')}</DialogDescription>
  </DialogContent>
</Dialog>

// Use ARIA for icons / 图标使用 ARIA
<Button aria-label={t('close')} size="sm" variant="ghost">
  <X className="h-4 w-4" />
</Button>

// Focus states / 焦点状态
className="focus-visible:ring-2 focus-visible:ring-primary"

// Keyboard navigation / 键盘导航
Tab, Enter, Escape supported (all shadcn components included)
```

### Material Design 3 Compliance / Material Design 3 合规

**Surface & Elevation / 表面与高度:**

```typescript
Level 0: bg-background        // Base container
Level 1: bg-card border-border/50      // Default card
Level 2: bg-card/50 backdrop-blur-sm shadow-md  // Elevated
Level 3: bg-primary text-primary-foreground shadow-lg  // Emphasized
```

**Interaction States / 交互状态:**

```typescript
Hover:    hover:bg-primary/10 hover:shadow-md transition-all
Active:   active:scale-95 active:shadow-inner
Focus:    focus-visible:ring-2 focus-visible:ring-primary
Disabled: disabled:opacity-50 disabled:cursor-not-allowed
```

### Component Usage Checklist / 组件使用检查清单

When implementing UI, verify / 实现 UI 时，验证：

- ✅ All buttons use `<Button />` with appropriate variant (所有按钮使用 Button 组件)
- ✅ All form inputs use `<Input />`, `<Label>`, `<Select />` (所有表单输入使用对应组件)
- ✅ Labels associated with inputs via `htmlFor` (标签与输入关联)
- ✅ Spacing follows 8px scale (间距遵循 8px 基准)
- ✅ Colors use semantic tokens, not hardcoded (色彩使用语义标记)
- ✅ Responsive design mobile-first (响应式设计移动优先)
- ✅ Dark mode compatible (深色模式兼容)
- ✅ All user-facing text uses i18n (所有用户文本使用 i18n)
- ✅ Keyboard navigation tested (键盘导航已测试)
- ✅ ARIA attributes included where needed (ARIA 属性已包含)
