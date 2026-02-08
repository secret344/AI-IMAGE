# Copilot Custom Instructions / Copilot 自定义指令

This directory contains GitHub Copilot custom instructions for the ai-image repository.

本目录包含 ai-image 仓库的 GitHub Copilot 自定义指令。

## Structure / 结构

### Repository-Wide Instructions / 仓库级指令

**File**: `../.github/copilot-instructions.md`

Applies to all files in the repository. Contains high-level project overview, build commands, and general rules.

适用于仓库中的所有文件。包含高级项目概述、构建命令和常规规则。

### Path-Specific Instructions / 路径特定指令

Located in `.github/instructions/` directory. Each file applies to specific code areas:

位于 `.github/instructions/` 目录。每个文件适用于特定的代码区域：

| File | Applies To | Purpose / 用途 |
|:--|:--|:--|
| `react-components.instructions.md` | `src/components/**/*.tsx` | React 组件开发规范：命名、shadcn/ui 使用、i18n、样式 |
| `modules.instructions.md` | `src/modules/**/*.ts` | 业务逻辑模块规范：错误处理、类型安全、API 集成 |
| `state-types.instructions.md` | `src/state/**/*.ts` + `src/types/**/*.ts` | 状态管理与类型定义规范：Zustand store、接口设计 |
| `i18n.instructions.md` | `src/i18n/**/*` | 国际化规范：翻译键组织、中英对等性 |

## How They Work / 工作原理

When you work on any file matching the glob patterns above, GitHub Copilot automatically loads the corresponding path-specific instructions along with the repository-wide instructions.

当你在任何匹配上述 glob 模式的文件上工作时，GitHub Copilot 自动加载相应的路径特定指令和仓库级指令。

**Priority order** (highest to lowest):
1. Path-specific instructions (most specific match)
2. Repository-wide instructions (.github/copilot-instructions.md)

**优先级顺序**（从高到低）：
1. 路径特定指令（最具体的匹配）
2. 仓库级指令

Example:
- Working on `src/components/UploadPanel.tsx` → loads `react-components.instructions.md` + main instructions
- Working on `src/modules/ai/client.ts` → loads `modules.instructions.md` + main instructions
- Working on `src/config/agents.ts` → loads only main instructions (no path-specific match)

## Key Rules / 关键规则

### React Components / React 组件

- ✅ Always use **shadcn/ui** components from `@/components/ui/`
- ✅ Use **i18n** for all user-facing text via `useTranslation()`
- ✅ **Functional components only**, use Hooks
- ✅ Mobile-first responsive design
- ❌ Never use native HTML tags for UI (`<button>`, `<input>`, `<div className="...">`)
- ❌ Never hardcode strings

### Modules / 模块

- ✅ Business logic should be **reusable and testable**
- ✅ Always **validate** external JSON responses
- ✅ Use **try-catch** for async operations
- ✅ **Type safety**: explicit return types, no `any`
- ❌ Never expose API keys; always encrypt before storing
- ❌ Don't mix framework-specific code with business logic

### State & Types / 状态与类型

- ✅ Single **Zustand store** for all global state
- ✅ Always define **proper types** for everything
- ✅ Never read **localStorage** directly (use the store)
- ✅ Use **type unions** for constrained values
- ❌ Never use `any` type
- ❌ Don't duplicate types across files

### i18n / 国际化

- ✅ Add to **both** `en.json` and `zh.json` (must maintain parity)
- ✅ Use **namespace.key** naming: `upload.title`, `result.score`
- ✅ Use **Intl APIs** for date/number formatting
- ❌ Never hardcode English text in components
- ❌ Don't forget Chinese translation (parity required)

## Testing Instructions / 测试指令

To verify Copilot is using these instructions:

1. In VS Code, open a file that matches one of the globs above
2. Open Copilot Chat
3. Look for the instructions file reference in the response references
4. Check if suggestions follow the defined rules

## Maintaining Instructions / 维护指令

When updating instructions:

1. Keep instructions **short and actionable** (preferably < 500 lines each)
2. Use **clear examples** with ✅ (good) and ❌ (bad) patterns
3. Include **both English and Chinese** for clarity
4. Update glob patterns if directory structure changes
5. Document new rules in both files (`../copilot-instructions.md` and path-specific)

---

**Last Updated**: 2026-02-08  
**Version**: 1.0.0  
**Status**: Active
