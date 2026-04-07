'use client';

import { Archive, Download, Images } from 'lucide-react';
import { useMemo, useState } from 'react';
import ProductCard, { type UnifiedImage, type WooProductDraft } from '@/components/woocommerce-importer/ProductCard';
import { buildWooCommerceCsv } from '@/lib/woocommerceCsv';
import { buildWooCommerceImagesZip, buildWooCommerceImportPackage, countSelectedImages } from '@/lib/woocommercePackage';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

interface ProcessProductsResponse {
  product: {
    name: string;
    source_title: string;
    slug: string;
    type: WooProductDraft['type'];
    regular_price: string;
    description: string;
    manage_stock: 1;
    stock: number;
    stock_status: WooProductDraft['stockStatus'];
    published: 0 | 1;
    categories: string;
  };
  images: string[];
}

function createScrapedImages(images: string[]): UnifiedImage[] {
  return images.map((imageUrl) => ({
    id: crypto.randomUUID(),
    source: 'scraped',
    url: imageUrl,
    isMain: false,
  }));
}

export default function WooCommerceImporterClient() {
  const [urls, setUrls] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [products, setProducts] = useState<WooProductDraft[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const urlCount = useMemo(
    () =>
      urls
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean).length,
    [urls]
  );

  const selectedImageCount = useMemo(() => countSelectedImages(products), [products]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setErrorMessage(null);

    const urlList = urls
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean);

    if (urlList.length === 0) {
      setProducts([]);
      return;
    }

    setIsProcessing(true);

    try {
      const collectedErrors: string[] = [];
      const nextProducts = await Promise.all(
        urlList.map(async (url, index) => {
          try {
            const response = await fetch('/api/process-products', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url }),
            });

            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              throw new Error(payload?.error ?? `Could not process ${url}`);
            }

            const payload = (await response.json()) as ProcessProductsResponse;

            return {
              id: crypto.randomUUID(),
              sourceUrl: url,
              productName: payload.product.name || `Imported Product ${index + 1}`,
              sourceTitle: payload.product.source_title || payload.product.name || `Imported Product ${index + 1}`,
              slug: payload.product.slug || slugify(payload.product.name || `Imported Product ${index + 1}`),
              type: payload.product.type ?? 'simple',
              regularPrice: payload.product.regular_price ?? '',
              description: payload.product.description ?? '',
              manageStock: payload.product.manage_stock === 1,
              stock: String(payload.product.stock ?? 1),
              stockStatus: payload.product.stock_status ?? 'instock',
              published: payload.product.published === 1,
              categories: payload.product.categories ?? '',
              scrapedImages: createScrapedImages(payload.images ?? []),
              selectedImages: [],
            } satisfies WooProductDraft;
          } catch (error) {
            const message = error instanceof Error ? error.message : `Could not process ${url}`;
            collectedErrors.push(message);
            return null;
          }
        })
      );

      const successfulProducts: WooProductDraft[] = [];

      for (const product of nextProducts) {
        if (product) {
          successfulProducts.push(product);
        }
      }

      setProducts(successfulProducts);
      if (collectedErrors.length > 0) {
        setErrorMessage(collectedErrors.join('\n'));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not process product URLs right now.');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleProductChange(id: string, nextProduct: WooProductDraft) {
    setProducts((current) => current.map((product) => (product.id === id ? nextProduct : product)));
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

  function handleExportCsv() {
    if (products.length === 0) {
      return;
    }

    const csv = buildWooCommerceCsv(products);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, 'woocommerce-products.csv');
    setExportMessage(`WooCommerce CSV ready. Exported ${products.length} product${products.length === 1 ? '' : 's'}.`);
    window.setTimeout(() => setExportMessage(null), 2600);
  }

  async function handleExportImages() {
    if (selectedImageCount === 0) {
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const archive = await buildWooCommerceImagesZip(products);
      downloadBlob(archive, 'woocommerce-product-images.zip');
      setExportMessage(
        `Image package ready. Exported ${selectedImageCount} processed image${selectedImageCount === 1 ? '' : 's'}.`
      );
      window.setTimeout(() => setExportMessage(null), 2600);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not package processed images right now.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPackage() {
    if (products.length === 0) {
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);

    try {
      const csv = buildWooCommerceCsv(products);
      const archive = await buildWooCommerceImportPackage(csv, products);
      downloadBlob(archive, 'woocommerce-import-package.zip');
      setExportMessage(
        `WooCommerce package ready. Included ${products.length} product${products.length === 1 ? '' : 's'} and ${selectedImageCount} image${selectedImageCount === 1 ? '' : 's'}.`
      );
      window.setTimeout(() => setExportMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not build the WooCommerce package right now.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 pb-24 pt-[140px] text-[color:var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-10">
        <section className="mx-auto flex w-full max-w-[780px] flex-col items-center text-center">
          <div className="inline-flex rounded-full border border-[color:var(--border-color)] bg-[rgba(28,28,30,0.52)] px-5 py-2.5 text-[11px] uppercase tracking-[0.28em] text-[color:var(--text-muted)] backdrop-blur-xl">
            Import tool
          </div>
          <h1 className="mt-8 text-[42px] font-semibold leading-[0.96] tracking-tight text-[color:var(--text-primary)] md:text-[60px]">
            Import products from any URL
          </h1>
          <p className="mt-6 max-w-[680px] text-[18px] leading-8 text-[color:var(--text-secondary)]">
            Paste product links, review the essentials, and download a WooCommerce-ready package.
          </p>
        </section>

        <section className="mx-auto w-full max-w-[900px]">
          <div className="panel rounded-[32px] p-5 md:p-6">
            <div className="rounded-[28px] border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] p-6 md:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Product URLs</p>
                  <textarea
                    value={urls}
                    onChange={(event) => setUrls(event.target.value)}
                    placeholder={`https://store.example/products/item-1\nhttps://store.example/products/item-2`}
                    className="min-h-[220px] w-full resize-none rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-4 text-base leading-7 text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--text-secondary)]">
                    <span>Paste one or more product links, one per line.</span>
                    <span>{urlCount} URL{urlCount === 1 ? '' : 's'} added</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    Paste URLs, generate product previews, and export a WooCommerce package when you are ready.
                  </p>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="theme-accent-button inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium"
                  >
                    {isProcessing ? 'Processing...' : 'Process products'}
                  </button>
                </div>

                {errorMessage ? (
                  <div className="rounded-2xl border border-[rgba(248,113,113,0.28)] bg-[rgba(127,29,29,0.22)] px-4 py-3 text-sm text-[rgb(254,202,202)]">
                    {errorMessage}
                  </div>
                ) : null}
              </form>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[900px]">
          <div className="panel rounded-[32px] p-5 md:p-6">
            <div className="rounded-[28px] border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-6 py-14 text-center md:px-10 md:py-16">
              {products.length > 0 ? (
                <div className="space-y-5 text-left">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-2 text-center sm:text-left">
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Imported results</p>
                      <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Generated products</h2>
                      <p className="max-w-[560px] text-sm leading-7 text-[color:var(--text-secondary)]">
                        Review the essentials, choose product images, and download a WooCommerce-ready package.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleExportPackage}
                        disabled={isExporting || products.length === 0}
                        className="theme-accent-button inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Archive className="h-4 w-4" />
                        {isExporting ? 'Building package...' : 'Download WooCommerce package'}
                      </button>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          disabled={isExporting || products.length === 0}
                          className="theme-secondary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Download className="h-4 w-4" />
                          Download CSV only
                        </button>
                        <button
                          type="button"
                          onClick={handleExportImages}
                          disabled={isExporting || selectedImageCount === 0}
                          className="theme-secondary-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Images className="h-4 w-4" />
                          Download images only
                        </button>
                      </div>

                      <p className="text-sm text-[color:var(--text-secondary)] sm:max-w-[340px] sm:text-right">
                        Download one package with CSV and processed images for manual WooCommerce import.
                      </p>
                    </div>
                  </div>

                  {exportMessage ? (
                    <div className="rounded-2xl border border-[rgba(110,231,183,0.3)] bg-[rgba(16,185,129,0.12)] px-4 py-3 text-sm text-[rgb(167,243,208)]">
                      {exportMessage}
                    </div>
                  ) : null}

                  <div className="space-y-4">
                    {products.map((product, index) => (
                      <ProductCard
                        key={product.id}
                        index={index}
                        product={product}
                        onChange={handleProductChange}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Future results</p>
                  <h2 className="mt-4 text-2xl font-semibold text-[color:var(--text-primary)]">WooCommerce-ready product cards will appear here</h2>
                  <p className="mx-auto mt-4 max-w-[560px] text-sm leading-7 text-[color:var(--text-secondary)]">
                    {hasSubmitted
                      ? 'Add at least one valid product URL to generate product previews.'
                      : 'Start by pasting product URLs above. This area will show editable WooCommerce-ready product previews.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
