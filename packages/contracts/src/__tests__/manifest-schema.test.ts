import assert from 'node:assert/strict';
import test from 'node:test';
import type { ComponentType } from 'react';
import { compareSemVer, resolveHostAppManifestsWithDiagnostics } from '../manifest-schema.ts';
import type { HostAppManifest } from '../manifest.ts';

const iconStub: ComponentType<{ className?: string }> = () => null;

function createManifest(overrides: Partial<HostAppManifest>): HostAppManifest {
  return {
    id: 'demo-app',
    titleKey: 'host.apps.demo.title',
    descriptionKey: 'host.apps.demo.description',
    icon: iconStub,
    entryPath: '/apps/demo',
    componentLoader: async () => ({ default: () => null }),
    permissions: [],
    ...overrides
  };
}

test('compareSemVer handles ordering with different segment lengths', () => {
  assert.equal(compareSemVer('1.2.0', '1.1.9'), 1);
  assert.equal(compareSemVer('1.2', '1.2.0'), 0);
  assert.equal(compareSemVer('1.2.1', '1.3.0'), -1);
});

test('resolveHostAppManifestsWithDiagnostics sorts accepted manifests by order and id', () => {
  const manifests = [
    createManifest({ id: 'zeta', order: 20 }),
    createManifest({ id: 'alpha', order: 20 }),
    createManifest({ id: 'beta', order: 10 })
  ];

  const resolved = resolveHostAppManifestsWithDiagnostics(manifests, '1.0.0');

  assert.deepEqual(
    resolved.manifests.map((manifest) => manifest.id),
    ['beta', 'alpha', 'zeta']
  );
  assert.equal(resolved.issues.length, 0);
});

test('resolveHostAppManifestsWithDiagnostics returns diagnostics for invalid, disabled, and incompatible manifests', () => {
  const manifests: unknown[] = [
    { id: 123 },
    createManifest({ id: 'disabled-app', enabled: false }),
    createManifest({ id: 'future-app', minHostVersion: '9.0.0' }),
    createManifest({ id: 'ok-app', minHostVersion: '1.2.0' })
  ];

  const resolved = resolveHostAppManifestsWithDiagnostics(manifests, '1.2.0');

  assert.deepEqual(
    resolved.issues.map((issue) => issue.code),
    ['invalid-shape', 'disabled', 'version-incompatible']
  );
  assert.deepEqual(
    resolved.manifests.map((manifest) => manifest.id),
    ['ok-app']
  );
});

test('resolveHostAppManifestsWithDiagnostics accepts object-style icon components', () => {
  const manifests = [
    createManifest({
      id: 'forward-ref-like-icon',
      icon: { displayName: 'IconLikeObject' } as unknown as ComponentType<{ className?: string }>
    })
  ];

  const resolved = resolveHostAppManifestsWithDiagnostics(manifests, '1.0.0');

  assert.equal(resolved.issues.length, 0);
  assert.deepEqual(
    resolved.manifests.map((manifest) => manifest.id),
    ['forward-ref-like-icon']
  );
});
