---
applyTo: "src/state/**/*.ts,src/types/**/*.ts"
---

# State & Type Definitions / 状态与类型定义

## State Management / 状态管理

### Zustand Store / Zustand Store

The app uses a **single Zustand store** in `src/state/useAppStore.ts`. All global state lives here.

应用使用 **单一 Zustand store**（位于 `src/state/useAppStore.ts`）。所有全局状态都在这里。

Structure:
```typescript
// src/state/useAppStore.ts
import { create } from 'zustand';

interface AppState {
  // Current task
  currentTask: Task | null;
  setCurrentTask: (task: Task) => void;
  
  // Global settings
  globalProviderSettings: ProviderSettings;
  setProviderSettings: (settings: ProviderSettings) => void;
  
  // UI state
  isLoading: boolean;
  error: string | null;
}

export const useAppStore = create<AppState>((set) => ({
  currentTask: null,
  setCurrentTask: (task) => set({ currentTask: task }),
  
  globalProviderSettings: {},
  setProviderSettings: (settings) => set({ globalProviderSettings: settings }),
  
  isLoading: false,
  error: null,
}));
```

### Usage Rules / 使用规则

1. **Never read localStorage directly in components**; always use the store
2. **Load settings from Settings modal** and sync to store
3. **Use selectors** to avoid unnecessary re-renders:

```typescript
// ✅ Good: selective re-render
const isLoading = useAppStore((state) => state.isLoading);

// ❌ Bad: subscribes to entire store
const store = useAppStore();
```

4. **Application-level settings** should be fetched with fallback:

```typescript
// Always use selector + fallback pattern
const settings = 
  useAppStore((state) => state.globalProviderSettings) 
  ?? getDefaultProviderSettings();

// Pass settings to components, don't access store directly
<ChildComponent settings={settings} isReady={!!settings} />
```

5. **Keep derived state computed** in components, not in store:

```typescript
// Store: simple values only
taskCount: 10,

// Component: compute derived values
const displayCount = useAppStore((s) => s.taskCount);
const hasItems = displayCount > 0;
```

### Theme Store / 主题 Store

There's a separate `useThemeStore` for dark/light mode:

```typescript
import { useThemeStore } from '@/state/useThemeStore';

const isDark = useThemeStore((state) => state.isDark);
const toggleTheme = useThemeStore((state) => state.toggleTheme);
```

## Type Definitions / 类型定义

### File Organization / 文件组织

All types live in `src/types/` with **PascalCase filenames**:
- `src/types/evaluation.ts` - Evaluation, EvaluationResult
- `src/types/agent.ts` - Agent, PersonaType
- `src/types/storage.ts` - Task, ChatMessage
- `src/types/common.ts` - UI state, Provider types

### Type Naming Convention / 类型命名约定

- **Interfaces** for object shapes: `interface Task { ... }`
- **Types** for unions, aliases: `type Provider = 'openai' | 'gemini' | 'claude'`
- **Suffix "Type"** only if ambiguous with runtime value: `type ProviderType = ...`

### Common Types / 常见类型

```typescript
// src/types/evaluation.ts
export interface EvaluationResult {
  scores: {
    composition: number;
    lighting: number;
    color: number;
    subject: number;
  };
  reasoning: {
    composition: string;
    lighting: string;
    color: string;
    subject: string;
  };
  overallScore: number;
  recommendations: string[];
}

// src/types/storage.ts
export interface Task {
  id: string;
  parentTaskId?: string; // reference to previous task
  uploadedImage: Blob;
  originalFile: {
    name: string;
    size: number;
    mimeType: string;
  };
  exif: ExifData;
  recognizedStyles: StyleTag[];
  selectedAgent: Agent;
  evaluationResult: EvaluationResult;
  chatMessages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

### Strict Typing Rules / 严格类型规则

Never use `any`:
```typescript
// ❌ Bad
function process(data: any) { ... }

// ✅ Good
function process(data: unknown) {
  if (typeof data === 'string') { ... }
}

// ✅ Or define proper type
interface InputData {
  name: string;
  value: number;
}
function process(data: InputData) { ... }
```

### Optional vs Required / 可选 vs 必需

Use `?` for optional fields sparingly:

```typescript
// ✅ Good: clear required/optional
interface Task {
  id: string;                    // Required
  description: string;          // Required
  parentTaskId?: string;         // Optional (previous task reference)
  notes?: string;                // Optional
}

// Handle undefined properly
const parent = task.parentTaskId ? db.getTask(task.parentTaskId) : null;
```

### Union Types / 联合类型

Use unions for state machines:

```typescript
type TaskStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

interface TaskState {
  status: TaskStatus;
  progress?: number;        // Only when 'uploading' or 'processing'
  error?: string;           // Only when 'error'
}

// Use type guards when accessing optional fields
if (state.status === 'error' && state.error) {
  console.log(state.error);
}
```

### Generic Types / 泛型类型

When defining reusable types:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
}
```

## Import/Export / 导入导出

Keep types separated from implementation:

```typescript
// types/evaluation.ts
export interface EvaluationResult { ... }

// modules/evaluation/validator.ts
import type { EvaluationResult } from '@/types/evaluation';

export function validate(data: unknown): EvaluationResult { ... }

// components/ResultPanel.tsx
import type { EvaluationResult } from '@/types/evaluation'; 
import { useAppStore } from '@/state/useAppStore';

export function ResultPanel() {
  const result = useAppStore((s) => s.evaluationResult);
  // ...
}
```

---

**Remember**: Types are your documentation. Keep them clear, explicit, and close to where they're used.

**记住**：类型是你的文档。保持清晰、明确，并接近使用位置。
