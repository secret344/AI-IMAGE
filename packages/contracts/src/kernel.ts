import type { KernelOS, KernelStorage, KernelTelemetry } from './kernel-types';

export type {
  KernelStorage,
  KernelOS,
  KernelPermission,
  KernelEventMetric,
  KernelTelemetry,
  KernelMarketIndex,
  KernelMarketSnapshot
} from './kernel-types';

/**
 * 统一的通知能力（通用能力）。
 */
export interface KernelNotifyCapability {
  notify: (message: string) => void;
}

/**
 * 子应用最小通用能力集合。
 * 约束层只暴露能力，不暴露业务数据结构。
 */
export interface KernelCapabilities extends KernelNotifyCapability {}

/**
 * 子应用运行时内核上下文。
 */
export interface KernelContextValue {
  storage: KernelStorage;
  os: KernelOS;
  telemetry: KernelTelemetry;
}

/**
 * Host 注入到 window 的运行时桥接对象。
 * i18n: 基座主导语言设置，子应用可读取并同步。
 */
export interface KernelRuntimeBridge {
  appId: string;
  os: Pick<KernelOS, 'notify'>;
  i18n: {
    getLanguage: () => string | null;
    setLanguage: (language: string) => void;
  };
}

/**
 * 将内核 API + 通知能力适配为通用能力接口。
 * @param source 可提供标准化能力与通知能力的内核对象
 * @return 通用能力对象
 */
export function createKernelCapabilities(source: {
  os: Pick<KernelOS, 'notify'>;
}): KernelCapabilities {
  return {
    notify: source.os.notify
  };
}
