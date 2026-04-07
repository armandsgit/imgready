import type { CompressionPreset, DownloadFormat, ExportBackground, OptimizeFitMode, ProcessingQuality } from '@/types';

const COVER_CROP_FALLBACK_THRESHOLD = 0.35;
const SUBJECT_ANALYSIS_MAX_SIDE = 512;
const SUBJECT_DIFF_THRESHOLD = 26;
const GLOBAL_EXPORT_CORRECTION_FILTER = 'brightness(104.5%) contrast(105%) saturate(102.5%)';

export function exportFormatLabel(format: DownloadFormat) {
  switch (format) {
    case 'avif':
      return 'AVIF';
    case 'png':
      return 'PNG';
    case 'webp':
    default:
      return 'WebP';
  }
}

export function exportBackgroundLabel(background: ExportBackground) {
  return background === 'white' ? 'White background' : 'Transparent';
}

export function getMimeType(format: DownloadFormat) {
  switch (format) {
    case 'avif':
      return 'image/avif';
    case 'png':
      return 'image/png';
    case 'webp':
    default:
      return 'image/webp';
  }
}

export function getFileExtension(format: DownloadFormat) {
  switch (format) {
    case 'avif':
      return 'avif';
    case 'png':
      return 'png';
    case 'webp':
    default:
      return 'webp';
  }
}

export function getQualityValue(format: DownloadFormat, _preset?: CompressionPreset) {
  switch (format) {
    case 'png':
      return undefined;
    case 'avif':
      return 0.8;
    case 'webp':
    default:
      return 0.8;
  }
}

export function getTargetMaxSide(quality: ProcessingQuality | null | undefined) {
  switch (quality) {
    case 'hd':
      return 1600;
    case 'original':
      return null;
    case 'standard':
    default:
      return 1000;
  }
}

export function getResizedDimensions(width: number, height: number, maxSide: number | null) {
  if (!maxSide || Math.max(width, height) <= maxSide) {
    return { width, height };
  }

  const scale = maxSide / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load processed image for export.'));
    image.src = src;
  });
}

function getAlphaBounds(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < 10) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    centerX: (minX + maxX + 1) / 2,
    centerY: (minY + maxY + 1) / 2,
  };
}

export async function alignTransparentImageToReference(imageUrl: string, referenceUrl: string) {
  const [image, reference] = await Promise.all([loadImage(imageUrl), loadImage(referenceUrl)]);
  const imageBounds = getAlphaBounds(image);
  const referenceBounds = getAlphaBounds(reference);

  if (!imageBounds || !referenceBounds) {
    const response = await fetch(imageUrl);
    return await response.blob();
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    const response = await fetch(imageUrl);
    return await response.blob();
  }

  const offsetX = Math.round(referenceBounds.centerX - imageBounds.centerX);
  const offsetY = Math.round(referenceBounds.centerY - imageBounds.centerY);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, offsetX, offsetY);

  const blob = await canvasToBlob(canvas, 'image/png');
  if (!blob) {
    throw new Error('Could not align refined image.');
  }

  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function estimateBackgroundColor(data: Uint8ClampedArray, width: number, height: number) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  const samplePixel = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    count += 1;
  };

  for (let x = 0; x < width; x += 1) {
    samplePixel(x, 0);
    if (height > 1) {
      samplePixel(x, height - 1);
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    samplePixel(0, y);
    if (width > 1) {
      samplePixel(width - 1, y);
    }
  }

  if (count === 0) {
    return { red: 255, green: 255, blue: 255 };
  }

  return {
    red: red / count,
    green: green / count,
    blue: blue / count,
  };
}

function detectSubjectRegion(image: HTMLImageElement) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const scale = Math.min(1, SUBJECT_ANALYSIS_MAX_SIDE / Math.max(width, height));
  const analysisWidth = Math.max(1, Math.round(width * scale));
  const analysisHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(image, 0, 0, analysisWidth, analysisHeight);
  const imageData = context.getImageData(0, 0, analysisWidth, analysisHeight);
  const data = imageData.data;
  const background = estimateBackgroundColor(data, analysisWidth, analysisHeight);

  let minX = analysisWidth;
  let minY = analysisHeight;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let pixelCount = 0;

  for (let y = 0; y < analysisHeight; y += 1) {
    for (let x = 0; x < analysisWidth; x += 1) {
      const index = (y * analysisWidth + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 10) {
        continue;
      }

      const redDiff = data[index] - background.red;
      const greenDiff = data[index + 1] - background.green;
      const blueDiff = data[index + 2] - background.blue;
      const distance = Math.sqrt(redDiff * redDiff + greenDiff * greenDiff + blueDiff * blueDiff);

      if (distance < SUBJECT_DIFF_THRESHOLD) {
        continue;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
      pixelCount += 1;
    }
  }

  if (maxX < minX || maxY < minY || pixelCount === 0) {
    return null;
  }

  return {
    left: minX / scale,
    top: minY / scale,
    right: (maxX + 1) / scale,
    bottom: (maxY + 1) / scale,
    centerX: (sumX / pixelCount) / scale,
    centerY: (sumY / pixelCount) / scale,
  };
}

export async function createOptimizedExport(params: {
  imageUrl: string;
  fileName: string;
  format: DownloadFormat;
  preset: CompressionPreset;
  background: ExportBackground;
  processingQuality: ProcessingQuality | null | undefined;
  outputSuffix?: 'background-removed' | 'optimized';
  squareCanvas?: boolean;
  fitMode?: OptimizeFitMode;
}) {
  const image = await loadImage(params.imageUrl);
  const maxSide = getTargetMaxSide(params.processingQuality);
  const { width, height } = getResizedDimensions(image.naturalWidth, image.naturalHeight, maxSide);
  const shouldUseSquareCanvas = Boolean(params.squareCanvas && maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = shouldUseSquareCanvas && maxSide ? maxSide : width;
  canvas.height = shouldUseSquareCanvas && maxSide ? maxSide : height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not initialize export canvas.');
  }
  if (params.background === 'white' || params.format !== 'png') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }
  context.filter = GLOBAL_EXPORT_CORRECTION_FILTER;

  if (shouldUseSquareCanvas && maxSide && params.fitMode === 'cover') {
    const cropSide = Math.min(image.naturalWidth, image.naturalHeight);
    const cropArea = cropSide * cropSide;
    const originalArea = image.naturalWidth * image.naturalHeight;
    const cropLoss = originalArea > 0 ? 1 - cropArea / originalArea : 0;

    if (cropLoss <= COVER_CROP_FALLBACK_THRESHOLD) {
      const subjectRegion = detectSubjectRegion(image);
      const subjectCenterX =
        subjectRegion?.centerX ??
        (subjectRegion ? (subjectRegion.left + subjectRegion.right) / 2 : image.naturalWidth / 2);
      const subjectCenterY =
        subjectRegion?.centerY ??
        (subjectRegion ? (subjectRegion.top + subjectRegion.bottom) / 2 : image.naturalHeight / 2);
      const cropX = clamp(Math.round(subjectCenterX - cropSide / 2), 0, image.naturalWidth - cropSide);
      const cropY = clamp(Math.round(subjectCenterY - cropSide / 2), 0, image.naturalHeight - cropSide);
      context.drawImage(image, cropX, cropY, cropSide, cropSide, 0, 0, canvas.width, canvas.height);
    } else {
      const offsetX = Math.round((canvas.width - width) / 2);
      const offsetY = Math.round((canvas.height - height) / 2);
      context.drawImage(image, offsetX, offsetY, width, height);
    }
  } else {
    const offsetX = shouldUseSquareCanvas ? Math.round((canvas.width - width) / 2) : 0;
    const offsetY = shouldUseSquareCanvas ? Math.round((canvas.height - height) / 2) : 0;
    context.drawImage(image, offsetX, offsetY, width, height);
  }

  context.filter = 'none';

  const requestedMimeType = getMimeType(params.format);
  const quality = getQualityValue(params.format, params.preset);
  let blob = await canvasToBlob(canvas, requestedMimeType, quality);
  let resolvedFormat = params.format;

  if ((!blob || blob.size === 0) && params.format === 'avif') {
    blob = await canvasToBlob(canvas, getMimeType('webp'), getQualityValue('webp', params.preset));
    resolvedFormat = 'webp';
  }

  if (!blob) {
    throw new Error('Could not prepare optimized download.');
  }

  const baseName = params.fileName.replace(/\.[^.]+$/, '') || 'image';
  const extension = getFileExtension(resolvedFormat);
  const outputSuffix = params.outputSuffix ?? 'background-removed';

  return {
    blob,
    fileName: `${baseName}-${outputSuffix}.${extension}`,
    format: resolvedFormat,
    mimeType: blob.type || getMimeType(resolvedFormat),
    width: canvas.width,
    height: canvas.height,
  };
}
