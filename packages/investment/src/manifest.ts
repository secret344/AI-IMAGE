import { BriefcaseBusiness } from 'lucide-react';
import type { HostAppManifest } from '@ai-image/contracts/manifest';

export const investmentManifest: HostAppManifest = {
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
};
