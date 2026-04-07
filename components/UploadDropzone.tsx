'use client';

import { Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ExportOptionsControls from './ExportOptionsControls';
import type { DownloadFormat, ExportBackground, OptimizeFitMode, ProcessingMode, ProcessingQuality } from '@/types';

interface UploadDropzoneProps {
  onFilesSelect: (files: File[]) => void;
  processingMode: ProcessingMode;
  onProcessingModeChange: (mode: ProcessingMode) => void;
  optimizeFitMode: OptimizeFitMode;
  onOptimizeFitModeChange: (mode: OptimizeFitMode) => void;
  quality: ProcessingQuality;
  onQualityChange: (quality: ProcessingQuality) => void;
  downloadFormat: DownloadFormat;
  onDownloadFormatChange: (format: DownloadFormat) => void;
  exportBackground: ExportBackground;
  onExportBackgroundChange: (background: ExportBackground) => void;
  disabled?: boolean;
  locked?: boolean;
  compact?: boolean;
  resultsCompact?: boolean;
  validationMessage?: string | null;
  limitText?: string;
  creditText?: string;
}

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

export default function UploadDropzone({
  onFilesSelect,
  processingMode,
  onProcessingModeChange,
  optimizeFitMode,
  onOptimizeFitModeChange,
  quality,
  onQualityChange,
  downloadFormat,
  onDownloadFormatChange,
  exportBackground,
  onExportBackgroundChange,
  disabled = false,
  locked = false,
  compact = false,
  resultsCompact = false,
  validationMessage = null,
  limitText = 'Max 3 images per upload',
  creditText = '1 image = 1 credit',
}: UploadDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDropAccepted: (files) => {
      if (files.length > 0) onFilesSelect(files);
    },
    multiple: true,
    disabled,
    maxSize: 10 * 1024 * 1024,
    accept: ACCEPTED_TYPES,
    noClick: true,
  });

  const checkerOpacity = isDragActive ? 0.03 : 0.018;
  const overlayBackground = isDragActive
    ? 'linear-gradient(180deg, rgba(255,255,255,0.022), rgba(255,255,255,0.01) 34%, rgba(0,0,0,0.035))'
    : 'linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0.006) 34%, rgba(0,0,0,0.03))';

  return (
    <div
      {...getRootProps()}
      className={`theme-upload-shell relative overflow-hidden rounded-[28px] border border-dashed border-[color:var(--border-color)] transition-[border-color,box-shadow,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isDragActive
          ? 'border-[color:var(--accent-primary)]/70 bg-[color:var(--accent-soft)] shadow-[0_0_0_1px_rgba(124,58,237,0.08),0_10px_24px_rgba(124,58,237,0.08)]'
          : 'hover:border-[color:var(--accent-primary)]/14 hover:bg-[rgba(124,58,237,0.02)] hover:shadow-[0_0_0_1px_rgba(124,58,237,0.025)]'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          backgroundImage: `
            linear-gradient(45deg, rgba(255,255,255,${checkerOpacity}) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,${checkerOpacity}) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,${checkerOpacity}) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,${checkerOpacity}) 75%)
          `,
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 0 14px, 14px -14px, -14px 0',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: overlayBackground }}
      />
      {isDragActive && <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-[color:var(--accent-primary)]/20" />}
      <input {...getInputProps()} />
      <div
        className={`relative flex flex-col items-center justify-center text-center ${
            resultsCompact
              ? 'min-h-[224px] px-7 py-6 md:min-h-[236px] md:px-8 md:py-6'
              : compact
              ? 'min-h-[240px] px-8 py-10 md:min-h-[248px] md:px-10 md:py-10'
              : 'min-h-[300px] px-8 py-12 md:min-h-[320px] md:px-12 md:py-14'
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <div
            className={`theme-upload-icon flex items-center justify-center rounded-[18px] border ${
              resultsCompact ? 'h-11 w-11' : compact ? 'h-14 w-14' : 'h-16 w-16'
            } ${
              isDragActive ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-soft)]' : ''
          }`}
        >
          <Upload className={resultsCompact ? 'h-5 w-5 opacity-90' : 'h-6 w-6'} />
        </div>
        <div className={`${resultsCompact ? 'mt-3 space-y-2' : compact ? 'mt-5 space-y-3' : 'mt-6 space-y-3.5'}`}>
          {!locked && (
            <div className={resultsCompact ? 'pt-0.5' : compact ? 'pt-0.5' : 'pt-1'}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
                disabled={disabled}
                className={`theme-upload-button inline-flex rounded-xl text-sm font-semibold ${resultsCompact ? 'px-7 py-3.5' : compact ? 'px-6 py-3' : 'px-7 py-3.5'}`}
              >
                {resultsCompact ? 'Upload more images' : 'Upload images'}
              </button>
            </div>
          )}
          {resultsCompact ? (
            <p className="text-sm text-[color:var(--text-secondary)]">
              {isDragActive ? 'Drop images here' : 'Drag files anywhere'}
            </p>
          ) : (
            <>
              <p
                className={`mx-auto max-w-[440px] font-semibold leading-[1.35] text-[color:var(--text-primary)] ${
                  compact ? 'text-[17px] md:text-[18px]' : 'text-[19px] md:text-[20px]'
                }`}
              >
                {locked ? 'You have no credits left' : 'Drop images here'}
              </p>
              <p className={`mx-auto max-w-[400px] text-sm text-[color:var(--text-secondary)] ${compact ? 'leading-6' : 'leading-7'}`}>
                {locked ? 'Upgrade your plan to continue processing images' : 'or click to upload'}
              </p>
              {!locked && (
                <div className={`space-y-1 ${compact ? 'pt-0' : 'pt-0.5'}`}>
                  <p className="text-[13px] font-medium text-[color:var(--text-secondary)]">
                    Removes background, centers product, and optimizes images for fast loading.
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)]">JPG, PNG · up to 10MB</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{limitText} • {creditText}</p>
                </div>
              )}
            </>
          )}
          {!locked && (
            <details
              className={`mx-auto w-full rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] text-left ${compact ? 'max-w-[360px]' : 'max-w-[520px]'}`}
              onClick={(event) => event.stopPropagation()}
            >
              <summary className={`cursor-pointer list-none select-none text-sm font-medium text-[color:var(--text-primary)] ${compact ? 'px-4 py-3' : 'px-5 py-3.5'}`}>
                <span className="flex items-center justify-between gap-3">
                  <span>Advanced settings</span>
                  <span className="text-[11px] text-[color:var(--text-muted)]">Optional</span>
                </span>
              </summary>
              <div className={`${compact ? 'px-4 pb-4 pt-0' : 'px-5 pb-5 pt-0.5'}`}>
                <ExportOptionsControls
                  processingMode={processingMode}
                  onProcessingModeChange={onProcessingModeChange}
                  optimizeFitMode={optimizeFitMode}
                  onOptimizeFitModeChange={onOptimizeFitModeChange}
                  processingQuality={quality}
                  onProcessingQualityChange={onQualityChange}
                  downloadFormat={downloadFormat}
                  onDownloadFormatChange={onDownloadFormatChange}
                  exportBackground={exportBackground}
                  onExportBackgroundChange={onExportBackgroundChange}
                  compact={compact}
                />
              </div>
            </details>
          )}
          {!resultsCompact && !locked && validationMessage && (
            <p className={`text-xs text-[color:var(--status-warning-text)] ${compact ? 'pt-0.5' : 'pt-1'}`}>{validationMessage}</p>
          )}
          {!resultsCompact && !locked && !validationMessage && <p className={`text-xs text-[color:var(--text-muted)] ${compact ? 'pt-0.5' : 'pt-1'}`}>&nbsp;</p>}
          {locked && !resultsCompact && <p className="text-xs text-[color:var(--text-muted)]">Upload disabled</p>}
        </div>
      </div>
    </div>
  );
}
