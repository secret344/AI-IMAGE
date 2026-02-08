---
applyTo: "src/modules/**/*.ts,src/modules/**/*.tsx"
---

# Business Logic Modules / 业务逻辑模块

All files in `src/modules/` contain reusable business logic, utilities, and API integrations. These should be **framework-agnostic** where possible.

`src/modules/` 中的所有文件包含可重用的业务逻辑、工具和 API 集成。这些应尽可能**与框架无关**。

## File Naming / 文件命名

Use **camelCase** for module files:
- ✅ `processImage.ts`, `callProvider.ts`, `validateJSON.ts`
- ❌ `ProcessImage.ts`, `call-provider.ts`

## Code Organization / 代码组织

### Imports Order / 导入顺序

```typescript
// 1. Standard library
import { promises as fs } from 'fs';

// 2. Third-party packages
import axios from 'axios';

// 3. Project modules (absolute imports)
import { useAppStore } from '@/state/useAppStore';
import { validateResponse } from '@/modules/validation/validator';

// 4. Types
import type { EvaluationResult } from '@/types/evaluation';
```

### Error Handling / 错误处理

Always use try-catch for async operations. Never silently fail.

始终对异步操作使用 try-catch。绝不静默失败。

**Error Classification Pattern**:

```typescript
// src/modules/storage/chatAnalytics.ts
type ErrorCategory = 'timeout' | 'network' | 'canceled' | 'unknown';

export function recordChatFailure(category: ErrorCategory, message: string): void {
  // Analytics or logging
  console.error(`Chat failure [${category}]:`, message);
}

// src/modules/ai/client.ts
export async function callAiProvider(request: AIRequest): Promise<AIResponse> {
  try {
    const response = await fetch(...);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    // Classify error for analytics
    let category: ErrorCategory = 'unknown';
    const message = String(error).toLowerCase();
    
    if (message.includes('timeout')) {
      category = 'timeout';
    } else if (message.includes('network') || message.includes('fetch')) {
      category = 'network';
    } else if (message.includes('abort')) {
      category = 'canceled';
    }
    
    throw error; // Re-throw; component will classify & log
  }
}
```

✅ Return strong types to enable analytics tracking  
✅ Support both EN & ZH error messages in classification  
✅ Use `as const` for literal category types  
✅ Components call `recordChatFailure()` with classified type

### Type Safety / 类型安全

- Always define return types explicitly
- Use const assertions for literal values
- Validate external data before using

```typescript
// ✅ Good: explicit types, validation
export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size > 50 * 1024 * 1024) {
    throw new Error('Image exceeds 50MB limit');
  }
  // ...
  return { /* ProcessedImage */ };
}
```

## Module Categories / 模块分类

### 1. `src/modules/ai/` - AI Provider Integration

Handles calls to OpenAI, Gemini, Claude. Always:
- Validate API keys are encrypted
- Pass `messages` array for multi-turn conversations
- Validate JSON responses before returning
- Implement timeout handling

Example:
```typescript
// src/modules/ai/client.ts
export async function callOpenAI(request: OpenAIRequest): Promise<EvaluationResult> {
  const apiKey = decrypt(getEncryptedKey('openai'));
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      messages: request.messages,
      // ...
    }),
  });
  
  const data = await response.json();
  return validateAndParseJSON(data);
}
```

### 2. `src/modules/storage/` - IndexedDB & localStorage

Handles all persistent storage. Rules:
- IndexedDB for images, chat history (last 10)
- localStorage for encrypted API keys, UI settings
- Always use Dexie.js wrapper in `db.ts`
- Implement proper error handling for quota

Example:
```typescript
// src/modules/storage/history.ts
export async function saveTask(task: Task): Promise<void> {
  try {
    return await db.tasks.add(task);
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      // Handle quota exceeded
    }
    throw error;
  }
}
```

### 3. `src/modules/upload/` - Image Processing

Canvas compression, EXIF extraction. Always:
- Limit canvas to 4096px max edge
- JPEG quality 0.85
- Remove GPS from EXIF (privacy)
- Return dimensions and file size

### 4. `src/modules/style/` - Style Recognition

Rule-based or ML-based style classification. Must:
- Return top-3 style tags with weights
- Confidence scores 0-100
- Map to one of 5 photographer personas

### 5. `src/modules/export/` - XMP Export

Generate Lightroom-compatible XMP sidecar files. Remember:
- XMP is XML format
- Exposure, Contrast, Highlights, Shadows adjustments
- Valid file structure for Lightroom import

## JSON Validation / JSON 校验

Always validate external JSON responses:

```typescript
import { validateJSONSchema } from '@/modules/validation/validator';

export async function parseAIResponse(response: unknown): Promise<EvaluationResult> {
  const schema = {
    type: 'object',
    properties: {
      scores: { type: 'object' },
      reasoning: { type: 'string' },
    },
    required: ['scores', 'reasoning'],
  };
  
  const validated = await validateJSONSchema(response, schema);
  return validated as EvaluationResult;
}
```

## Testing / 测试

No formal test framework, but verify logic:
- Call functions with edge cases (null, undefined, empty)
- Test error paths
- Console log any assumptions

---

**Important**: Business logic should be **reusable and testable**. Avoid React-specific code; keep modules framework-agnostic.

**重要**：业务逻辑应**可重用且可测试**。避免 React 特定代码；保持模块与框架无关。
