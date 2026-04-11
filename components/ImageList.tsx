'use client';

import { Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import BeforeAfterSlider from './BeforeAfterSlider';
import DownloadButton from './DownloadButton';
import { exportFormatLabel } from '@/lib/exportImage';
import { formatBytes, getItemMetrics, getSavedBytes, getSizeToneClass } from '@/lib/imageMetrics';
import type { ImageTask } from '@/types';

const METRIC_ANIMATION_DURATION_MS = 850;
const animatedListMetricIds = new Set<string>();

interface ImageListProps {
  items: ImageTask[];
  onRetry?: (item: ImageTask) => void;
  onRefine?: (item: ImageTask) => void;
}

function statusLabel(status: ImageTask['status']) {
  switch (status) {
    case 'uploading':
      return 'Queued';
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

function statusClasses(status: ImageTask['status']) {
  switch (status) {
    case 'processing':
    case 'refining':
      return 'border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)] shadow-[0_0_18px_rgba(124,58,237,0.14)]';
    case 'uploading':
      return 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)]';
    case 'done':
      return 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)] shadow-[0_0_18px_rgba(34,197,94,0.12)]';
    case 'error':
      return 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error-text)]';
    default:
      return 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)]';
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

function useAnimatedItemMetrics(item: ImageTask) {
  const { originalLabel, processedLabel, reductionPercent, speedCategory, fasterPercent } = getItemMetrics(item);
  const savedBytes = getSavedBytes(item.originalFileSize, item.optimizedFileSize);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const hasAnimatedMetrics = animatedListMetricIds.has(item.id);
  const shouldAnimate =
    item.status === 'done' &&
    typeof reductionPercent === 'number' &&
    typeof savedBytes === 'number' &&
    typeof fasterPercent === 'number';
  const [animatedReductionPercent, setAnimatedReductionPercent] = useState(
    shouldAnimate && !hasAnimatedMetrics ? 0 : reductionPercent ?? 0,
  );
  const [animatedSavedBytes, setAnimatedSavedBytes] = useState(
    shouldAnimate && !hasAnimatedMetrics ? 0 : savedBytes ?? 0,
  );
  const [animatedFasterPercent, setAnimatedFasterPercent] = useState(
    shouldAnimate && !hasAnimatedMetrics ? 0 : fasterPercent ?? 0,
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
    if (!shouldAnimate) {
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

      animatedListMetricIds.add(item.id);
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
  }, [fasterPercent, hasAnimatedMetrics, item.id, prefersReducedMotion, reductionPercent, savedBytes, shouldAnimate]);

  return {
    originalLabel,
    processedLabel,
    reductionPercent,
    speedCategory,
    fasterPercent,
    animatedReductionPercent,
    animatedSavedBytes,
    animatedFasterPercent,
    showMetricGlow,
  };
}

function ListItemRow({
  item,
  onRetry,
  onRefine,
  onOpenPreview,
}: {
  item: ImageTask;
  onRetry?: (item: ImageTask) => void;
  onRefine?: (item: ImageTask) => void;
  onOpenPreview: (itemId: string) => void;
}) {
  const isProcessing = item.status === 'uploading' || item.status === 'processing' || item.status === 'refining';
  const isQueued = item.status === 'uploading';
  const isOptimizeOnly = item.processingMode === 'optimize-only';
  const {
    originalLabel,
    processedLabel,
    reductionPercent,
    fasterPercent,
    animatedReductionPercent,
    animatedSavedBytes,
    animatedFasterPercent,
    showMetricGlow,
  } = useAnimatedItemMetrics(item);
  const sizeToneClass = getSizeToneClass(reductionPercent);
  const exportFormat = exportFormatLabel(item.downloadFormat ?? 'webp');

  return (
    <div
      className="grid gap-3 px-4 py-3 transition-all duration-300 ease-out hover:bg-white/[0.03] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] lg:grid-cols-[64px_minmax(0,1fr)_auto] lg:items-center"
    >
      <div className="flex items-center lg:justify-center">
        <button
          type="button"
          title="Click to preview"
          onClick={() => onOpenPreview(item.id)}
          className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] transition-all duration-200 ease-out hover:border-[color:var(--border-strong)] hover:shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
        >
          <img src={item.displayImage ?? item.resultImage ?? item.originalImage} alt="" className="h-full w-full object-cover" />
        </button>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <p className="truncate text-[15px] font-medium text-[color:var(--text-primary)]">{item.fileName}</p>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${statusClasses(item.status)}`}>
              {statusLabel(item.status)}
            </span>
            {item.status === 'done' && (
              <span className="text-xs text-[color:var(--status-success-text)]/95">
                {isOptimizeOnly ? 'Optimized' : item.processedBy === 'birefnet' ? 'Edges improved' : 'Ready'}
              </span>
            )}
          </div>

          {isProcessing ? (
            <div className="space-y-2">
              <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10">
                <div className="theme-accent-fill progress-bar h-full w-2/3 rounded-full shadow-[0_0_16px_rgba(168,85,247,0.18)]" />
              </div>
              <p className="text-xs text-[color:var(--text-secondary)]">
                {item.status === 'refining'
                  ? 'Improving edges'
                  : isQueued
                    ? 'Queued for processing'
                    : isOptimizeOnly
                      ? 'Optimizing image'
                      : 'Removing background'}
              </p>
            </div>
          ) : item.status === 'error' ? (
            <p className="text-xs text-[color:var(--status-error-text)]">{item.error ?? 'Processing failed'}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[color:var(--text-secondary)]">
              <span>
                {isOptimizeOnly
                  ? `${exportFormat} listing image ready`
                  : item.processedBy === 'birefnet'
                    ? 'Listing-ready image with improved edges'
                    : 'Listing-ready image'}
              </span>
              <span className="text-[color:var(--text-muted)]">•</span>
              <span className="text-[color:var(--text-muted)]">{exportSizeLabel(item)}</span>
              {originalLabel && processedLabel && reductionPercent !== null && (
                <>
                  <span className="text-[color:var(--text-muted)]">•</span>
                  <span className={showMetricGlow ? 'transition-[filter] duration-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.14)]' : ''}>
                    {originalLabel} → {processedLabel}
                  </span>
                  <span className={`${sizeToneClass} ${showMetricGlow ? 'transition-[filter] duration-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.12)]' : ''}`}>
                    ({animatedReductionPercent > 0 ? `-${animatedReductionPercent}%` : `${animatedReductionPercent}%`})
                  </span>
                  {fasterPercent !== null && (
                    <>
                      <span className="text-[color:var(--text-muted)]">•</span>
                      <span className={`text-[color:var(--text-secondary)] ${showMetricGlow ? 'transition-[filter] duration-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.12)]' : ''}`}>
                        ⚡ {animatedFasterPercent}% faster
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lg:justify-self-end">
        {item.resultImage ? (
          <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
            {item.status === 'done' && item.processedBy !== 'birefnet' && !isOptimizeOnly ? (
              <button
                type="button"
                onClick={() => onRefine?.(item)}
                title="Better for boxes, packaging, and hard edges"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition-all duration-200 ease-out hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] hover:shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
              >
                Fix edges
              </button>
            ) : null}
            <div className="shrink-0">
              <DownloadButton
                image={item.resultImage}
                fileName={outputFileName(item.fileName)}
                quality={item.processedQuality}
                exportSize={item.exportSize}
                compact
                hideMeta
                widthMode="auto"
                downloadFormat={item.downloadFormat}
                compressionPreset={item.downloadQualityPreset}
                exportBackground={isOptimizeOnly && item.downloadFormat === 'png' ? 'transparent' : item.downloadBackground}
                outputSuffix={isOptimizeOnly ? 'optimized' : 'background-removed'}
                squareCanvas={isOptimizeOnly}
                fitMode={isOptimizeOnly ? item.optimizeFitMode ?? 'cover' : 'contain'}
              />
            </div>
          </div>
        ) : item.status === 'error' ? (
          <button
            type="button"
            onClick={() => onRetry?.(item)}
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--danger-soft-border)] bg-[color:var(--danger-soft-bg)] px-4 py-2.5 text-sm font-medium text-[color:var(--danger-text)] transition hover:opacity-90"
          >
            Retry
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenPreview(item.id)}
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewModalContent({
  item,
  onClose,
  onRefine,
}: {
  item: ImageTask;
  onClose: () => void;
  onRefine?: (item: ImageTask) => void;
}) {
  const isWorking = item.status === 'uploading' || item.status === 'processing' || item.status === 'refining';
  const isOptimizeOnly = item.processingMode === 'optimize-only';
  const canRefine = item.status === 'done' && item.processedBy !== 'birefnet' && !isOptimizeOnly;
  const exportFormat = exportFormatLabel(item.downloadFormat ?? 'webp');
  const {
    originalLabel,
    processedLabel,
    reductionPercent,
    speedCategory,
    animatedReductionPercent,
    animatedSavedBytes,
    animatedFasterPercent,
    showMetricGlow,
  } = useAnimatedItemMetrics(item);
  const sizeToneClass = getSizeToneClass(reductionPercent);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-[color:var(--text-primary)]">{item.fileName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2.5 text-sm text-[color:var(--text-secondary)]">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${statusClasses(item.status)}`}>
              {(item.status === 'uploading' || item.status === 'processing' || item.status === 'refining') && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              {statusLabel(item.status)}
            </span>
            <span>{exportSizeLabel(item)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isOptimizeOnly ? (
        <div className="overflow-hidden rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)]">
          <div className="flex items-center justify-between border-b border-[color:var(--border-color)] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            <span>Optimized preview</span>
            <span>{isWorking ? 'Processing' : 'Ready'}</span>
          </div>
          <div className="bg-white">
            <img
              src={item.displayImage ?? item.resultImage ?? item.originalImage}
              alt=""
              className="mx-auto max-h-[68vh] w-full object-contain"
            />
          </div>
        </div>
      ) : (
        <BeforeAfterSlider beforeSrc={item.originalImage} afterSrc={item.displayImage ?? item.resultImage} processing={isWorking} />
      )}

      <div className="flex flex-col gap-3 border-t border-[color:var(--border-color)] pt-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2 text-sm text-[color:var(--text-secondary)]">
          <p>
            {item.status === 'refining'
              ? 'Refining this image. The preview will update here automatically.'
              : isOptimizeOnly
                ? 'Optimizing image only for product listings.'
              : item.status === 'processing' || item.status === 'uploading'
                ? 'Removing background. Live progress is shown in this preview.'
                : item.resultImage
                  ? item.processedBy === 'birefnet'
                    ? 'Previewing the refined, listing-ready result with improved edges.'
                    : `Previewing the listing-ready ${exportFormat} image.`
                  : item.status === 'error'
                    ? 'Preview unavailable until processing succeeds.'
                    : 'Previewing the current processing state.'}
          </p>
          {item.status === 'done' ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[color:var(--text-secondary)]">
              {listingIndicators(isOptimizeOnly).map((label) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span className="text-[color:var(--status-success-text)]">✓</span>
                  {label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-[color:var(--text-muted)]">
                <span>•</span>
                Ready for Amazon, eBay, Shopify, WooCommerce
              </span>
            </div>
          ) : null}
          {originalLabel && processedLabel && reductionPercent !== null && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>Original size: {originalLabel}</span>
              <span>Optimized size: {processedLabel}</span>
              <span className={`${sizeToneClass} ${showMetricGlow ? 'transition-[filter] duration-500 drop-shadow-[0_0_10px_rgba(34,197,94,0.12)]' : ''}`}>
                Saved: {animatedReductionPercent}%
              </span>
              {speedCategory && animatedFasterPercent !== null && (
                <span className={`text-[color:var(--text-secondary)] ${showMetricGlow ? 'transition-[filter] duration-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.12)]' : ''}`}>
                  Estimated page speed improvement: {speedCategory} (~{animatedFasterPercent}% faster image load)
                </span>
              )}
              {typeof animatedSavedBytes === 'number' && animatedSavedBytes > 0 && (
                <span className={showMetricGlow ? 'transition-[filter] duration-500 drop-shadow-[0_0_10px_rgba(236,72,153,0.14)]' : ''}>
                  Saved bytes: {formatMetricBytes(animatedSavedBytes)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canRefine ? (
            <button
              type="button"
              onClick={() => onRefine?.(item)}
              title="Better for boxes, packaging, and hard edges"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition-all duration-200 ease-out hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] hover:shadow-[0_10px_24px_rgba(0,0,0,0.18)]"
            >
              Fix edges
            </button>
          ) : item.status === 'done' && item.processedBy === 'birefnet' && !isOptimizeOnly ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 text-sm font-medium text-[color:var(--status-success-text)]">
              <span className="text-base leading-none">✓</span>
              Edges improved
            </span>
          ) : null}
          {item.resultImage && !isWorking ? (
            <DownloadButton
              image={item.resultImage}
              fileName={outputFileName(item.fileName)}
              quality={item.processedQuality}
              exportSize={item.exportSize}
              compact
              hideMeta
              widthMode="auto"
              downloadFormat={item.downloadFormat}
              compressionPreset={item.downloadQualityPreset}
              exportBackground={isOptimizeOnly && item.downloadFormat === 'png' ? 'transparent' : item.downloadBackground}
              outputSuffix={isOptimizeOnly ? 'optimized' : 'background-removed'}
              squareCanvas={isOptimizeOnly}
              fitMode={isOptimizeOnly ? item.optimizeFitMode ?? 'cover' : 'contain'}
            />
          ) : (
            <button
              type="button"
              disabled
              className="btn btn-primary opacity-60"
            >
              {`Download ${exportFormat}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function exportSizeLabel(item: ImageTask) {
  switch (item.processedQuality) {
    case 'hd':
      return 'Export: 1600×1600';
    case 'original':
      return 'Export: Original size';
    case 'standard':
    default:
      return 'Export: 1000×1000';
  }
}

export default function ImageList({ items, onRetry, onRefine }: ImageListProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const previewItem = selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null;

  useEffect(() => {
    if (!previewItem) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedItemId(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewItem]);

  useEffect(() => {
    if (selectedItemId && !previewItem) {
      setSelectedItemId(null);
    }
  }, [previewItem, selectedItemId]);

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      <div className="panel overflow-hidden rounded-[28px]">
        <div className="divide-y divide-[color:var(--border-color)]">
          {items.map((item) => (
            <ListItemRow
              key={item.id}
              item={item}
              onRetry={onRetry}
              onRefine={onRefine}
              onOpenPreview={setSelectedItemId}
            />
          ))}
        </div>
      </div>
      {previewItem && (
        <div
          className="fixed inset-0 z-[70] bg-[rgba(11,11,13,0.72)] backdrop-blur-[8px]"
          onClick={() => setSelectedItemId(null)}
        >
          <div className="flex min-h-full items-center justify-center p-4 md:p-6">
            <div
              className="panel w-full max-w-4xl rounded-[28px] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:p-5"
              onClick={(event) => event.stopPropagation()}
            >
              <PreviewModalContent
                item={previewItem}
                onClose={() => setSelectedItemId(null)}
                onRefine={onRefine}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
