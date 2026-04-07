'use client';

import { Crown, Eye, ImagePlus, Star, Trash2, UploadCloud, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { UnifiedImage } from '@/components/woocommerce-importer/ProductCard';
import { createWooImagePreview, WOO_PREVIEW_SIZE } from '@/lib/woocommerceImagePreview';

interface ImageManagerProps {
  productName: string;
  scrapedImages: UnifiedImage[];
  selectedImages: UnifiedImage[];
  onChange: (nextImages: UnifiedImage[]) => void;
}

function ensureMainImage(images: UnifiedImage[]) {
  if (images.length === 0) {
    return images;
  }

  if (images.some((image) => image.isMain)) {
    return images;
  }

  return images.map((image, index) => ({
    ...image,
    isMain: index === 0,
  }));
}

export default function ImageManager({ productName, scrapedImages, selectedImages, onChange }: ImageManagerProps) {
  const [previewImage, setPreviewImage] = useState<UnifiedImage | null>(null);

  const selectedImageIds = useMemo(() => new Set(selectedImages.map((image) => image.id)), [selectedImages]);

  useEffect(() => {
    return () => {
      for (const image of selectedImages) {
        if (image.source === 'uploaded' && image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
        if (image.processedPreviewUrl) {
          URL.revokeObjectURL(image.processedPreviewUrl);
        }
      }
    };
  }, [selectedImages]);

  useEffect(() => {
    const pendingImages = selectedImages.filter((image) => !image.isProcessed && !image.isProcessing);
    if (pendingImages.length === 0) {
      return;
    }

    onChange(
      ensureMainImage(
        selectedImages.map((image) =>
          pendingImages.some((pendingImage) => pendingImage.id === image.id)
            ? { ...image, isProcessing: true }
            : image
        )
      )
    );

    let cancelled = false;

    Promise.all(
      pendingImages.map(async (image) => {
        try {
          const processed = await createWooImagePreview(image.previewUrl ?? image.url);
          return {
            id: image.id,
            processedPreviewUrl: processed.previewUrl,
            processedWidth: processed.width,
            processedHeight: processed.height,
            isProcessed: true,
            isProcessing: false,
          };
        } catch {
          return {
            id: image.id,
            isProcessed: false,
            isProcessing: false,
          };
        }
      })
    ).then((results) => {
      if (cancelled) {
        for (const result of results) {
          if ('processedPreviewUrl' in result && result.processedPreviewUrl) {
            URL.revokeObjectURL(result.processedPreviewUrl);
          }
        }
        return;
      }

      onChange(
        ensureMainImage(
          selectedImages.map((image) => {
            const processedResult = results.find((result) => result.id === image.id);
            if (!processedResult) {
              return image;
            }

            if (image.processedPreviewUrl && image.processedPreviewUrl !== processedResult.processedPreviewUrl) {
              URL.revokeObjectURL(image.processedPreviewUrl);
            }

            return {
              ...image,
              ...processedResult,
            };
          })
        )
      );
    });

    return () => {
      cancelled = true;
    };
  }, [onChange, selectedImages]);

  const addScrapedImage = useCallback(
    (image: UnifiedImage) => {
      if (selectedImageIds.has(image.id)) {
        return;
      }

      onChange(
        ensureMainImage([
          ...selectedImages,
          {
            ...image,
            isMain: selectedImages.length === 0,
          },
        ])
      );
    },
    [onChange, selectedImageIds, selectedImages]
  );

  const removeSelectedImage = useCallback(
    (imageId: string) => {
      const imageToRemove = selectedImages.find((image) => image.id === imageId);
      if (imageToRemove?.source === 'uploaded' && imageToRemove.previewUrl) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }
      if (imageToRemove?.processedPreviewUrl) {
        URL.revokeObjectURL(imageToRemove.processedPreviewUrl);
      }

      onChange(ensureMainImage(selectedImages.filter((image) => image.id !== imageId)));
      if (previewImage?.id === imageId) {
        setPreviewImage(null);
      }
    },
    [onChange, previewImage?.id, selectedImages]
  );

  const setMainImage = useCallback(
    (imageId: string) => {
      onChange(
        selectedImages.map((image) => ({
          ...image,
          isMain: image.id === imageId,
        }))
      );
    },
    [onChange, selectedImages]
  );

  const onDrop = useCallback(
    (files: File[]) => {
      if (files.length === 0) {
        return;
      }

      const uploadedImages = files.map((file, index) => {
        const objectUrl = URL.createObjectURL(file);

        return {
          id: crypto.randomUUID(),
          source: 'uploaded' as const,
          url: objectUrl,
          file,
          previewUrl: objectUrl,
          isMain: selectedImages.length === 0 && index === 0,
        };
      });

      onChange(ensureMainImage([...selectedImages, ...uploadedImages]));
    },
    [onChange, selectedImages]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
    },
    noClick: true,
    multiple: true,
  });

  return (
    <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Product images</p>
          <h4 className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">Select and arrange images</h4>
          <p className="mt-2 max-w-[560px] text-sm leading-6 text-[color:var(--text-secondary)]">
            Choose scraped images, add uploaded files, then mark the main image for WooCommerce.
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="theme-accent-button inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
        >
          <ImagePlus className="h-4 w-4" />
          Add uploaded images
        </button>
      </div>

      <div className="mt-4 space-y-3.5">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Scraped images</span>
            <span className="text-xs text-[color:var(--text-secondary)]">{scrapedImages.length} found</span>
          </div>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {scrapedImages.length > 0 ? (
              scrapedImages.map((image, index) => {
                const selected = selectedImageIds.has(image.id);
                return (
                  <div
                    key={image.id}
                    className={`overflow-hidden rounded-[16px] border bg-[rgba(255,255,255,0.03)] transition ${
                      selected
                        ? 'border-[rgba(110,231,183,0.32)]'
                        : 'border-[color:var(--border-color)] hover:border-[color:var(--accent-primary)]'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden bg-[rgba(255,255,255,0.02)]">
                      <img
                        src={image.url}
                        alt={`${productName} scraped image ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="space-y-1 px-2.5 py-2">
                      <div>
                        <p className="text-[11px] font-medium leading-4 text-[color:var(--text-primary)]">Scraped image {index + 1}</p>
                        <p className="mt-0.5 text-[10px] leading-4 text-[color:var(--text-secondary)]">
                          {selected ? 'Already selected' : 'Available to add'}
                        </p>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => addScrapedImage(image)}
                          disabled={selected}
                          className="theme-secondary-button inline-flex items-center rounded-full px-2 py-1 text-[10px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {selected ? 'Added' : 'Add'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] px-5 py-7 text-center text-sm text-[color:var(--text-secondary)] col-span-2 md:col-span-3 xl:col-span-4">
                No scraped images were detected for this product yet.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Selected images</span>
            <span className="text-xs text-[color:var(--text-secondary)]">{selectedImages.length} selected</span>
          </div>

          <div
            {...getRootProps()}
            className={`rounded-[22px] border px-4 py-4 transition-colors ${
              isDragActive
                ? 'border-[color:var(--accent-primary)] bg-[rgba(124,58,237,0.12)] shadow-[0_0_0_1px_rgba(124,58,237,0.22)]'
                : 'border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)]'
            }`}
          >
            <input {...getInputProps()} />

            {selectedImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {selectedImages.map((image) => (
                  <div
                    key={image.id}
                    className={`overflow-hidden rounded-[20px] border bg-[rgba(255,255,255,0.03)] ${
                      image.isMain ? 'border-[rgba(110,231,183,0.38)] shadow-[0_0_0_1px_rgba(110,231,183,0.1)]' : 'border-[color:var(--border-color)]'
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-[rgba(255,255,255,0.02)]">
                      <img
                        src={image.processedPreviewUrl ?? image.previewUrl ?? image.url}
                        alt={productName}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[color:var(--border-color)] bg-[rgba(10,10,12,0.78)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[color:var(--text-secondary)]">
                          {image.source}
                        </span>
                        {image.isMain ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(110,231,183,0.35)] bg-[rgba(16,185,129,0.14)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[rgb(167,243,208)]">
                            <Crown className="h-3 w-3" />
                            Main
                          </span>
                        ) : null}
                        {image.isProcessed ? (
                          <span className="rounded-full border border-[rgba(96,165,250,0.3)] bg-[rgba(37,99,235,0.16)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[rgb(191,219,254)]">
                            1000x1000
                          </span>
                        ) : null}
                        {image.isProcessing ? (
                          <span className="rounded-full border border-[rgba(244,114,182,0.3)] bg-[rgba(190,24,93,0.18)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[rgb(251,207,232)]">
                            Processing
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-3 px-3 py-3">
                      <div className="text-xs text-[color:var(--text-secondary)]">
                        {image.isProcessed
                          ? `Preview ready · ${image.processedWidth}x${image.processedHeight}`
                          : image.isProcessing
                            ? 'Generating 1000x1000 preview...'
                            : 'Original selected image'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewImage(image)}
                          className="theme-secondary-button inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        {!image.isMain ? (
                          <button
                            type="button"
                            onClick={() => setMainImage(image.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--accent-primary)] hover:text-[color:var(--text-primary)]"
                          >
                            <Star className="h-3.5 w-3.5" />
                            Set main
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeSelectedImage(image.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(248,113,113,0.2)] bg-[rgba(127,29,29,0.18)] px-3 py-1.5 text-xs font-medium text-[rgb(254,202,202)] transition hover:border-[rgba(248,113,113,0.32)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[104px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] px-5 py-4 text-center">
                <UploadCloud className="h-7 w-7 text-[color:var(--accent-primary)]" />
                <p className="mt-2.5 text-sm font-medium text-[color:var(--text-primary)]">
                  {isDragActive ? 'Drop images here' : 'No selected images yet'}
                </p>
                <p className="mt-1 max-w-[420px] text-sm leading-6 text-[color:var(--text-secondary)]">
                  Drag uploaded files here or add scraped images from the row above.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewImage ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(5,5,7,0.78)] px-4 py-8 backdrop-blur-md">
          <div className="panel w-full max-w-[820px] rounded-[28px] p-5 animate-[modal-enter_180ms_ease-out]">
            <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Image preview</p>
                  <h5 className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                    {previewImage.isMain ? 'Main image' : 'Selected image'}
                  </h5>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
                  aria-label="Close image preview"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)]">
                <img
                  src={previewImage.processedPreviewUrl ?? previewImage.previewUrl ?? previewImage.url}
                  alt={productName}
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[color:var(--text-secondary)]">
                <span>{previewImage.isProcessed ? `Listing-ready preview · ${WOO_PREVIEW_SIZE}x${WOO_PREVIEW_SIZE}` : 'Original image preview'}</span>
                <span className="uppercase tracking-[0.14em]">{previewImage.source}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
