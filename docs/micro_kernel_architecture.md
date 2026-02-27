# 个人工具应用微内核架构设计方案 (Micro-Kernel Architecture)

## 1. 核心设计理念

本方案放弃复杂的样式隔离（Shadow DOM/Iframe），拥抱 **单体仓库 (Monorepo) + 共享上下文 (Shared Context) + 动态路由加载 (Dynamic Route Loading)** 的模式。

这更像是一个 **"操作系统 (OS) + 应用程序 (Apps)"** 的关系：
*   **Host (基座)** = OS（提供窗口管理、API、全局状态、底层服务）。
*   **App (子应用)** = 进程（专注于业务逻辑，复用 OS 的 UI 组件库和能力）。

核心目标：**开发时解耦（独立仓库/目录），运行时聚合（同一个 React 树）。**

### 当前落地（2026-02）

本仓库已从“根目录扁平应用结构”迁移为 **`src/apps/*` 子包式结构**，并开始接入 Electron 基座脚手架：

*   `packages/host/src`：基座内核（应用发现、权限、标准化能力接口、遥测）
*   `packages/image-studio/src`：AI Image 主业务子包（组件、hooks、state、modules、types 等）
*   `packages/investment/src`：投资分析子包（骨架 + 多页面能力）
*   `packages/ui/src`：统一 UI 封装层（所有子包共享）
*   `electron/`：Electron 主进程与 preload（桌面基座壳层）

为兼容存量代码，保留了 `@/xxx` 导入体验，并补充 `@image-studio/*` 子包别名用于显式子包边界。

---

## 2. 总体架构图

```mermaid
graph TD
  User[用户] --> Electron[Electron Host (基座)]
  Electron --> Renderer[Renderer React App]
    
    subgraph "Core Layer (基座核心)"
      Renderer --> Router[动态路由中心]
      Renderer --> Store[全局状态 (Zustand)]
      Renderer --> EventBus[消息总线]
      Renderer --> KernelAPI[系统内核 API]
    end
    
    subgraph "Shared Infrastructure (共享基建)"
        Router --> UI[UI 组件库 (Shadcn)]
        Store --> Hooks[Hooks 工具库]
      Electron --> Preload[Preload Bridge]
      KernelAPI --> BrowserAPI[Browser API / Local Storage]
      KernelAPI --> NativeAPI[Electron Native API]
    end
    
    subgraph "Capabilities (扩展能力)"
        KernelAPI --> Network[网络请求]
        KernelAPI --> FileSys[文件系统]
        KernelAPI --> Notify[通知系统]
    end
    
    subgraph "Apps Layer (业务应用)"
        Router --> AppInvest[投资分析 App]
        Router --> AppReader[RSS 阅读器 App]
        Router --> AppTodo[待办事项 App]
    end
```

---

## 3. 详细分层设计

### Layer 1: The Kernel (基座内核)
*负责 "加载" 和 "赋能" 子应用。*

*   **AppLoader (应用加载器)**:
  *   读取并聚合子应用 `manifest.ts`。
  *   利用 `componentLoader`（动态 import）按需加载子应用入口组件。
    *   **关键**: 不使用 iframe。子应用运行在同一个 Renderer React 树中。
*   **Electron Shell (桌面壳层)**:
    *   主进程负责窗口生命周期、外链打开、生产/开发资源加载。
    *   Preload 通过 `contextBridge` 暴露受控能力给 Renderer。
*   **SDK Injection (能力注入)**:
    *   通过 React Context (`<KernelProvider>`) 向下并通过 Props 传递核心对象 `kernel`。
    *   子应用通过 `useKernel()` Hook 获取能力：打开新标签页、调用 Python 接口、获取全局主题。
*   **Standardized Capabilities (标准化能力接口)**:
  *   Host 内核只提供通用基础能力（如 `notify`、语言桥接、窗口能力），不内嵌业务服务分发。
  *   子应用业务能力在子应用内部维护，避免跨边界数据结构耦合。
  *   新增 Host 能力时，按统一能力接口增量扩展。
*   **Manifest 驱动注册 (单一来源)**:
  *   每个子应用提供 `manifest.ts`（声明 UI 元信息 + 入口组件 + 权限）。
  *   Host 通过 `import.meta.glob('../*/manifest.ts', { eager: true })` 自动发现 manifest 并生成 `appRegistry`。
  *   结果是“新增子应用 = 新增 manifest 文件”，无需再修改注册列表或内核代码。
  *   子应用入口使用 `componentLoader`（动态 import），基座按需懒加载，降低初始包体。
*   **权限控制 (Permission Gating)**:
  *   manifest 声明 `permissions`（如 `storage` / `network` / `notify`）。
  *   Host 在执行基础能力前进行权限校验，未授权时拒绝执行。
*   **版本与灰度控制**:
  *   manifest 支持 `enabled`、`order`、`minHostVersion`。
  *   Host 启动时根据这些字段自动过滤与排序子应用，实现灰度开关和版本兼容控制。
*   **可观测性 (Telemetry)**:
  *   Kernel 记录内核能力事件（如 `os.notify`）的 `appId`、事件名、成功率、耗时、错误信息。
  *   为后续性能优化与故障排查提供基础数据。

### Layer 2: The Shared UI (共享界面)
*保证视觉一致性，极大减少子应用代码量。*

*   **Design System**:
  *   `packages/ui/src`: 统一封装 Shadcn/ui 组件层（Button/Card/Select/Dialog 等）。
  *   **Layouts**: 提供标准布局与 Header/Settings 等基座复用组件。
*   **Shared Components**:
    *   `StockTicker`: 一个通用的股票行情条组件，投资 App 和 Dashboard 都能用。

### Layer 3: The Apps (子应用)
*独立的业务逻辑包，只关注 "内容"。*

*   **结构标准**:
  *   每个 App 建议提供入口 `index.ts`（统一导出 `App/manifest`）。
  *   必须包含 `manifest.ts`: 定义 App 元数据、入口加载器、权限。
*   **开发体验**:
  *   当前在单仓 `src/apps/*` 下进行子包化开发。
  *   通过 manifest 的 `enabled/order/minHostVersion` 控制启停、排序与兼容。

---

## 4. 目录结构规划（当前仓库）

```text
electron/
├── main.cjs
└── preload.cjs

packages/
├── host/
│   ├── package.json
│   └── src/
├── image-studio/
│   ├── package.json
│   └── src/
├── investment/
│   ├── package.json
│   └── src/
└── ui/
  ├── package.json
  └── src/

src/
├── entries/
├── i18n/
├── styles/
├── App.tsx
└── main.tsx
```

---

## 5. 核心代码契约 (Code Contract)

### 1. 基座如何加载子应用？

```typescript
// packages/host/src/manifests.ts
const manifestModules = import.meta.glob('../*/manifest.ts', { eager: true });

export const hostAppManifests = Object.values(manifestModules)
  .flatMap((module) => Object.values(module))
  .filter(isHostAppManifest)
  .filter((manifest) => manifest.enabled !== false)
  .filter((manifest) => isVersionCompatible(manifest.minHostVersion))
  .sort(sortByOrderThenId);
```

### 1.1 Electron 如何承载 Renderer？

```javascript
// electron/main.cjs
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'),
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false
  }
});

if (!app.isPackaged) {
  win.loadURL('http://localhost:5173');
} else {
  win.loadFile(path.join(__dirname, '../dist/index.html'));
}
```

### 2. 子应用如何调用基座能力？

```typescript
// packages/investment/src/InvestmentApp.tsx
import { useKernel } from '@host/kernel/useKernel';
import { Button } from '@image-studio/components/ui/button';

export const InvestmentDashboard = () => {
  const kernel = useKernel();
  
  const handleNotify = () => {
    // 调用 Host 标准化能力
    kernel.os.notify('数据已更新');
  };

  return (
    <Card title="今日新闻">
      <Button onClick={handleNotify}>刷新</Button>
      {/* ... */}
    </Card>
  );
};
```

### 3. 子应用如何暴露入口？

当前子应用以入口组件 + manifest 的方式接入（不强制子应用内部路由）。

```typescript
// packages/investment/src/index.ts
export { InvestmentApp } from './InvestmentApp';
export { investmentManifest } from './manifest';
```

---

## 6. 拓展性分析

1.  **添加 UI 组件**: 只需在共享 UI 层添加一次，所有子应用即可复用。
2.  **添加新应用**:
  *   在 `src/apps/` 下新建子目录。
  *   提供 `manifest.ts` + `index.ts`。
  *   Host 会通过 `import.meta.glob` 自动发现并注册。
3.  **权限控制**: 基座可以在加载子应用前检查 `manifest.ts` 中的权限声明，决定是否注入敏感 API (如文件读写)。
4.  **热插拔 (高级)**: 未来可以通过从远程服务器下载 `JS Bundle` 的方式，实现不更新主程序即可安装新应用（类似 VS Code 插件机制）。

---

## 7. 子包独立开发约定

每个子包都支持独立启动开发：

*   `npm run dev:host` → 基座模式（手动访问 `/host.html`）
*   `npm run dev:image-studio` → ImageStudio 子包单独开发（手动访问 `/image-studio.html`）
*   `npm run dev:investment` → Investment 子包单独开发（手动访问 `/investment.html`）

同时支持 workspace 级“真正子包”启动（从子包 package 触发）：

*   `npm run dev:host:pkg`（等价 `npm run dev -w @ai-image/host`）
*   `npm run dev:image-studio:pkg`（等价 `npm run dev -w @ai-image/image-studio`）
*   `npm run dev:investment:pkg`（等价 `npm run dev -w @ai-image/investment`）
*   `npm run dev:packages`（并行启动全部子包开发环境）

默认端口约定：

*   Host: `5173`
*   ImageStudio: `5174`
*   Investment: `5175`

若端口被占用会自动顺延，不阻塞单独启动。

基座验证流程（开发环境）：

1. 执行 `npm run electron:dev`，进入 Host 入口页（`/host.html`）。
2. 入口页默认直接渲染当前激活的子应用。
3. 点击“新窗口打开”按钮，Host 通过 Electron IPC 在新窗口加载子应用入口（如 `/packages/image-studio/index.html`、`/packages/investment/index.html`）。

统一约束：

*   子包 UI 必须来自 `@ui/*`（`packages/ui/src`）。
*   子包能力调用通过 `KernelProvider + useKernel()`，避免直接耦合主进程实现。

这个架构既保持了 Monorepo 的开发便利性（代码共享、类型提示），又实现了运行时的逻辑解耦。子应用开发者只需关注业务，无需关心窗口、系统交互等底层细节。

---

## 8. 本地优先 + 后端可迁移数据架构（推荐落地）

目标：**当前数据先存本地，处理流程按未来前后端方案执行，后续可无损迁移到服务器**。

### 8.1 设计原则

1. **单一领域模型**：前端本地存储结构与后端数据库结构对齐（字段名、主键、时间字段、状态字段一致）。
2. **统一 API 契约**：前端调用统一 Repository 接口，当前走 LocalAdapter，后续切 RemoteAdapter。
3. **事件可追溯**：所有关键写操作生成 `event_id` 与 `updated_at`，为后续增量同步和冲突处理做准备。
4. **可迁移主键**：业务主键使用全局唯一 ID（UUID/ULID），避免服务器迁移时重排 ID。
5. **版本化 Schema**：本地库和服务端库都维护 `schema_version`，迁移按版本脚本执行。

### 8.2 存储分层（当前阶段）

*   **Local DB（IndexedDB）**：主业务数据（新闻、主题聚类、影响评估、自选规则、预警事件）。
*   **localStorage**：仅保存轻量配置（当前市场、UI 偏好、最近过滤条件），不存大对象。
*   **Encryption（可选）**：敏感字段（密钥、凭证）继续使用现有 Web Crypto AES-GCM 策略。

建议本地表（逻辑实体）与后端表保持同名或可直接映射：

*   `news_item`
*   `topic_cluster`
*   `impact_assessment`
*   `watch_rule`
*   `alert_event`
*   `sync_outbox`（本地新增：待同步写操作队列）

### 8.3 前后端统一处理链路

无论本地还是服务端，都走同一业务流水线：

1. 采集/导入原始新闻
2. 标准化（source、published_at、symbols、keywords）
3. 去重与聚类（topic）
4. 影响评估（rule-based + LLM 可选增强）
5. 规则匹配并生成预警事件
6. 返回统一 DTO 给前端展示

即：**先统一“处理协议”，再决定“数据落在哪”**。

### 8.4 代码层抽象（迁移关键）

在 investment 子应用中保持以下接口层：

*   `InvestmentRepository`（领域读写接口）
*   `LocalInvestmentRepository`（IndexedDB 实现，当前默认）
*   `RemoteInvestmentRepository`（HTTP API 实现，后续启用）
*   `HybridRepository`（读本地 + 写双通道灰度期可选）

通过环境开关切换：

*   `storageMode=local`：纯本地
*   `storageMode=hybrid`：本地 + 服务端双写（迁移期）
*   `storageMode=remote`：纯服务端

### 8.5 数据迁移方案（本地 -> 服务器）

分三步进行，避免一次性切换风险：

1. **导出阶段**
  *   本地按实体导出 JSON/NDJSON（带 `schema_version` 与 `exported_at`）。
  *   附加完整性信息（记录数、hash、来源设备 ID）。

2. **导入阶段**
  *   后端提供批量导入 API（幂等，支持重复提交）。
  *   以 `id` + `updated_at` 作为 upsert 判定。
  *   冲突策略：`server_wins` 或 `latest_updated_at_wins`（建议默认后者）。

3. **切换阶段**
  *   开启 `hybrid` 双写运行 1~2 周观察。
  *   校验本地与服务端计数、抽样内容一致。
  *   冻结本地写入，切 `remote`，保留本地只读回滚窗口。

### 8.6 必备迁移字段（现在就要加）

每条业务记录建议具备：

*   `id`（全局唯一）
*   `created_at`
*   `updated_at`
*   `deleted_at`（软删除，可空）
*   `version`（可选，乐观锁）
*   `source`（数据来源）
*   `sync_status`（`pending` | `synced` | `failed`）

这些字段现在本地就按后端标准维护，后续迁移成本最低。

### 8.7 前后端并行开发边界

*   前端先完成：页面 + Repository 接口 + LocalAdapter + Mock API 契约联调。
*   后端并行完成：PostgreSQL 建表 + OpenAPI + 导入任务 + 同步状态回写。
*   联调只看契约，不看实现来源（本地或远端）。

### 8.8 验收标准

1. 本地模式与远端模式返回同结构数据。
2. 导出后可在服务端完整导入且无重复脏写。
3. 双写期间失败可重放（基于 `sync_outbox`）。
4. 切换到 remote 后，前端页面无感知改动。

---

该方案可以保证：**你现在继续本地开发不会浪费，后续接入服务器时是“切换实现”，不是“推翻重写”。**
