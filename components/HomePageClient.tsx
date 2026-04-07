'use client';

import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BatchControls from '@/components/BatchControls';
import ImageGrid from '@/components/ImageGrid';
import ImageList from '@/components/ImageList';
import ProcessingLoader from '@/components/ProcessingLoader';
import UploadDropzone from '@/components/UploadDropzone';
import {
  formatCreditCostLabel,
  formatCreditPerImageText,
  getProcessingCreditCost,
} from '@/lib/credits';
import { alignTransparentImageToReference, createOptimizedExport } from '@/lib/exportImage';
import { formatBytes } from '@/lib/imageMetrics';
import { formatCredits, getPlanUploadLimit, hasUnlimitedCredits } from '@/lib/plans';
import type {
  CompressionPreset,
  DownloadFormat,
  ExportBackground,
  ImageTask,
  MaskCleanupMode,
  OptimizeFitMode,
  ProcessingMode,
  ProcessingQuality,
  RemoveBgModel,
  UploadState,
} from '@/types';

const MAX_CONCURRENT_UPLOADS = 3;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ACCOUNT_REFRESH_EVENT = 'account:refresh';
const WELCOME_TOAST_FLAG = 'showWelcomeToast';
interface MeResponse {
  email: string;
  plan: string;
  credits: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  cancelAtPeriodEnd?: boolean;
  planExpiresAt?: string | null;
  scheduledPlan?: string | null;
  planChangeAt?: string | null;
}

interface HomePageClientProps {
  initialAccount?: MeResponse | null;
}

interface ToastMessage {
  id: string;
  message: string;
}

function createTaskId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`;
}

function createFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function statusOrder(status: ImageTask['status']) {
  switch (status) {
    case 'uploading':
      return 0;
    case 'processing':
      return 1;
    case 'refining':
      return 3;
    case 'done':
      return 3;
    case 'error':
      return 4;
    default:
      return 5;
  }
}

async function processInBatches<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += limit) {
    const batch = items.slice(index, index + limit);
    await Promise.all(batch.map(worker));
  }
}

export default function HomePageClient({ initialAccount = null }: HomePageClientProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [items, setItems] = useState<ImageTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<MeResponse | null>(initialAccount);
  const [accountLoading, setAccountLoading] = useState(!initialAccount);
  const [isPageDragActive, setIsPageDragActive] = useState(false);
  const [maskCleanup] = useState<MaskCleanupMode>('standard');
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove-background');
  const [optimizeFitMode, setOptimizeFitMode] = useState<OptimizeFitMode>('cover');
  const [processingQuality, setProcessingQuality] = useState<ProcessingQuality>('standard');
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('webp');
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>('standard');
  const [exportBackground, setExportBackground] = useState<ExportBackground>('white');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [uploadLimitMessage, setUploadLimitMessage] = useState<string | null>(null);
  const itemsRef = useRef<ImageTask[]>([]);
  const qualityRef = useRef<ProcessingQuality>('standard');
  const processingModeRef = useRef<ProcessingMode>('remove-background');
  const optimizeFitModeRef = useRef<OptimizeFitMode>('cover');
  const downloadFormatRef = useRef<DownloadFormat>('webp');
  const compressionPresetRef = useRef<CompressionPreset>('standard');
  const exportBackgroundRef = useRef<ExportBackground>('white');
  const workspaceRef = useRef<HTMLElement | null>(null);
  const dragDepthRef = useRef(0);
  const previousItemCountRef = useRef(0);
  const previousAutoViewModeRef = useRef<'grid' | 'list'>('grid');
  const hasManualViewSelectionRef = useRef(false);
  const hasResults = items.length > 0;

  const busy = state === 'uploading' || state === 'processing';
  const processingCreditCost = getProcessingCreditCost(processingMode);
  const noCredits =
    typeof account?.credits === 'number' && !hasUnlimitedCredits(account.credits)
      ? account.credits < processingCreditCost
      : false;
  const uploadsDisabled = busy || noCredits || accountLoading || !account;
  const currentPlan = account?.plan ?? 'free';
  const planUploadLimit = getPlanUploadLimit(currentPlan);
  const availableCredits = account?.credits;
  const creditLimitedUploadCount =
    typeof availableCredits === 'number' && !hasUnlimitedCredits(availableCredits)
      ? Math.max(0, Math.min(planUploadLimit, Math.floor(availableCredits / processingCreditCost)))
      : planUploadLimit;
  const creditText = formatCreditPerImageText(processingMode);
  const optimizeOnlyCostLabel = formatCreditCostLabel(getProcessingCreditCost('optimize-only'));

  const chargeProcessingCredit = useCallback(
    async (mode: ProcessingMode) => {
      const response = await fetch('/api/process-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      });

      const payload = (await response.json()) as { credits?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to deduct credits');
      }

      if (typeof payload.credits === 'number') {
        setAccount((current) => {
          if (!current) {
            return current;
          }

          const nextAccount = { ...current, credits: payload.credits! };
          window.dispatchEvent(new CustomEvent<MeResponse>(ACCOUNT_REFRESH_EVENT, { detail: nextAccount }));
          return nextAccount;
        });
      }
    },
    []
  );

  const startProcessingJob = useCallback(async (mode: ProcessingMode) => {
    try {
      const response = await fetch('/api/process-job/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, imagesCount: 1 }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { jobId?: string };
      return payload.jobId ?? null;
    } catch {
      return null;
    }
  }, []);

  const finishProcessingJob = useCallback(
    async (jobId: string | null, status: 'done' | 'failed', errorMessage?: string) => {
      if (!jobId) {
        return;
      }

      try {
        await fetch('/api/process-job/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            status,
            errorMessage: errorMessage ?? null,
          }),
        });
      } catch {}
    },
    []
  );

  const loadAccount = useCallback(async () => {
    setAccountLoading(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch('/api/me', { cache: 'no-store', signal: controller.signal });

      if (!response.ok) {
        setAccount(null);
        return;
      }

      const payload = (await response.json()) as MeResponse;
      setAccount(payload);
      window.dispatchEvent(new CustomEvent<MeResponse>(ACCOUNT_REFRESH_EVENT, { detail: payload }));
    } catch {
      setAccount(null);
    } finally {
      window.clearTimeout(timeout);
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    qualityRef.current = processingQuality;
  }, [processingQuality]);

  useEffect(() => {
    processingModeRef.current = processingMode;
  }, [processingMode]);

  useEffect(() => {
    optimizeFitModeRef.current = optimizeFitMode;
  }, [optimizeFitMode]);

  useEffect(() => {
    downloadFormatRef.current = downloadFormat;
  }, [downloadFormat]);

  useEffect(() => {
    compressionPresetRef.current = compressionPreset;
  }, [compressionPreset]);

  useEffect(() => {
    exportBackgroundRef.current = exportBackground;
  }, [exportBackground]);

  useEffect(() => {
    const nextAutoViewMode = items.length > 6 ? 'list' : 'grid';

    if (items.length === 0) {
      hasManualViewSelectionRef.current = false;
      previousAutoViewModeRef.current = 'grid';
      setViewMode('grid');
      return;
    }

    if (hasManualViewSelectionRef.current) {
      previousAutoViewModeRef.current = nextAutoViewMode;
      return;
    }

    const previousAutoViewMode = previousAutoViewModeRef.current;
    previousAutoViewModeRef.current = nextAutoViewMode;
    setViewMode(nextAutoViewMode);

    if (previousAutoViewMode !== nextAutoViewMode && nextAutoViewMode === 'list') {
      setToast({
        id: `auto-list-${crypto.randomUUID()}`,
        message: 'Switched to list view for easier bulk processing',
      });
    }
  }, [items.length]);

  useEffect(() => {
    if (previousItemCountRef.current === 0 && items.length > 0) {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    previousItemCountRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    if (!toast) {
      setToastVisible(false);
      return;
    }

    setToastVisible(true);

    const fadeTimeout = window.setTimeout(() => {
      setToastVisible(false);
    }, 2600);

    const removeTimeout = window.setTimeout(() => {
      setToast(null);
    }, 2900);

    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(removeTimeout);
    };
  }, [toast]);

  useEffect(() => {
    if (!accountLoading && account) {
      try {
        const shouldShow = window.sessionStorage.getItem(WELCOME_TOAST_FLAG) === 'true';

        if (shouldShow) {
          window.sessionStorage.removeItem(WELCOME_TOAST_FLAG);
          setToast({
            id: `welcome-${crypto.randomUUID()}`,
            message: `Welcome back 👋 You have ${account.credits < 0 ? 'unlimited' : formatCredits(account.credits)} credits`,
          });
        }
      } catch {}
    }
  }, [account, accountLoading]);

  useEffect(() => {
    function hasImageFiles(dataTransfer: DataTransfer | null) {
      if (!dataTransfer) {
        return false;
      }

      if (Array.from(dataTransfer.items ?? []).some((item) => item.kind === 'file')) {
        return true;
      }

      return Array.from(dataTransfer.files ?? []).some((file) => ACCEPTED_IMAGE_TYPES.has(file.type));
    }

    function extractAcceptedFiles(fileList: FileList | null) {
      return Array.from(fileList ?? []).filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type));
    }

    function handleDragEnter(event: DragEvent) {
      if (!hasImageFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      if (noCredits) {
        return;
      }
      dragDepthRef.current += 1;
      setIsPageDragActive(true);
    }

    function handleDragOver(event: DragEvent) {
      if (!hasImageFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      if (noCredits) {
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    }

    function handleDragLeave(event: DragEvent) {
      if (!hasImageFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsPageDragActive(false);
      }
    }

    function handleDrop(event: DragEvent) {
      if (!hasImageFiles(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      dragDepthRef.current = 0;
      setIsPageDragActive(false);

      const files = extractAcceptedFiles(event.dataTransfer?.files ?? null);
      if (files.length > 0 && !uploadsDisabled) {
        void addFiles(files);
      }
    }

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [noCredits, uploadsDisabled]);

  function handleUpgradePlan() {
    window.location.href = '/pricing';
  }

  function handleQualityChange(nextQuality: ProcessingQuality) {
    qualityRef.current = nextQuality;
    setProcessingQuality(nextQuality);
  }

  function handleProcessingModeChange(nextMode: ProcessingMode) {
    processingModeRef.current = nextMode;
    setProcessingMode(nextMode);

    if (nextMode === 'optimize-only') {
      exportBackgroundRef.current = 'white';
      setExportBackground('white');
    }
  }

  function handleOptimizeFitModeChange(nextMode: OptimizeFitMode) {
    optimizeFitModeRef.current = nextMode;
    setOptimizeFitMode(nextMode);
  }

  function handleDownloadFormatChange(nextFormat: DownloadFormat) {
    const resolvedFormat: DownloadFormat = nextFormat === 'png' ? 'png' : 'webp';
    downloadFormatRef.current = resolvedFormat;
    setDownloadFormat(resolvedFormat);

    if (resolvedFormat === 'webp') {
      exportBackgroundRef.current = 'white';
      setExportBackground('white');
    }
  }

  function handleExportBackgroundChange(nextBackground: ExportBackground) {
    const resolvedBackground = downloadFormatRef.current === 'png' ? nextBackground : 'white';
    exportBackgroundRef.current = resolvedBackground;
    setExportBackground(resolvedBackground);
  }

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        URL.revokeObjectURL(item.originalImage);
        if (item.resultImage) {
          URL.revokeObjectURL(item.resultImage);
        }
        if (item.displayImage && item.displayImage !== item.resultImage) {
          URL.revokeObjectURL(item.displayImage);
        }
      });
    };
  }, []);

  function replaceItems(nextItems: ImageTask[]) {
    setItems((current) => {
      current.forEach((item) => {
        URL.revokeObjectURL(item.originalImage);
        if (item.resultImage) {
          URL.revokeObjectURL(item.resultImage);
        }
        if (item.displayImage && item.displayImage !== item.resultImage) {
          URL.revokeObjectURL(item.displayImage);
        }
      });

      return nextItems;
    });
  }

  function appendItems(nextItems: ImageTask[]) {
    setItems((current) => [...nextItems, ...current]);
  }

  function clearItems() {
    hasManualViewSelectionRef.current = false;
    previousAutoViewModeRef.current = 'grid';
    setViewMode('grid');
    replaceItems([]);
    setError(null);
    setState('idle');
  }

  function handleViewModeChange(nextViewMode: 'grid' | 'list') {
    hasManualViewSelectionRef.current = true;
    setViewMode(nextViewMode);
  }

  function updateItem(id: string, updater: (item: ImageTask) => ImageTask) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const nextItem = updater(item);
        if (item.resultImage && item.resultImage !== nextItem.resultImage) {
          URL.revokeObjectURL(item.resultImage);
        }
        if (item.displayImage && item.displayImage !== item.resultImage && item.displayImage !== nextItem.displayImage) {
          URL.revokeObjectURL(item.displayImage);
        }
        if (item.originalImage !== nextItem.originalImage) {
          URL.revokeObjectURL(item.originalImage);
        }
        return nextItem;
      })
    );
  }

  async function processItem(
    item: ImageTask,
    file: File,
    model: RemoveBgModel = 'isnet',
    quality: ProcessingQuality
  ) {
    updateItem(item.id, (current) => ({ ...current, status: 'uploading', error: null }));

    if (item.processingMode === 'optimize-only') {
      const processingJobId = await startProcessingJob(item.processingMode);

      try {
        updateItem(item.id, (current) => ({
          ...current,
          status: 'processing',
          error: null,
        }));

        const optimized = await createOptimizedExport({
          imageUrl: item.originalImage,
          fileName: item.fileName,
          format: item.downloadFormat ?? downloadFormatRef.current,
          preset: item.downloadQualityPreset ?? compressionPresetRef.current,
          background: 'white',
          processingQuality: quality,
          outputSuffix: 'optimized',
          squareCanvas: true,
          fitMode: item.optimizeFitMode ?? optimizeFitModeRef.current,
        });
        await chargeProcessingCredit(item.processingMode);
        await finishProcessingJob(processingJobId, 'done');
        const optimizedUrl = URL.createObjectURL(optimized.blob);
        const originalSizeBytes = file.size;
        const processedSizeBytes = optimized.blob.size;
        const savedBytes = originalSizeBytes - processedSizeBytes;
        const reductionPercent =
          originalSizeBytes > 0 ? Math.round((savedBytes / originalSizeBytes) * 100) : null;
        const savedDisplay = formatBytes(savedBytes);
        console.log('[optimize-only] optimization-metrics', {
          fileName: item.fileName,
          originalSizeBytes,
          processedSizeBytes,
          savedBytes,
          savedDisplay,
          reductionPercent,
        });

        updateItem(item.id, (current) => ({
          ...current,
          resultImage: item.originalImage,
          displayImage: optimizedUrl,
          processedFileSize: optimized.blob.size,
          optimizedFileSize: optimized.blob.size,
          optimizedMimeType: optimized.mimeType,
          status: 'done',
          error: null,
          selectedQuality: current.selectedQuality ?? quality,
          processedBy: null,
          processedQuality: quality,
          exportSize: quality === 'original' ? 'original' : `${optimized.width}x${optimized.height}`,
          optimizeFitMode: current.optimizeFitMode ?? optimizeFitModeRef.current,
        }));
        setToast({
          id: `${item.id}-optimized`,
          message: '✨ Image optimized',
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to optimize image';
        await finishProcessingJob(processingJobId, 'failed', message);
        updateItem(item.id, (current) => ({
          ...current,
          status: 'error',
          error: message,
        }));
      }
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    formData.append('maskCleanup', maskCleanup);
    formData.append('model', model);
    formData.append('quality', quality);

    try {
      updateItem(item.id, (current) => ({
        ...current,
        status: model === 'birefnet' ? 'refining' : 'processing',
        error: null,
      }));
      console.log(`[remove-bg] processing ${item.fileName} with ${model}`);
      console.log(`[remove-bg] selectedQuality sent to backend: ${quality}`);
      console.log(`[remove-bg] stored selectedQuality on item: ${item.selectedQuality ?? 'missing'}`);

      const response = await fetch('/api/remove-bg', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || 'Failed to process image');
      }

      const rawBlob = await response.blob();
      let blob = rawBlob;
      let rawOutputUrl: string | null = null;

      if (model === 'birefnet' && item.resultImage) {
        rawOutputUrl = URL.createObjectURL(rawBlob);
        blob = await alignTransparentImageToReference(rawOutputUrl, item.resultImage);
      }

      const output = URL.createObjectURL(blob);
      const processedQuality =
        (response.headers.get('X-Quality-Mode') as ProcessingQuality | null) ?? quality;
      const exportSize = response.headers.get('X-Export-Size');
      const modelUsed = (response.headers.get('X-Model-Used') as RemoveBgModel | null) ?? model;
      let displayImage: string | null = output;
      let optimizedFileSize: number | null = null;
      let optimizedMimeType: string | null = null;

      try {
        const optimized = await createOptimizedExport({
          imageUrl: output,
          fileName: item.fileName,
          format: item.downloadFormat ?? downloadFormatRef.current,
          preset: item.downloadQualityPreset ?? compressionPresetRef.current,
          background: item.downloadBackground ?? exportBackgroundRef.current,
          processingQuality: processedQuality,
        });
        displayImage = URL.createObjectURL(optimized.blob);
        optimizedFileSize = optimized.blob.size;
        optimizedMimeType = optimized.mimeType;
        const originalSizeBytes = file.size;
        const processedSizeBytes = optimized.blob.size;
        const savedBytes = originalSizeBytes - processedSizeBytes;
        const reductionPercent =
          originalSizeBytes > 0 ? Math.round((savedBytes / originalSizeBytes) * 100) : null;
        const savedDisplay = formatBytes(savedBytes);
        console.log('[remove-bg] optimization-metrics', {
          fileName: item.fileName,
          originalSizeBytes,
          processedSizeBytes,
          savedBytes,
          savedDisplay,
          reductionPercent,
        });
      } catch {
        optimizedFileSize = null;
        optimizedMimeType = null;
        console.log('[remove-bg] optimization-metrics', {
          fileName: item.fileName,
          originalSizeBytes: file.size,
          processedSizeBytes: null,
          savedBytes: null,
          reductionPercent: null,
        });
      }
      console.log(`[remove-bg] processedQuality returned: ${processedQuality}`);

      updateItem(item.id, (current) => ({
        ...current,
        resultImage: output,
        displayImage,
        processedFileSize: blob.size,
        optimizedFileSize,
        optimizedMimeType,
        status: 'done',
        error: null,
        selectedQuality: current.selectedQuality ?? processedQuality,
        processedBy: modelUsed,
        processedQuality,
        exportSize,
      }));
      setToast({
        id: `${item.id}-${model}-done`,
        message: model === 'birefnet' ? '✨ Result refined' : '🎉 Background removed',
      });

      if (rawOutputUrl) {
        URL.revokeObjectURL(rawOutputUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      updateItem(item.id, (current) => ({
        ...current,
        status: 'error',
        error: message
      }));
    }
  }

  async function addFiles(files: File[]) {
    if (accountLoading || !account) {
      setUploadLimitMessage('Checking your plan. Please wait a moment and try again.');
      return;
    }

    const selectedProcessingMode = processingModeRef.current;
    const selectedQuality = qualityRef.current;
    const selectedDownloadFormat = downloadFormatRef.current;
    const selectedCompressionPreset = compressionPresetRef.current;
    const selectedExportBackground = exportBackgroundRef.current;
    console.log(`[remove-bg] current selector before upload: ${selectedQuality}`);
    const selectionLimit = creditLimitedUploadCount;

    if (files.length > planUploadLimit) {
      setUploadLimitMessage(`You can upload up to ${planUploadLimit} images on your plan`);
      return;
    }

    if (
      typeof availableCredits === 'number' &&
      !hasUnlimitedCredits(availableCredits) &&
      files.length > Math.floor(availableCredits / processingCreditCost)
    ) {
      setUploadLimitMessage(`You only have ${formatCredits(availableCredits)} credit${availableCredits === 1 ? '' : 's'} left for this mode`);
      return;
    }

    if (selectionLimit > 0 && files.length > selectionLimit) {
      setUploadLimitMessage(`You can upload up to ${selectionLimit} images right now`);
      return;
    }

    setUploadLimitMessage(null);
    const existingKeys = new Set(itemsRef.current.map((item) => item.sourceKey));
    const seenKeys = new Set<string>();
    const uniqueFiles = files.filter((file) => {
      const key = createFileKey(file);
      if (existingKeys.has(key) || seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    });

    if (uniqueFiles.length === 0) {
      return;
    }

    setError(null);
    setUploadLimitMessage(null);
    setState('uploading');

    const nextItems = uniqueFiles.map((file) => ({
      id: createTaskId(file),
      sourceKey: createFileKey(file),
      fileName: file.name,
      originalImage: URL.createObjectURL(file),
      originalFileSize: file.size,
      resultImage: null,
      displayImage: null,
      processedFileSize: null,
      status: 'uploading' as const,
      error: null,
      selectedQuality,
      processedBy: null,
      processedQuality: null,
      exportSize: null,
      downloadFormat: selectedDownloadFormat,
      downloadQualityPreset: selectedCompressionPreset,
      downloadBackground: selectedExportBackground,
      optimizedFileSize: null,
      optimizedMimeType: null,
      processingMode: selectedProcessingMode,
      optimizeFitMode: optimizeFitModeRef.current,
    }));
    const taskEntries = nextItems.map((item, index) => ({ item, file: uniqueFiles[index] }));

    appendItems(nextItems);
    setToast({
      id: `upload-${crypto.randomUUID()}`,
      message: `✨ ${uniqueFiles.length === 1 ? 'Image uploaded' : `${uniqueFiles.length} images uploaded`}`,
    });

    try {
      setState('processing');
      await processInBatches(taskEntries, MAX_CONCURRENT_UPLOADS, async ({ item, file }) => {
        await processItem(item, file, 'isnet', item.selectedQuality ?? selectedQuality);
      });

      const failedCount = itemsRef.current.filter((item) => item.status === 'error').length;
      if (failedCount > 0) {
        setError(`${failedCount} image${failedCount === 1 ? '' : 's'} failed to process.`);
      }

      setState('result');
    } catch {
      setError('Unexpected batch processing error');
      setState('error');
    } finally {
      void loadAccount();
    }
  }

  async function retryItem(item: ImageTask) {
    if (busy || noCredits) {
      return;
    }

    try {
      const response = await fetch(item.originalImage);
      const blob = await response.blob();
      const file = new File([blob], item.fileName, {
        type: blob.type || 'image/png',
        lastModified: Date.now(),
      });

      setError(null);
      setState('processing');
      await processItem(
        item,
        file,
        item.processingMode === 'optimize-only' ? 'isnet' : item.processedBy ?? 'isnet',
        item.selectedQuality ?? item.processedQuality ?? qualityRef.current
      );
      setState('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected retry error';
      updateItem(item.id, (current) => ({
        ...current,
        status: 'error',
        error: message,
      }));
      setState('error');
    } finally {
      void loadAccount();
    }
  }

  async function refineItem(item: ImageTask) {
    if (busy || noCredits || item.status !== 'done' || item.processingMode === 'optimize-only') {
      return;
    }

    try {
      const response = await fetch(item.originalImage);
      const blob = await response.blob();
      const file = new File([blob], item.fileName, {
        type: blob.type || 'image/png',
        lastModified: Date.now(),
      });

      console.log(`[remove-bg] refine triggered for ${item.fileName}`);
      await processItem(
        item,
        file,
        'birefnet',
        item.selectedQuality ?? item.processedQuality ?? qualityRef.current
      );
      void loadAccount();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected refine error';
      updateItem(item.id, (current) => ({
        ...current,
        status: 'error',
        error: message,
      }));
    }
  }

  async function handleDownloadAll() {
    if (completedItems.length === 0) {
      return;
    }

    try {
      const zip = new JSZip();

      await Promise.all(
        completedItems.map(async (item) => {
          if (!item.resultImage) {
            return;
          }

          const response = await fetch(item.resultImage);
          if (!response.ok) {
            throw new Error(`Failed to fetch processed image for ${item.fileName}`);
          }

          const optimized = await createOptimizedExport({
            imageUrl: item.processingMode === 'optimize-only' ? item.originalImage : item.resultImage,
            fileName: item.fileName,
            format: item.downloadFormat ?? downloadFormatRef.current,
            preset: item.downloadQualityPreset ?? compressionPresetRef.current,
            background: item.processingMode === 'optimize-only' ? 'white' : item.downloadBackground ?? exportBackgroundRef.current,
            processingQuality: item.processedQuality ?? item.selectedQuality ?? processingQuality,
            outputSuffix: item.processingMode === 'optimize-only' ? 'optimized' : 'background-removed',
            squareCanvas: item.processingMode === 'optimize-only',
            fitMode: item.processingMode === 'optimize-only' ? item.optimizeFitMode ?? optimizeFitModeRef.current : 'contain',
          });
          zip.file(optimized.fileName, optimized.blob);
        })
      );

      const archive = await zip.generateAsync({ type: 'blob' });
      saveAs(archive, 'background-removed-images.zip');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create ZIP archive';
      setError(message);
    }
  }

  const completedItems = useMemo(() => items.filter((item) => item.status === 'done' && item.resultImage), [items]);
  const orderedItems = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
          const priorityDiff = statusOrder(left.item.status) - statusOrder(right.item.status);
          if (priorityDiff !== 0) {
            return priorityDiff;
          }

          return left.index - right.index;
        })
        .map(({ item }) => item),
    [items]
  );
  const activeCount = useMemo(
    () => items.filter((item) => item.status === 'uploading' || item.status === 'processing' || item.status === 'refining').length,
    [items]
  );
  const failedCount = useMemo(() => items.filter((item) => item.status === 'error').length, [items]);
  const progressPercent = items.length === 0 ? 0 : (completedItems.length / items.length) * 100;

  return (
    <main
      className={`relative w-full overflow-hidden text-[color:var(--text-primary)] ${
        hasResults ? 'min-h-screen pb-24 pt-[132px]' : 'min-h-screen pb-0'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />
      {isPageDragActive && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-[rgba(11,11,13,0.64)] backdrop-blur-[8px]">
          <div className="absolute inset-6 rounded-[32px] border border-[color:var(--accent-primary)]/25 bg-[rgba(28,28,30,0.88)]" />
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="rounded-full border border-[color:var(--border-color)] bg-[color:var(--panel-bg)] px-6 py-3 text-sm text-[color:var(--text-primary)]">
              Drop image anywhere to upload
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`pointer-events-none fixed right-6 top-28 z-[60] transition duration-300 ${
            toastVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
          }`}
        >
          <div className="rounded-2xl border border-[color:var(--border-color)] bg-[rgba(28,28,30,0.78)] px-4 py-3 text-sm text-[color:var(--text-primary)] shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur-xl">
            {toast.message}
          </div>
        </div>
      )}
      <div className="relative z-10 flex w-full flex-col gap-20 md:gap-24">
        <section
          className={`flex w-full ${
            hasResults ? 'items-start py-0' : 'min-h-[calc(100svh-72px)] items-center py-0'
          }`}
        >
          <div className="mx-auto w-full max-w-[1180px] px-6">
            <div className={`mx-auto flex w-full flex-col items-center text-center ${hasResults ? 'max-w-[780px]' : 'max-w-[520px] xl:max-w-[780px]'}`}>
              <div className="inline-flex rounded-full border border-[color:var(--border-color)] bg-[rgba(28,28,30,0.52)] px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-muted)] backdrop-blur-xl">
                Listing-ready images
              </div>
              <h1 className="mt-6 text-[28px] font-semibold leading-tight text-[color:var(--text-primary)] md:text-[32px]">
                Process your product images
              </h1>
              <p className="mt-4 max-w-[460px] text-sm leading-7 text-[color:var(--text-secondary)] xl:max-w-[680px]">
                Upload images and get clean, listing-ready results in seconds.
              </p>
              {!hasResults && (
                <div className="mt-10 w-full xl:max-w-[720px]">
                  <div className="rounded-[28px] border border-[color:var(--border-color)] bg-[color:var(--panel-bg)] p-0 backdrop-blur-[20px]">
                    <UploadDropzone
                      onFilesSelect={addFiles}
                      processingMode={processingMode}
                      onProcessingModeChange={handleProcessingModeChange}
                      optimizeFitMode={optimizeFitMode}
                      onOptimizeFitModeChange={handleOptimizeFitModeChange}
                      quality={processingQuality}
                      onQualityChange={handleQualityChange}
                      downloadFormat={downloadFormat}
                      onDownloadFormatChange={handleDownloadFormatChange}
                      exportBackground={exportBackground}
                      onExportBackgroundChange={handleExportBackgroundChange}
                      disabled={uploadsDisabled}
                      locked={noCredits}
                      compact={false}
                      validationMessage={uploadLimitMessage}
                      limitText={`Max ${planUploadLimit} images per upload`}
                      creditText={creditText}
                    />
                  </div>
                </div>
              )}
              {account ? (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-[color:var(--text-secondary)]">
                  <span>{formatCredits(account.credits)} credits available</span>
                  <span className="text-[color:var(--text-muted)]">·</span>
                  <span>{creditText}</span>
                </div>
              ) : (
                <p className="mt-5 text-[15px] text-[color:var(--text-secondary)]">No signup required</p>
              )}
              {account && account.credits < 20 && !noCredits && (
                <div className="mt-3 flex items-center gap-3 text-sm">
                  <span className="font-semibold text-[color:var(--status-warning-text)]">
                    Only {formatCredits(account.credits)} credit{account.credits === 1 ? '' : 's'} left
                  </span>
                  <Link href="/account" className="text-[color:var(--text-secondary)] underline underline-offset-4 transition hover:text-[color:var(--text-primary)]">
                    Buy credits
                  </Link>
                </div>
              )}
              {noCredits && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="font-semibold text-[color:var(--status-warning-text)]">
                    You need at least {processingMode === 'optimize-only' ? optimizeOnlyCostLabel : '1 credit'} to continue
                  </span>
                  <button
                    type="button"
                    onClick={handleUpgradePlan}
                    className="text-[color:var(--text-secondary)] underline underline-offset-4 transition hover:text-[color:var(--text-primary)]"
                  >
                    Upgrade plan
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {hasResults && (
          <section ref={workspaceRef} className="w-full scroll-mt-24">
            <div className="mx-auto max-w-6xl px-6">
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-3xl font-semibold text-[color:var(--text-primary)]">Results</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-[color:var(--text-muted)]">{completedItems.length} ready</p>
                    <div className="inline-flex rounded-full border border-[color:var(--border-color)] bg-[color:var(--panel-bg)]/80 p-1">
                      <button
                        type="button"
                        onClick={() => handleViewModeChange('grid')}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          viewMode === 'grid'
                            ? 'bg-[color:var(--surface-muted)] text-[color:var(--text-primary)]'
                            : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
                        }`}
                      >
                        Grid
                      </button>
                      <button
                        type="button"
                        onClick={() => handleViewModeChange('list')}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          viewMode === 'list'
                            ? 'bg-[color:var(--surface-muted)] text-[color:var(--text-primary)]'
                            : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
                        }`}
                      >
                        List
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)]">
                  <BatchControls
                    completedCount={completedItems.length}
                    totalCount={items.length}
                    failedCount={failedCount}
                    processingCount={activeCount}
                    progressPercent={progressPercent}
                    onDownloadAll={handleDownloadAll}
                    onClear={clearItems}
                    disabled={busy}
                    className="h-full"
                  />

                  <UploadDropzone
                    onFilesSelect={(files) => {
                      void addFiles(files);
                    }}
                    processingMode={processingMode}
                    onProcessingModeChange={handleProcessingModeChange}
                    optimizeFitMode={optimizeFitMode}
                    onOptimizeFitModeChange={handleOptimizeFitModeChange}
                    quality={processingQuality}
                    onQualityChange={handleQualityChange}
                    downloadFormat={downloadFormat}
                    onDownloadFormatChange={handleDownloadFormatChange}
                    exportBackground={exportBackground}
                    onExportBackgroundChange={handleExportBackgroundChange}
                    disabled={uploadsDisabled}
                    compact
                    resultsCompact
                    limitText={planUploadLimit > 0 ? `Max ${planUploadLimit} images per upload` : 'Upload limit reached'}
                    creditText={creditText}
                  />
                </div>

                {(state === 'uploading' || state === 'processing') && (
                  <ProcessingLoader
                    stage={state}
                    detail={activeCount > 0 ? `${activeCount} image${activeCount === 1 ? '' : 's'} in progress` : undefined}
                  />
                )}

                {error && (
                  <p
                    className="rounded-2xl border px-4 py-3 text-sm theme-danger-text"
                    style={{ borderColor: 'var(--danger-soft-border)', background: 'var(--danger-soft-bg)' }}
                  >
                    {error}
                  </p>
                )}

                {viewMode === 'grid' ? (
                  <ImageGrid items={orderedItems} onRetry={retryItem} onRefine={refineItem} />
                ) : (
                  <ImageList items={orderedItems} onRetry={retryItem} onRefine={refineItem} />
                )}
              </div>
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
