import type { HostAppManifest } from './manifest';

/**
 * Manifest 诊断问题码。
 */
export type HostManifestIssueCode = 'invalid-shape' | 'disabled' | 'version-incompatible';

/**
 * Manifest 诊断项。
 */
export interface HostManifestIssue {
  code: HostManifestIssueCode;
  manifestId?: string;
  minHostVersion?: string;
}

/**
 * Manifest 解析结果。
 */
export interface HostManifestResolution {
  manifests: HostAppManifest[];
  issues: HostManifestIssue[];
}

/**
 * 判断对象是否满足 HostAppManifest 结构。
 */
export function isHostAppManifest(value: unknown): value is HostAppManifest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<HostAppManifest>;
  const isValidIconComponent =
    typeof candidate.icon === 'function' ||
    (typeof candidate.icon === 'object' && candidate.icon !== null);

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.titleKey === 'string' &&
    typeof candidate.descriptionKey === 'string' &&
    typeof candidate.entryPath === 'string' &&
    typeof candidate.componentLoader === 'function' &&
    isValidIconComponent &&
    Array.isArray(candidate.permissions)
  );
}

/**
 * 比较两个语义化版本号。
 */
export function compareSemVer(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number(part) || 0);
  const rightParts = right.split('.').map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) {
      return 1;
    }
    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

/**
 * 判断当前 host 版本是否满足 manifest 最低版本要求。
 */
export function isHostVersionCompatible(
  currentHostVersion: string,
  minHostVersion?: string
): boolean {
  if (!minHostVersion) {
    return true;
  }
  return compareSemVer(currentHostVersion, minHostVersion) >= 0;
}

/**
 * 解析并筛选可用 manifest，同时返回诊断信息。
 */
export function resolveHostAppManifestsWithDiagnostics(
  manifests: unknown[],
  currentHostVersion: string
): HostManifestResolution {
  const issues: HostManifestIssue[] = [];
  const acceptedManifests: HostAppManifest[] = [];

  for (const candidate of manifests) {
    if (!isHostAppManifest(candidate)) {
      issues.push({ code: 'invalid-shape' });
      continue;
    }

    if (candidate.enabled === false) {
      issues.push({ code: 'disabled', manifestId: candidate.id });
      continue;
    }

    if (!isHostVersionCompatible(currentHostVersion, candidate.minHostVersion)) {
      issues.push({
        code: 'version-incompatible',
        manifestId: candidate.id,
        minHostVersion: candidate.minHostVersion
      });
      continue;
    }

    acceptedManifests.push(candidate);
  }

  acceptedManifests.sort((left, right) => {
    const leftOrder = left.order ?? 100;
    const rightOrder = right.order ?? 100;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.id.localeCompare(right.id);
  });

  return {
    manifests: acceptedManifests,
    issues
  };
}
