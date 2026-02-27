import type { ComponentType } from 'react';
import { hostAppManifests } from '@host/manifests';
import type { HostAppManifest, KernelPermission } from '@ai-image/contracts';

export interface HostAppDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  entryPath: string;
  permissions: KernelPermission[];
  icon: ComponentType<{ className?: string }>;
  componentLoader: HostAppManifest['componentLoader'];
}

export const hostAppRegistry: HostAppDefinition[] = [
  ...hostAppManifests.map((manifest) => ({
    id: manifest.id,
    titleKey: manifest.titleKey,
    descriptionKey: manifest.descriptionKey,
    entryPath: manifest.entryPath,
    permissions: manifest.permissions,
    icon: manifest.icon,
    componentLoader: manifest.componentLoader
  }))
];
