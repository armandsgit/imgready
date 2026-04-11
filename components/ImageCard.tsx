'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import DownloadButton from './DownloadButton';
import BeforeAfterSlider from './BeforeAfterSlider';
import { exportFormatLabel } from '@/lib/exportImage';
import { formatBytes, getItemMetrics, getSavedBytes, getSizeToneClass } from '@/lib/imageMetrics';
import type { ImageTask } from '@/types';

const METRIC_ANIMATION_DURATION_MS = 850;
const animatedMetricIds = new Set<string>();

interface ImageCardProps {
  item: ImageTask;
  onRetry?: (item: ImageTask) => void;
  onRefine?: (item: ImageTask) => void;
}

function statusClasses(status: ImageTask['status']) {
  switch (status) {
    case 'done':
      return 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]';
    case 'error':
      return 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error-text)]';
    default:
      return 'border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]';
  }
}

function statusLabel(status: ImageTask['status']) {
  switch (status) {
    case 'uploading':
      return 'Uploading';
    case 'processing':
      return 'Processing';
    case 'refining':
      return 'Refining';
    case 'done':
      return 'Done';
    case 'error':
      return 'Error';
  }
}

function outputFileName(fileName: string) {
  return fileName;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function formatMetricBytes(bytes: number | null) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes <= 0) {
    return '0 KB';
  }

  return formatBytes(bytes) ?? '0 KB';
}

function listingIndicators(isOptimizeOnly: boolean) {
  return isOptimizeOnly
    ? ['Centered product', 'Auto-scaled for consistent size', 'Optimized for web']
    : ['White background', 'Centered product', 'Auto-scaled for consistent size', 'Optimized size'];
}

export default function ImageCard({ item, onRetry, onRefine }: ImageCardProps) {
  const isWorking = item.status === 'uploading' || item.status === 'processing' || item.status === 'refining';
  const finalProcessedImage = item.displayImage ?? item.resultImage;
  const isOptimizeOnly = item.processingMode === 'optimize-only';
  const exportFormat = exportFormatLabel(item.downloadFormat ?? 'webp');
  const exportLabel =
    item.processedQuality === 'hd'
      ? '1600×1600'
      : item.processedQuality === 'original'
        ? 'Original size'
        : '1000×1000';
  const { reductionPercent, savedLabel, processedLabel, fasterPercent } = getItemMetrics(item);
  const savedBytes = getSavedBytes(item.originalFileSize, item.optimizedFileSize);
  const sizeToneClass = getSizeToneClass(reductionPercent);
  const shouldAnimateMetrics =
    item.status === 'done' &&
    typeof reductionPercent === 'number' &&
    typeof savedBytes === 'number' &&
    typeof fasterPercent === 'number';
  const hasAnimatedMetrics = animatedMetricIds.has(item.id);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [animatedReductionPercent, setAnimatedReductionPercent] = useState(
    shouldAnimateMetrics && !hasAnimatedMetrics ? 0 : reductionPercent ?? 0,
  );
  const [animatedSavedBytes, setAnimatedSavedBytes] = useState(
    shouldAnimateMetrics && !hasAnimatedMetrics ? 0 : savedBytes ?? 0,
  );
  const [animatedFasterPercent, setAnimatedFasterPercent] = useState(
    shouldAnimateMetrics && !hasAnimatedMetrics ? 0 : fasterPercent ?? 0,
  );
  const [showMetricGlow, setShowMetricGlow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!shouldAnimateMetrics) {
      setAnimatedReductionPercent(reductionPercent ?? 0);
      setAnimatedSavedBytes(savedBytes ?? 0);
      setAnimatedFasterPercent(fasterPercent ?? 0);
      setShowMetricGlow(false);
      return;
    }

    if (prefersReducedMotion || hasAnimatedMetrics) {
      setAnimatedReductionPercent(reductionPercent);
      setAnimatedSavedBytes(savedBytes);
      setAnimatedFasterPercent(fasterPercent);
      setShowMetricGlow(false);
      return;
    }

    let animationFrame = 0;
    let glowTimeout: ReturnType<typeof setTimeout> | null = null;
    const startedAt = performance.now();

    setAnimatedReductionPercent(0);
    setAnimatedSavedBytes(0);
    setAnimatedFasterPercent(0);
    setShowMetricGlow(false);

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / METRIC_ANIMATION_DURATION_MS, 1);
      const eased = easeOutCubic(progress);

      setAnimatedReductionPercent(Math.round(reductionPercent * eased));
      setAnimatedSavedBytes(Math.round(savedBytes * eased));
      setAnimatedFasterPercent(Math.round(fasterPercent * eased));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
        return;
      }

      animatedMetricIds.add(item.id);
      setAnimatedReductionPercent(reductionPercent);
      setAnimatedSavedBytes(savedBytes);
      setAnimatedFasterPercent(fasterPercent);
      setShowMetricGlow(true);
      glowTimeout = setTimeout(() => setShowMetricGlow(false), 700);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (glowTimeout) {
        clearTimeout(glowTimeout);
      }
    };
  }, [fasterPercent, hasAnimatedMetrics, item.id, prefersReducedMotion, reductionPercent, savedBytes, shouldAnimateMetrics]);

  const metricsSavedText =
    typeof reductionPercent === 'number' && typeof savedBytes === 'number'
      ? `-${animatedReductionPercent}% • ${formatMetricBytes(animatedSavedBytes)} saved`
      : savedLabel ?? processedLabel ?? '';
  const metricsSpeedText = typeof fasterPercent === 'number' ? `⚡ ~${animatedFasterPercent}% faster` : '';

  return (
    <article className="group panel flex h-full flex-col justify-between overflow-hidden rounded-[28px] p-3.5 transition-all duration-300 ease-out hover:border-[color:var(--border-strong)]">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{item.fileName}</p>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">
              {item.status === 'done'
                ? isOptimizeOnly
                  ? 'Optimized for product listings'
                  : item.processedBy === 'birefnet'
                    ? 'Listing-ready image • Edges improved'
                    : 'Listing-ready image'
                : item.status === 'error'
                  ? 'Processing failed'
                  : item.status === 'refining'
                    ? 'Refining result'
                    : isOptimizeOnly
                      ? 'Optimizing image'
                      : 'In queue'}
            </p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${statusClasses(item.status)}`}>
            {isWorking && <Loader2 className="h-3 w-3 animate-spin" />}
            {statusLabel(item.status)}
          </span>
        </div>

        <div className="relative">
          {isOptimizeOnly ? (
            <div className="overflow-hidden rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)]">
              <div className="flex items-center justify-between border-b border-[color:var(--border-color)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                <span>Optimized preview</span>
                <span>{isWorking ? 'Processing' : 'Ready'}</span>
              </div>
              <div className="aspect-square bg-white">
                <img
                  src={finalProcessedImage ?? item.originalImage}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          ) : (
            <BeforeAfterSlider beforeSrc={item.originalImage} afterSrc={finalProcessedImage} processing={isWorking} />
          )}
        </div>

        {item.status === 'done' && (
          <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Automatically processed</p>
            {!isOptimizeOnly && (
              <div className="mt-2 flex min-w-0 items-center gap-2">
                {item.processedBy !== 'birefnet' ? (
                  <button
                    type="button"
                    onClick={() => onRefine?.(item)}
                    title="Better for boxes, packaging, and hard edges"
                    className="inline-flex items-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-elevated)]"
                  >
                    Fix edges
                  </button>
                ) : (
                  <span className="inline-flex items-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)]">
                    Edges improved
                  </span>
                )}
              </div>
            )}
            <div className={`${isOptimizeOnly ? 'mt-2' : 'mt-2'} flex flex-wrap gap-x-3 gap-y-1.5 pl-0.5 text-[11px] text-[color:var(--text-secondary)]`}>
              {listingIndicators(isOptimizeOnly).map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-[color:var(--status-success-text)]" />
                  {label}
                </span>
              ))}
            </div>
            {(reductionPercent !== null || fasterPercent !== null) && (
              <div
                className={`mt-2.5 space-y-0.5 pl-0.5 text-xs leading-tight transition-[filter,opacity] duration-500 ${
                  showMetricGlow ? 'drop-shadow-[0_0_12px_rgba(236,72,153,0.16)]' : ''
                }`}
              >
                <span className={`block ${sizeToneClass}`}>
                  {metricsSavedText}
                </span>
                <span className="block text-[color:var(--text-secondary)] opacity-70">
                  {metricsSpeedText}
                </span>
              </div>
            )}
          </div>
        )}

        {item.error && (
          <div className="rounded-xl border px-3 py-3 text-xs theme-danger-text" style={{ borderColor: 'var(--danger-soft-border)', background: 'var(--danger-soft-bg)' }}>
            <p className="font-medium">Failed to process image</p>
            <p className="mt-1 opacity-90">{item.error}</p>
            <button
              type="button"
              onClick={() => onRetry?.(item)}
              className="mt-3 inline-flex items-center rounded-lg border border-[color:var(--danger-soft-border)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--surface-strong)]"
            >
              Retry
            </button>
          </div>
        )}

      </div>

      <div className="mt-4 space-y-2">
        {finalProcessedImage ? (
          <>
            <DownloadButton
              image={finalProcessedImage}
              fileName={outputFileName(item.fileName)}
              quality={item.processedQuality}
              exportSize={item.exportSize}
              compact
              hideMeta
              downloadFormat={item.downloadFormat}
              compressionPreset={item.downloadQualityPreset}
              exportBackground={isOptimizeOnly && item.downloadFormat === 'png' ? 'transparent' : item.downloadBackground}
              outputSuffix={isOptimizeOnly ? 'optimized' : 'background-removed'}
              squareCanvas={isOptimizeOnly}
              fitMode={isOptimizeOnly ? item.optimizeFitMode ?? 'cover' : 'contain'}
            />
            <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-[color:var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5 text-[color:var(--status-success-text)]">
                <Check className="h-3.5 w-3.5" />
                {isOptimizeOnly
                  ? `${exportFormat} listing image ready`
                  : item.processedBy === 'birefnet'
                    ? 'Listing-ready image with improved edges'
                    : 'Listing-ready image'}
              </span>
              <span>{exportLabel}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-secondary)]">
              <Loader2 className={`h-3.5 w-3.5 ${isWorking ? 'animate-spin' : ''}`} />
              {item.status === 'error' ? 'Unavailable' : isWorking ? 'Processing image' : 'Waiting in queue'}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
