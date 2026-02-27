import { Image as ImageIcon } from 'lucide-react';
import type { HostAppManifest } from '@ai-image/contracts/manifest';

export const imageStudioManifest: HostAppManifest = {
  id: 'image-studio',
  titleKey: 'host.apps.imageStudio.title',
  descriptionKey: 'host.apps.imageStudio.description',
  entryPath: '/packages/image-studio/index.html',
  enabled: true,
  order: 10,
  minHostVersion: '0.1.0',
  permissions: ['storage', 'notify'],
  icon: ImageIcon,
  componentLoader: async () => {
    const module = await import('@image-studio/index');
    return { default: module.ImageStudioApp };
  }
};
