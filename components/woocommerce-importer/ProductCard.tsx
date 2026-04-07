'use client';

import { Archive, ChevronDown, ChevronUp, Download, ExternalLink, Images, Package2 } from 'lucide-react';
import { useState } from 'react';
import EditableField from '@/components/woocommerce-importer/EditableField';
import ImageManager from '@/components/woocommerce-importer/ImageManager';
import { buildWooCommerceCsv } from '@/lib/woocommerceCsv';
import { buildWooCommerceImagesZip, buildWooCommerceImportPackage } from '@/lib/woocommercePackage';

export interface UnifiedImage {
  id: string;
  source: 'scraped' | 'uploaded';
  url: string;
  file?: File;
  previewUrl?: string;
  processedPreviewUrl?: string;
  processedWidth?: number;
  processedHeight?: number;
  isProcessed?: boolean;
  isProcessing?: boolean;
  isMain: boolean;
}

export interface WooProductDraft {
  id: string;
  sourceUrl: string;
  productName: string;
  sourceTitle: string;
  slug: string;
  type: 'simple' | 'variable' | 'external' | 'grouped';
  regularPrice: string;
  description: string;
  manageStock: boolean;
  stock: string;
  stockStatus: 'instock' | 'outofstock' | 'onbackorder';
  published: boolean;
  categories: string;
  scrapedImages: UnifiedImage[];
  selectedImages: UnifiedImage[];
}

interface ProductCardProps {
  index: number;
  product: WooProductDraft;
  onChange: (id: string, nextProduct: WooProductDraft) => void;
}

export default function ProductCard({ index, product, onChange }: ProductCardProps) {
  const [expanded, setExpanded] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [originalTitleOpen, setOriginalTitleOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const coverImage = product.selectedImages.find((image) => image.isMain) ?? product.selectedImages[0] ?? product.scrapedImages[0] ?? null;

  function update<K extends keyof WooProductDraft>(key: K, value: WooProductDraft[K]) {
    onChange(product.id, {
      ...product,
      [key]: value,
    });
  }

  function downloadBlob(blob: Blob, fileName: string) {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  async function handleDownloadPackage() {
    setIsExporting(true);
    try {
      const csv = buildWooCommerceCsv([product]);
      const archive = await buildWooCommerceImportPackage(csv, [product]);
      downloadBlob(archive, `${product.slug || `product-${index + 1}`}-woocommerce-package.zip`);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDownloadImages() {
    setIsExporting(true);
    try {
      const archive = await buildWooCommerceImagesZip([product]);
      downloadBlob(archive, `${product.slug || `product-${index + 1}`}-images.zip`);
    } finally {
      setIsExporting(false);
    }
  }

  function handleDownloadCsv() {
    const csv = buildWooCommerceCsv([product]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${product.slug || `product-${index + 1}`}.csv`);
  }

  return (
    <article className="panel rounded-[30px] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {coverImage ? (
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.03)] p-1.5">
              <img
                src={coverImage.processedPreviewUrl ?? coverImage.previewUrl ?? coverImage.url}
                alt={product.productName}
                className="h-full w-full rounded-xl object-contain"
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
              <Package2 className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Product {index + 1}</p>
            <h3 className="mt-2 truncate text-xl font-semibold text-[color:var(--text-primary)]">{product.productName}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[color:var(--text-secondary)]">
              <span className="truncate">{product.sourceUrl}</span>
              <a
                href={product.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[color:var(--accent-primary)] transition hover:text-white"
              >
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3.5 py-2 text-sm font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
          >
            {expanded ? 'Collapse' : 'Expand'}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-5 space-y-5">
          <div className="md:col-span-2">
            <ImageManager
              productName={product.productName}
              scrapedImages={product.scrapedImages}
              selectedImages={product.selectedImages}
              onChange={(selectedImages) => update('selectedImages', selectedImages)}
            />
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)]">
              <div className="space-y-3">
                <EditableField label="Product title" value={product.productName} onChange={(value) => update('productName', value)} />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOriginalTitleOpen((current) => !current)}
                    className="theme-secondary-button inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium"
                  >
                    {originalTitleOpen ? 'Hide original title' : 'View original title'}
                  </button>
                  {product.sourceTitle && product.sourceTitle !== product.productName ? (
                    <button
                      type="button"
                      onClick={() => update('productName', product.sourceTitle)}
                      className="theme-secondary-button inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium"
                    >
                      Use original title
                    </button>
                  ) : null}
                </div>
                {originalTitleOpen && product.sourceTitle ? (
                  <div className="rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                    {product.sourceTitle}
                  </div>
                ) : null}
              </div>
              <EditableField
                label="Regular price"
                value={product.regularPrice}
                onChange={(value) => update('regularPrice', value)}
                type="number"
                placeholder="e.g. 49.99"
              />
            </div>

            <EditableField
              label="Description"
              value={product.description}
              onChange={(value) => update('description', value)}
              multiline
              helperText="Keep this short and store-ready. You can expand it later inside WooCommerce if needed."
            />
          </div>

          <div className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
            <button
              type="button"
              onClick={handleDownloadPackage}
              disabled={isExporting}
              className="theme-accent-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Archive className="h-4 w-4" />
              {isExporting ? 'Building package...' : 'Download WooCommerce package'}
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="theme-secondary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Download CSV only
              </button>
              <button
                type="button"
                onClick={handleDownloadImages}
                disabled={isExporting || product.selectedImages.length === 0}
                className="theme-secondary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Images className="h-4 w-4" />
                Download images only
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-[color:var(--text-primary)]">Advanced settings</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
                  Optional WooCommerce fields for stock, type, slug, categories, and publish status.
                </p>
              </div>
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 text-[color:var(--text-secondary)]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[color:var(--text-secondary)]" />
              )}
            </button>

            {advancedOpen ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <EditableField label="Slug" value={product.slug} onChange={(value) => update('slug', value)} />

                <EditableField
                  label="Categories"
                  value={product.categories}
                  onChange={(value) => update('categories', value)}
                  placeholder="e.g. electronics, accessories, tools"
                  helperText="Optional. You can edit this now or assign categories later in WooCommerce."
                />

                <label className="block space-y-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Type</span>
                  <select
                    value={product.type}
                    onChange={(event) => update('type', event.target.value as WooProductDraft['type'])}
                    className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition-colors focus:border-[color:var(--accent-primary)]"
                  >
                    <option value="simple">Simple</option>
                    <option value="variable">Variable</option>
                    <option value="external">External</option>
                    <option value="grouped">Grouped</option>
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Stock status</span>
                  <select
                    value={product.stockStatus}
                    onChange={(event) => update('stockStatus', event.target.value as WooProductDraft['stockStatus'])}
                    className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition-colors focus:border-[color:var(--accent-primary)]"
                  >
                    <option value="instock">In stock</option>
                    <option value="outofstock">Out of stock</option>
                    <option value="onbackorder">On backorder</option>
                  </select>
                </label>

                <div className="grid gap-4 rounded-[24px] border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
                  <label className="flex items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium text-[color:var(--text-primary)]">Manage stock</span>
                      <span className="mt-1 block text-xs text-[color:var(--text-secondary)]">Track quantity for WooCommerce inventory</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={product.manageStock}
                      onChange={(event) => update('manageStock', event.target.checked)}
                      className="h-5 w-5 rounded border-[color:var(--border-color)] bg-transparent accent-[color:var(--accent-primary)]"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Stock</span>
                    <input
                      type="number"
                      value={product.stock}
                      onChange={(event) => update('stock', event.target.value)}
                      disabled={!product.manageStock}
                      className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition-colors focus:border-[color:var(--accent-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </label>
                </div>

                <div className="grid gap-4 rounded-[24px] border border-[color:var(--border-color)] bg-[rgba(255,255,255,0.02)] p-4">
                  <label className="flex items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-medium text-[color:var(--text-primary)]">Published</span>
                      <span className="mt-1 block text-xs text-[color:var(--text-secondary)]">Ready for live WooCommerce status later</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={product.published}
                      onChange={(event) => update('published', event.target.checked)}
                      className="h-5 w-5 rounded border-[color:var(--border-color)] bg-transparent accent-[color:var(--accent-primary)]"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
