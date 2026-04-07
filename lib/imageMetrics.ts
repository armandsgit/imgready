import type { ImageTask } from '@/types';

export function formatBytes(bytes: number | null | undefined): string | null {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes <= 0) {
    return null;
  }

  if (bytes < 1000) {
    return `${bytes} B`;
  }

  if (bytes < 1000 * 1000) {
    const kilobytes = bytes / 1000;
    return `${kilobytes >= 100 ? kilobytes.toFixed(0) : kilobytes.toFixed(1)} KB`;
  }

  const megabytes = bytes / (1000 * 1000);
  return `${megabytes.toFixed(2)} MB`;
}

export function getReductionPercent(originalBytes: number | null | undefined, processedBytes: number | null | undefined): number | null {
  if (
    typeof originalBytes !== 'number' ||
    typeof processedBytes !== 'number' ||
    originalBytes <= 0 ||
    processedBytes <= 0
  ) {
    return null;
  }

  return Math.round((1 - processedBytes / originalBytes) * 100);
}

export function getSavedBytes(originalBytes: number | null | undefined, processedBytes: number | null | undefined): number | null {
  if (
    typeof originalBytes !== 'number' ||
    typeof processedBytes !== 'number' ||
    originalBytes <= 0 ||
    processedBytes <= 0 ||
    processedBytes >= originalBytes
  ) {
    return null;
  }

  return originalBytes - processedBytes;
}

export function getSpeedImprovementCategory(reductionPercent: number | null | undefined): string | null {
  if (typeof reductionPercent !== 'number') {
    return null;
  }

  if (reductionPercent < 20) {
    return 'Minimal impact';
  }
  if (reductionPercent < 50) {
    return 'Moderate improvement';
  }
  if (reductionPercent < 80) {
    return 'Significant improvement';
  }

  return 'Major speed boost';
}

export function getEstimatedFasterPercent(reductionPercent: number | null | undefined): number | null {
  if (typeof reductionPercent !== 'number') {
    return null;
  }

  return Math.max(5, Math.round(reductionPercent * 0.35));
}

export function getSizeToneClass(reductionPercent: number | null | undefined): string {
  return typeof reductionPercent === 'number' && reductionPercent > 50
    ? 'text-[color:var(--status-success-text)]'
    : 'text-[color:var(--text-secondary)]';
}

export function getItemMetrics(item: Pick<ImageTask, 'originalFileSize' | 'optimizedFileSize'>) {
  const originalLabel = formatBytes(item.originalFileSize);
  const comparisonSize = item.optimizedFileSize ?? null;
  const processedLabel = formatBytes(comparisonSize);
  const reductionPercent = getReductionPercent(item.originalFileSize, comparisonSize);
  const savedLabel = formatBytes(getSavedBytes(item.originalFileSize, comparisonSize));
  const speedCategory = getSpeedImprovementCategory(reductionPercent);
  const fasterPercent = getEstimatedFasterPercent(reductionPercent);

  return {
    originalLabel,
    processedLabel,
    reductionPercent,
    savedLabel,
    speedCategory,
    fasterPercent,
  };
}
