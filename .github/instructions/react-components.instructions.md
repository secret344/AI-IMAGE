---
applyTo: "src/components/**/*.tsx"
---

# React Components Guidelines / React 组件指南

## Component Structure / 组件结构

All React components are **functional components** using hooks. Never use class components.

所有React组件都是**函数式组件**，使用hooks。绝不使用类组件。

### Naming Convention / 命名约定

- File names: PascalCase (e.g., `UploadPanel.tsx`, `SettingsModal.tsx`)
- Component names: Match file name
- Props interface: `{ComponentName}Props`
- Example:
  ```typescript
  // File: src/components/upload/UploadPanel.tsx
  interface UploadPanelProps {
    onUpload: (file: File) => void;
    isLoading?: boolean;
  }
  
  export function UploadPanel({ onUpload, isLoading }: UploadPanelProps) {
    // ...
  }
  ```

### UI Components / UI 组件

**CRITICAL**: All UI elements MUST use shadcn/ui components imported from `@/components/ui/`.

**关键**：所有 UI 元素必须使用从 `@/components/ui/` 导入的 shadcn/ui 组件。

Never use:
- Native HTML: `<button>`, `<input>`, `<label>`, `<div className="...">` for layout
- Custom styled components
- Arbitrary Tailwind values

Always use:
- `<Button />`, `<Input />`, `<Label />`, `<Card />`
- Semantic Tailwind tokens: `text-foreground`, `bg-card`, `border-border`
- 8px spacing scale: `gap-2`, `gap-3`, `gap-4`, `p-3`, `p-4`, `p-6`

### Internationalization / 国际化

All user-facing text MUST use i18n. Never hardcode strings in JSX.

所有用户文本必须使用 i18n。绝不在 JSX 中硬编码字符串。

```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('component.title')}</h1>
      <Button>{t('component.confirmButton')}</Button>
    </div>
  );
}
```

Add translations to:
- `src/i18n/en.json` (English)
- `src/i18n/zh.json` (Chinese) - keep parity

### Imports / 导入

Use absolute imports with `@/` prefix:

```typescript
// ✅ Correct
import { useAppStore } from '@/state/useAppStore';
import { Button } from '@/components/ui/button';

// ❌ Avoid
import { useAppStore } from '../../../state/useAppStore';
import Button from '../ui/button.tsx';
```

### State Management / 状态管理

- **Local state**: Use `useState()` for component-specific state
- **Global state**: Use Zustand store (`useAppStore()`) for app-wide state
- **Don't use**: Redux, Context (Zustand is already configured)

Example:
```typescript
import { useAppStore } from '@/state/useAppStore';

export function MyComponent() {
  const [localValue, setLocal] = useState('');
  const globalValue = useAppStore((state) => state.someValue);
  
  return <div>{globalValue}</div>;
}
```

### Effects & Lifecycle / 副作用与生命周期

Use `useEffect` correctly with proper dependency arrays:

```typescript
useEffect(() => {
  const handler = () => console.log('event');
  window.addEventListener('resize', handler);
  
  return () => window.removeEventListener('resize', handler); // Cleanup!
}, []); // Empty array = mount/unmount only
```

### TypeScript / TypeScript

- Always define props interfaces
- Use strict null checks (enabled by default)
- Prefer optional chaining (`?.`) over null checks
- Use type unions for constrained values: `type Status = 'idle' | 'loading' | 'error'`

### Mobile-First Responsive Design / 移动优先响应式

All layouts must be mobile-first:

```typescript
// ✅ Correct: mobile first
className="flex flex-col sm:flex-row gap-2 sm:gap-4"

// ❌ Wrong: desktop first
className="flex flex-row md:flex-col"
```

Responsive breakpoints:
- `sm:` - phone to tablet (~640px)
- `lg:` - tablet to desktop (~1024px)
- `xl:` - large desktop (~1280px)

### Performance / 性能

- Use `React.memo` for components that render with same props frequently
- Use `useCallback` when passing handlers to child components
- Use `useMemo` for expensive computations
- Keep component focused; extract sub-components if logic is complex

---

**Remember**: When in doubt about UI component usage, check `src/components/ui/` directory for available shadcn components.

**记住**：不确定 UI 组件用法时，查看 `src/components/ui/` 目录了解可用的 shadcn 组件。
