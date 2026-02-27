/**
 * 内核存储能力契约。
 * 子应用仅通过该接口访问持久化数据，避免直接耦合具体存储实现。
 */
export interface KernelStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * 市场行情快照（单个指数条目）。
 */
export interface KernelMarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt: string;
}

/**
 * 内核市场快照能力结果。
 * source 区分数据来源：tushare / yahoo / local.mock 等。
 */
export interface KernelMarketSnapshot {
  source: string;
  updatedAt: string;
  indices: KernelMarketIndex[];
}

/**
 * 内核操作系统能力契约。
 * 面向子应用暴露受控的系统级能力。
 */
export interface KernelOS {
  notify(message: string): void;
  openAppWindow(entryPath: string): Promise<boolean>;
}

/**
 * 子应用可声明的权限集合。
 */
export type KernelPermission = 'storage' | 'network' | 'notify';

/**
 * 单次内核事件的遥测数据。
 */
export interface KernelEventMetric {
  appId: string;
  eventName: string;
  success: boolean;
  durationMs: number;
  errorMessage?: string;
}

/**
 * 内核遥测接口。
 */
export interface KernelTelemetry {
  recordEvent(metric: KernelEventMetric): void;
  getEvents(): KernelEventMetric[];
  clearEvents(): void;
}
