'use client';

import { useCallback, useState } from 'react';
import { createOptimizedExport, exportFormatLabel } from '@/lib/exportImage';
import type { CompressionPreset, DownloadFormat, ExportBackground, OptimizeFitMode, ProcessingQuality } from '@/types';

interface DownloadButtonProps {
  image: string;
  fileName?: string;
  compact?: boolean;
  quality?: ProcessingQuality | null;
  exportSize?: string | null;
  align?: 'center' | 'left';
  hideMeta?: boolean;
  widthMode?: 'full' | 'auto';
  downloadFormat?: DownloadFormat | null;
  compressionPreset?: CompressionPreset | null;
  exportBackground?: ExportBackground | null;
  outputSuffix?: 'background-removed' | 'optimized';
  squareCanvas?: boolean;
  fitMode?: OptimizeFitMode;
}

function qualityLabel(quality: ProcessingQuality | null | undefined, exportSize?: string | null) {
  if (exportSize) {
    return exportSize === 'original' ? 'Exported at original size' : `Exported at ${exportSize}`;
  }
  switch (quality) {
    case 'hd':
      return 'Exported at 1600×1600';
    case 'original':
      return 'Exported at original size';
    case 'standard':
    default:
      return 'Exported at 1000×1000';
  }
}

export default function DownloadButton({
  image,
  fileName = 'background-removed.png',
  compact = false,
  quality = 'standard',
  exportSize = null,
  align = 'center',
  hideMeta = false,
  widthMode = 'full',
  downloadFormat = 'webp',
  compressionPreset = 'standard',
  exportBackground = 'white',
  outputSuffix = 'background-removed',
  squareCanvas = false,
  fitMode = 'contain',
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const triggerDownload = useCallback((url: string, nextFileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = nextFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const optimized = await createOptimizedExport({
        imageUrl: image,
        fileName,
        format: downloadFormat ?? 'webp',
        preset: compressionPreset ?? 'standard',
        background: downloadFormat === 'png' ? (exportBackground ?? 'white') : 'white',
        processingQuality: quality,
        outputSuffix,
        squareCanvas,
        fitMode,
      });
      const objectUrl = URL.createObjectURL(optimized.blob);
      triggerDownload(objectUrl, optimized.fileName);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } finally {
      setDownloading(false);
    }
  }, [compressionPreset, downloadFormat, exportBackground, fileName, image, quality, triggerDownload]);

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div>
        <button
          type="button"
          onClick={() => {
            void handleDownload();
          }}
          disabled={downloading}
          className={`btn btn-primary transition-all duration-200 ease-out hover:shadow-[0_14px_30px_rgba(124,58,237,0.24)] ${widthMode === 'auto' ? 'w-auto min-w-[240px] px-6' : ''}`}
        >
          {downloading ? 'Preparing...' : 'Download image'}
        </button>
      </div>
      {!hideMeta && (
        <p className={`${align === 'left' ? 'text-left' : 'text-center'} text-[11px] text-[color:var(--text-muted)]`}>
          {qualityLabel(quality, exportSize)}
        </p>
      )}
    </div>
  );
}
