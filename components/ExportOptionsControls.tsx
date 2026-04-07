'use client';

import { formatCreditAmount, getProcessingCreditCost } from '@/lib/credits';
import type { DownloadFormat, ExportBackground, OptimizeFitMode, ProcessingMode, ProcessingQuality } from '@/types';

interface ExportOptionsControlsProps {
  processingMode: ProcessingMode;
  onProcessingModeChange: (value: ProcessingMode) => void;
  optimizeFitMode: OptimizeFitMode;
  onOptimizeFitModeChange: (value: OptimizeFitMode) => void;
  processingQuality: ProcessingQuality;
  onProcessingQualityChange: (value: ProcessingQuality) => void;
  downloadFormat: DownloadFormat;
  onDownloadFormatChange: (value: DownloadFormat) => void;
  exportBackground: ExportBackground;
  onExportBackgroundChange: (value: ExportBackground) => void;
  compact?: boolean;
}

const QUALITY_OPTIONS = [
  { value: 'standard' as const, label: 'Standard', meta: '(1000×1000)' },
  { value: 'hd' as const, label: 'HD', meta: '(1600×1600)' },
  { value: 'original' as const, label: 'Original', meta: '' },
];

const FORMAT_OPTIONS = [
  { value: 'webp' as const, label: 'Web optimized' },
  { value: 'png' as const, label: 'PNG' },
];

const BACKGROUND_OPTIONS = [
  { value: 'transparent' as const, label: 'Transparent' },
  { value: 'white' as const, label: 'White' },
];

const PROCESSING_MODE_OPTIONS = [
  { value: 'remove-background' as const, label: 'Remove background · 1 credit' },
  { value: 'optimize-only' as const, label: 'Optimize only · 0.5 credit' },
];

const OPTIMIZE_LAYOUT_OPTIONS = [
  { value: 'cover' as const, label: 'Fill frame (best for e-commerce)', meta: '' },
  { value: 'contain' as const, label: 'Keep full image', meta: '' },
];

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
  disabled = false,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-left">
      <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className={`rounded-xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.03)] text-[color:var(--text-primary)] outline-none transition hover:border-[color:var(--border-strong)] focus:border-[color:var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-70 ${
          compact ? 'h-11 px-3 text-[13px]' : 'h-11 px-3.5 text-sm'
        }`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#1c1c1e] text-[color:var(--text-primary)]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ExportOptionsControls({
  processingMode,
  onProcessingModeChange,
  optimizeFitMode,
  onOptimizeFitModeChange,
  processingQuality,
  onProcessingQualityChange,
  downloadFormat,
  onDownloadFormatChange,
  exportBackground,
  onExportBackgroundChange,
  compact = false,
}: ExportOptionsControlsProps) {
  const optimizeOnlyCost = formatCreditAmount(getProcessingCreditCost('optimize-only'));
  const backgroundOptions =
    processingMode === 'remove-background' && downloadFormat === 'png'
      ? BACKGROUND_OPTIONS
      : ([{ value: 'white' as const, label: 'White' }] as const);

  return (
    <div className={`mx-auto flex w-full flex-col items-center ${compact ? 'gap-3.5' : 'gap-4'}`}>
      <div className={`w-full ${compact ? 'max-w-[360px] space-y-2' : 'max-w-[420px] space-y-2'}`}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Processing mode</p>
        <div className={`grid w-full grid-cols-2 rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.025)] ${compact ? 'gap-1 p-1.5' : 'gap-1.5 p-1.5'}`}>
          {PROCESSING_MODE_OPTIONS.map((option) => {
            const selected = processingMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onProcessingModeChange(option.value);
                }}
                className={`rounded-xl text-left transition ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${
                  selected
                    ? 'border border-[color:var(--accent-primary)] bg-[rgba(124,58,237,0.10)] text-[color:var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]'
                    : 'border border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                <span className={`block font-medium ${compact ? 'text-[11px]' : 'text-xs'}`}>{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[color:var(--text-muted)]">Optimize only uses {optimizeOnlyCost} credit per image.</p>
      </div>

      <div className={`w-full ${compact ? 'max-w-[360px] space-y-2' : 'max-w-[420px] space-y-2'}`}>
        <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Export size</p>
        <div className={`grid w-full grid-cols-3 rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.025)] ${compact ? 'gap-1 p-1.5' : 'gap-1.5 p-1.5'}`}>
          {QUALITY_OPTIONS.map((option) => {
            const selected = processingQuality === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onProcessingQualityChange(option.value);
                }}
                className={`rounded-xl text-left transition ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${
                  selected
                    ? 'border border-[color:var(--accent-primary)] bg-[rgba(124,58,237,0.10)] text-[color:var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]'
                    : 'border border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,255,255,0.03)]'
                }`}
              >
                <span className={`block font-medium ${compact ? 'text-[11px]' : 'text-xs'}`}>{option.label}</span>
                {option.meta ? <span className="mt-0.5 block text-[10px] text-[color:var(--text-muted)]">{option.meta}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {processingMode === 'optimize-only' && (
        <div className={`w-full ${compact ? 'max-w-[360px] space-y-2' : 'max-w-[420px] space-y-2'}`}>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Image layout</p>
          <div className={`grid w-full grid-cols-2 rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.025)] ${compact ? 'gap-1 p-1.5' : 'gap-1.5 p-1.5'}`}>
            {OPTIMIZE_LAYOUT_OPTIONS.map((option) => {
              const selected = optimizeFitMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOptimizeFitModeChange(option.value);
                  }}
                  className={`rounded-xl text-left transition ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${
                    selected
                      ? 'border border-[color:var(--accent-primary)] bg-[rgba(124,58,237,0.10)] text-[color:var(--text-primary)] shadow-[inset_0_0_0_1px_rgba(124,58,237,0.08)]'
                      : 'border border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,255,255,0.03)]'
                  }`}
                >
                  <span className={`block font-medium ${compact ? 'text-[11px]' : 'text-xs'}`}>{option.label}</span>
                  {option.meta ? <span className="mt-0.5 block text-[10px] text-[color:var(--text-muted)]">{option.meta}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`grid w-full gap-3 ${
          processingMode === 'remove-background'
            ? compact
              ? 'max-w-[360px] grid-cols-2'
              : 'max-w-[520px] md:grid-cols-2'
            : compact
              ? 'max-w-[360px] grid-cols-1'
              : 'max-w-[520px] md:grid-cols-1'
        }`}
      >
        <SelectField
          label="Format"
          value={downloadFormat}
          options={FORMAT_OPTIONS}
          onChange={onDownloadFormatChange}
          compact={compact}
        />
        {processingMode === 'remove-background' ? (
          <SelectField
            label="Background"
            value={exportBackground}
            options={backgroundOptions}
            onChange={onExportBackgroundChange}
            compact={compact}
            disabled={backgroundOptions.length === 1}
          />
        ) : null}
      </div>
      {processingMode === 'remove-background' && downloadFormat === 'png' && (
        <p className="text-[11px] text-[color:var(--text-muted)]">PNG supports transparency with larger file sizes.</p>
      )}
    </div>
  );
}
