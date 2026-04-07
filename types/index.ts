export type UploadState = 'idle' | 'uploading' | 'processing' | 'result' | 'error';
export type MaskCleanupMode = 'standard' | 'aggressive' | 'product' | 'hollow-object';
export type RemoveBgModel = 'isnet' | 'birefnet';
export type ProcessingQuality = 'standard' | 'hd' | 'original';
export type DownloadFormat = 'webp' | 'png' | 'avif';
export type CompressionPreset = 'high' | 'standard' | 'compressed';
export type ExportBackground = 'transparent' | 'white';
export type ProcessingMode = 'remove-background' | 'optimize-only';
export type OptimizeFitMode = 'contain' | 'cover';

export interface RemoveBgResponse {
  image: string;
  mimeType: string;
}

export type ImageTaskStatus = 'uploading' | 'processing' | 'refining' | 'done' | 'error';

export interface ImageTask {
  id: string;
  sourceKey: string;
  fileName: string;
  originalImage: string;
  originalFileSize?: number | null;
  resultImage: string | null;
  displayImage?: string | null;
  processedFileSize?: number | null;
  status: ImageTaskStatus;
  error: string | null;
  selectedQuality?: ProcessingQuality | null;
  processedBy?: RemoveBgModel | null;
  processedQuality?: ProcessingQuality | null;
  exportSize?: string | null;
  downloadFormat?: DownloadFormat | null;
  downloadQualityPreset?: CompressionPreset | null;
  downloadBackground?: ExportBackground | null;
  optimizedFileSize?: number | null;
  optimizedMimeType?: string | null;
  processingMode?: ProcessingMode | null;
  optimizeFitMode?: OptimizeFitMode | null;
}
