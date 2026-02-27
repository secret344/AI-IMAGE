import type { KernelCapabilities, KernelRuntimeBridge } from '@ai-image/contracts/kernel';
import { createKernelCapabilities } from '@ai-image/contracts/kernel';

/**
 * Image Studio 运行时内核对象。
 * 职责：暴露标准化的 api 与 os 能力供上层复用。
 */
interface RuntimeKernel {
  os: {
    notify: (message: string) => void;
  };
}

/**
 * 读取 Host 注入的 runtime bridge。
 * @return {KernelRuntimeBridge | null} Host bridge；独立模式下返回 null
 */
export function getHostKernelRuntime(): KernelRuntimeBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return (window as Window & { hostKernelRuntime?: KernelRuntimeBridge }).hostKernelRuntime ?? null;
}

/**
 * 独立模式下的最小降级内核。
 * 不提供跨应用能力桥接，仅保留 notify 的本地输出能力。
 * @return {RuntimeKernel} 降级内核实现
 */
function createStandaloneKernel(): RuntimeKernel {
  return {
    os: {
      notify: (message: string) => {
        if (typeof window !== 'undefined') {
          window.console.info('[image-studio-standalone]', message);
        }
      }
    }
  };
}

/**
 * 获取当前运行时内核能力。
 * Host 模式优先使用 host bridge，独立模式回退到本地实现。
 * @return {RuntimeKernel} 标准化内核对象
 */
export function useKernel(): RuntimeKernel {
  const hostRuntime = getHostKernelRuntime();

  if (hostRuntime) {
    return {
      os: {
        notify: hostRuntime.os.notify
      }
    };
  }

  return createStandaloneKernel();
}

/**
 * 获取通用能力接口（notify）。
 * 该接口屏蔽业务特定结构，适合作为子应用统一约束层。
 * @return {KernelCapabilities} 通用能力对象
 */
export function useKernelCapabilities(): KernelCapabilities {
  const runtimeKernel = useKernel();
  return createKernelCapabilities(runtimeKernel);
}
