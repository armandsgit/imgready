'use client';

import { Download, Sparkles, Trash2 } from 'lucide-react';

interface BatchControlsProps {
  completedCount: number;
  totalCount: number;
  failedCount: number;
  processingCount: number;
  progressPercent: number;
  onDownloadAll: () => void;
  onClear: () => void;
  disabled?: boolean;
  className?: string;
}

export default function BatchControls({
  completedCount,
  totalCount,
  failedCount,
  processingCount,
  progressPercent,
  onDownloadAll,
  onClear,
  disabled = false,
  className = '',
}: BatchControlsProps) {
  const pendingCount = Math.max(totalCount - completedCount - failedCount, 0);
  const progressLabel = totalCount === 0 ? 'Upload images to begin' : 'Preparing your listing images';
  const allReady = totalCount > 0 && completedCount === totalCount;
  const downloadDisabled = disabled || completedCount === 0;
  const statsLabel = `${completedCount} done • ${processingCount} processing • ${pendingCount} queued`;

  return (
    <div className={`panel sticky top-24 z-20 rounded-[28px] p-6 md:p-6.5 transition-all duration-300 ease-out hover:border-[color:var(--border-strong)] hover:shadow-[0_16px_34px_rgba(0,0,0,0.18)] ${className}`}>
      <div className="flex h-full flex-col gap-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-primary)]">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--accent-primary)]" />
              Batch
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[color:var(--text-primary)]">{progressLabel}</p>
              <p className="max-w-[42ch] text-sm leading-6 text-[color:var(--text-secondary)]">Track processing and download all finished images in one place.</p>
              <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Ready for Amazon, eBay, Shopify, WooCommerce</p>
              {allReady && <p className="text-sm font-medium text-[color:var(--status-success-text)]">All images ready ✅</p>}
            </div>
            <div className="text-[15px] text-[color:var(--text-secondary)]">
              {statsLabel}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 xl:max-w-[330px] xl:justify-end">
            <button
              type="button"
              onClick={onDownloadAll}
              disabled={downloadDisabled}
              title={downloadDisabled ? 'No images ready yet' : `Download all ZIP (${completedCount})`}
              className="theme-accent-button inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition-all duration-200 ease-out hover:shadow-[0_12px_26px_rgba(124,58,237,0.22)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Download all ZIP ({completedCount})
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled || totalCount === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] transition-all duration-200 ease-out hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] hover:shadow-[0_10px_22px_rgba(0,0,0,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Clear images
            </button>
          </div>
        </div>

        <div className="mt-1.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="theme-accent-fill progress-bar h-full rounded-full shadow-[0_0_18px_rgba(168,85,247,0.2)] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
