/**
 * AI 内存优化和泄漏检测模块
 *
 * 目的：
 * 1. 识别 AI 调用过程中容易导致内存泄漏的模式
 * 2. 提供最佳实践和清理方法
 * 3. 监控大对象的生命周期
 * 4. 优雅地释放资源
 */

/**
 * AI 调用中的主要内存泄漏风险点
 * @enum {string}
 */
/* eslint-disable no-unused-vars */
export enum MemoryLeakRisk {
  /** Event listeners not removed after operation completes */
  UNCLEARED_EVENT_LISTENERS = 'uncleared_event_listeners',
  /** Stream reader not properly closed/cancelled */
  UNCLOSED_STREAM_READER = 'unclosed_stream_reader',
  /** Large string buffer accumulation without cleanup */
  LARGE_STRING_BUFFER = 'large_string_buffer',
  /** Circular references between objects preventing GC */
  OBJECT_REFERENCE_CYCLE = 'object_reference_cycle',
  /** Pending async tasks not awaited or cancelled */
  PENDING_ASYNC_TASKS = 'pending_async_tasks',
  /** SetInterval/setTimeout not cleared */
  UNCLEARED_TIMERS = 'uncleared_timers',
  /** DOM nodes references preventing garbage collection */
  DETACHED_DOM_NODES = 'detached_dom_nodes'
}
/* eslint-enable no-unused-vars */

/**
 * 内存优化建议
 */
export interface MemoryOptimizationTip {
  risk: MemoryLeakRisk;
  description: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

type MemorySafeStreamReader = {
  reader: ReadableStreamDefaultReader<Uint8Array>;
  cleanup: () => void;
};

/**
 * 当前 AI 调用中检测到的内存问题
 */
export interface MemoryIssueReport {
  issues: MemoryOptimizationTip[];
  totalMemoryUsage?: number;
  timestamp: number;
}

/**
 * client.ts 中的已知内存泄漏风险分析
 */
export const KNOWN_AI_MEMORY_RISKS: MemoryOptimizationTip[] = [
  {
    risk: MemoryLeakRisk.UNCLOSED_STREAM_READER,
    description: 'readSseStream() 中的 getReader() 可能在异常情况下未正确关闭，导致流资源泄漏',
    recommendation: '在 try-finally 中确保调用 reader.cancel()，即使发生错误也能正确清理流',
    severity: 'high'
  },
  {
    risk: MemoryLeakRisk.LARGE_STRING_BUFFER,
    description:
      'readSseStream() 中的字符串拼接（buffer += ...）在大型响应时会产生多个中间字符串副本',
    recommendation:
      '使用数组收集字符串片段后用 join() 拼接，或使用 OptimizedStringBuffer。最后明确释放 buffer 变量',
    severity: 'high'
  },
  {
    risk: MemoryLeakRisk.UNCLEARED_TIMERS,
    description: 'fetchWithTimeout() 中的 setTimeout 即使在异常情况下也需正确清理',
    recommendation:
      '当前代码已使用 finally 块清理，但建议检查 AbortController 是否被妥善释放（通常自动处理）',
    severity: 'medium'
  },
  {
    risk: MemoryLeakRisk.OBJECT_REFERENCE_CYCLE,
    description: 'AiError 和其他错误对象可能持有大型上下文对象的引用，导致垃圾回收延迟',
    recommendation:
      '避免在错误对象中存储完整的 request 或 response 对象，仅保存必要的错误信息（如错误消息、状态码）',
    severity: 'medium'
  },
  {
    risk: MemoryLeakRisk.PENDING_ASYNC_TASKS,
    description:
      '若 callAiProvider 被中途取消或超时，内部的异步操作（如正在进行的 fetch）可能继续占用内存',
    recommendation:
      '在 AbortController 被触发时，确保所有待处理的 I/O 操作被正确中止。使用 signal.addEventListener("abort", handler) 来监听取消事件',
    severity: 'medium'
  }
];

/**
 * 获取内存优化建议
 * @return {MemoryOptimizationTip[]} 所有已知的内存泄漏风险和建议
 */
export function getMemoryOptimizationTips(): MemoryOptimizationTip[] {
  return KNOWN_AI_MEMORY_RISKS;
}

/**
 * 内存友好的响应处理装饰器
 * 用于包装 AI 调用，确保大对象被及时释放
 * @param {Function} fn 异步函数
 * @return {Promise} Promise 结果，若出错会清理大型引用
 */
export function wrapMemorySafeAiCall<T>(fn: () => Promise<T>): Promise<T> {
  return fn()
    .catch((error) => {
      // 确保错误对象不会长期持有大对象引用
      if (error && typeof error === 'object') {
        // 清理可能的大型引用
        delete (error as Record<string, unknown>).request;
        delete (error as Record<string, unknown>).response;
        delete (error as Record<string, unknown>).responseBody;
      }
      throw error;
    })
    .finally(() => {
      // 允许垃圾回收器收集临时对象
      if (
        typeof global !== 'undefined' &&
        typeof (global as Record<string, unknown>).gc === 'function'
      ) {
        try {
          ((global as Record<string, unknown>).gc as () => void)();
        } catch {
          // gc 可能不可用或被禁用
        }
      }
    });
}

/**
 * 获取流读取器的内存安全包装
 * 确保在任何情况下都会关闭流
 * @param {Response} response HTTP 响应对象
 * @return {MemorySafeStreamReader} 流读取器和清理函数对象
 */
export function getMemorySafeStreamReader(response: Response): MemorySafeStreamReader {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  return {
    reader,
    cleanup: () => {
      reader.cancel().catch(() => {
        // 忽略 cancel 错误（可能已关闭）
      });
    }
  };
}

/**
 * 创建内存优化的字符串缓冲区
 * 避免频繁的字符串拼接，改用数组收集
 */
export class OptimizedStringBuffer {
  private chunks: string[] = [];

  /**
   * 添加字符串片段
   * @param {string} chunk 字符串片段
   */
  append(chunk: string): void {
    if (chunk && chunk.length > 0) {
      this.chunks.push(chunk);
    }
  }

  /**
   * 获取完整字符串
   * @return {string} 拼接后的完整字符串
   */
  toString(): string {
    return this.chunks.join('');
  }

  /**
   * 获取总长度（无需拼接）
   * @return {number} 总字符数
   */
  getLength(): number {
    return this.chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  }

  /**
   * 明确清理缓冲区
   */
  clear(): void {
    this.chunks = [];
  }

  /**
   * 重置缓冲区（用于批处理场景）
   */
  reset(): void {
    this.chunks.length = 0;
  }
}

/**
 * 监控并报告潜在的内存问题
 * 用于开发和调试阶段
 */
export class MemoryMonitor {
  private initialMemory?: number;
  private taskStartTime?: number;

  /**
   * 开始监控
   */
  start(): void {
    this.taskStartTime = performance.now();
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memoryData = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      this.initialMemory = memoryData?.usedJSHeapSize;
    }
  }

  /**
   * 结束监控并获取报告
   * @return {MemoryIssueReport} 内存问题报告对象
   */
  end(): MemoryIssueReport {
    const duration = this.taskStartTime ? performance.now() - this.taskStartTime : 0;
    let memoryDelta = 0;

    if (typeof performance !== 'undefined' && 'memory' in performance && this.initialMemory) {
      const memoryData = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      const currentMemory = memoryData?.usedJSHeapSize || 0;
      memoryDelta = currentMemory - this.initialMemory;
    }

    const issues: MemoryOptimizationTip[] = [];

    if (memoryDelta > 10 * 1024 * 1024) {
      issues.push({
        risk: MemoryLeakRisk.LARGE_STRING_BUFFER,
        description: `Task 耗时 ${duration.toFixed(0)}ms，内存增长 ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
        recommendation: '检查是否产生了大量临时对象或字符串副本',
        severity: 'high'
      });
    }

    return {
      issues,
      totalMemoryUsage: memoryDelta,
      timestamp: Date.now()
    };
  }
}

/**
 * 检查环境是否启用了内存监控（开发模式）
 * @return {boolean} 是否支持内存监控
 */
export function isMemoryMonitoringEnabled(): boolean {
  return typeof performance !== 'undefined' && 'memory' in performance;
}
