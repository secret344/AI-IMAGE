import {
  resolveHostAppManifestsWithDiagnostics,
  type HostAppManifest,
  type HostManifestIssue
} from '@ai-image/contracts';
import { Image as ImageIcon, BriefcaseBusiness } from 'lucide-react';

const HOST_APP_VERSION = '0.1.0';

const manifestCandidates: unknown[] = [
  {
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
  } satisfies HostAppManifest,
  {
    id: 'investment',
    titleKey: 'host.apps.investment.title',
    descriptionKey: 'host.apps.investment.description',
    entryPath: '/packages/investment/index.html',
    enabled: true,
    order: 20,
    minHostVersion: '0.1.0',
    permissions: ['storage', 'network', 'notify'],
    icon: BriefcaseBusiness,
    componentLoader: async () => {
      const module = await import('@investment/index');
      return { default: module.InvestmentApp };
    }
  } satisfies HostAppManifest
];

const manifestResolution = resolveHostAppManifestsWithDiagnostics(
  manifestCandidates,
  HOST_APP_VERSION
);

export const hostAppManifests: HostAppManifest[] = manifestResolution.manifests;

export const hostManifestIssues: HostManifestIssue[] = manifestResolution.issues;
