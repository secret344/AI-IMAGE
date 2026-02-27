import type { ComponentType } from 'react';
import type { KernelPermission } from './kernel';

/**
 * Host 子应用清单定义。
 */
export interface HostAppManifest {
  id: string;
  titleKey: string;
  descriptionKey: string;
  entryPath: string;
  enabled?: boolean;
  order?: number;
  minHostVersion?: string;
  permissions: KernelPermission[];
  icon: ComponentType<{ className?: string }>;
  componentLoader: () => Promise<{ default: ComponentType }>;
}
