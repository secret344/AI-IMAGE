---
applyTo: 'packages/contracts/src/**/*.ts'
---

# Contracts Layer Guidelines / 契约层规范

This file defines rules for `packages/contracts/src/**`.

该文档约束 `packages/contracts/src/**` 的修改方式。

## Purpose / 目标

The contracts package is the boundary between host and subapps. Keep it minimal, stable, and explicit.

contracts 包是 host 与子应用之间的边界层，必须保持最小、稳定、明确。

## Public API Surface / 对外暴露面

Only expose stable entrypoints:

- `@ai-image/contracts`
- `@ai-image/contracts/kernel`
- `@ai-image/contracts/manifest`
- `@ai-image/contracts/manifest-schema`

Do NOT add or re-introduce ad-hoc subpath exports unless there is a clear cross-package need.

除非有明确跨包需求，不要新增或恢复临时子路径导出。

## Design Rules / 设计规则

1. **Single authoritative flow**
   - Avoid duplicate wrappers for the same behavior.
   - Keep one canonical function per flow.

2. **Type-first contracts**
   - Use strict TypeScript (`unknown` over `any`).
   - Favor explicit interfaces and narrow union types.

3. **Runtime-neutral definitions**
   - Contracts should describe behavior, not implementation details.
   - Do not place UI/framework logic in contracts.

4. **Backward compatibility first**
   - Additive changes are preferred.
   - If a breaking change is unavoidable, update all consumers in the same PR.

5. **Host-first i18n bridge behavior**
   - `KernelRuntimeBridge` i18n fields must preserve host-priority semantics.
   - Subapps should be able to read host language and fallback locally.

## Documentation / 文档要求

All exported interfaces/types/functions require concise JSDoc:

- What it represents
- Who consumes it (host/subapp/shared)
- Any important compatibility notes

所有导出的接口/类型/函数都应带简洁 JSDoc，说明用途、使用方和兼容性注意事项。

## Validation Checklist / 提交前检查

When changing contracts:

1. Verify consumer imports still resolve.
2. Run `npm --prefix packages/contracts run test`.
3. Run workspace `npm run type-check`.
4. Ensure no unused exports remain.

修改 contracts 后必须完成以上检查。

## Single-Developer Optimizations / 单人开发优化

For current solo development, use a lightweight but safe workflow:

当前单人开发阶段，建议采用“轻量但安全”的流程：

1. **One change, one pass**
   - Keep each contracts change focused on one concern.
   - Avoid large mixed refactors across multiple domains in one pass.

2. **Minimum required checks (fast path)**
   - Always run:
     - `npm --prefix packages/contracts run test`
     - `npm run type-check`
   - Run full build only for release/merge milestones.

3. **Pragmatic compatibility rule**
   - Prefer additive changes.
   - If a breaking change is needed, update all current consumers immediately in the same PR/commit (no delayed migration plan required for now).

4. **Lightweight change log**
   - For each contracts change, add 1-3 lines in PR/commit notes:
     - what changed,
     - affected imports,
     - whether migration is needed.

5. **Re-upgrade trigger (for future team mode)**
   - When contributors > 1 or external packages consume contracts, switch back to stricter process:
     - mandatory full build matrix,
     - explicit compatibility notes,
     - versioned change policy.
