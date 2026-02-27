import type { KernelCapabilities, KernelRuntimeBridge } from '@ai-image/contracts/kernel';
import { createKernelCapabilities } from '@ai-image/contracts/kernel';
import { useKernel as createStandaloneKernel } from '@investment/host-shims/useKernel';

interface RuntimeKernel {
  os: {
    notify: (message: string) => void;
  };
}

export function getHostKernelRuntime(): KernelRuntimeBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.hostKernelRuntime ?? null;
}

function getStandaloneFallback(): RuntimeKernel {
  return createStandaloneKernel();
}

export function useKernel(): RuntimeKernel {
  const fallbackKernel = getStandaloneFallback();
  const bridge = getHostKernelRuntime();

  if (bridge) {
    return {
      os: {
        notify: bridge.os.notify
      }
    };
  }

  return fallbackKernel;
}

export function useKernelCapabilities(): KernelCapabilities {
  const runtimeKernel = useKernel();
  return createKernelCapabilities(runtimeKernel);
}
