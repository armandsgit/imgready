import JSZip from 'jszip';
import type { UnifiedImage, WooProductDraft } from '@/components/woocommerce-importer/ProductCard';
import { createWooImagePreview } from '@/lib/woocommerceImagePreview';

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'product';
}

function orderedImages(images: UnifiedImage[]) {
  return [...images].sort((left, right) => {
    if (left.isMain && !right.isMain) return -1;
    if (!left.isMain && right.isMain) return 1;
    return 0;
  });
}

export function getProductImageFileEntries(product: WooProductDraft, productIndex: number) {
  const baseName = sanitizeSegment(product.slug || product.productName || `product-${productIndex + 1}`);
  const filePrefix = `product-${productIndex + 1}-${baseName}`;
  const images = orderedImages(product.selectedImages);

  return images.map((image, imageIndex) => ({
    image,
    fileName:
      image.isMain || imageIndex === 0
        ? `${filePrefix}-main.webp`
        : `${filePrefix}-gallery-${imageIndex}.webp`,
  }));
}

async function blobFromImage(image: UnifiedImage) {
  if (image.processedPreviewUrl) {
    const response = await fetch(image.processedPreviewUrl);
    return await response.blob();
  }

  const processed = await createWooImagePreview(image.previewUrl ?? image.url);
  return processed.blob;
}

export async function buildWooCommerceImagesZip(products: WooProductDraft[]) {
  const zip = new JSZip();
  const imagesFolder = zip.folder('images');
  if (!imagesFolder) {
    throw new Error('Could not initialize images zip folder.');
  }

  for (const [productIndex, product] of products.entries()) {
    const imageEntries = getProductImageFileEntries(product, productIndex);
    for (const entry of imageEntries) {
      const blob = await blobFromImage(entry.image);
      imagesFolder.file(entry.fileName, blob);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export async function buildWooCommerceImportPackage(csvContent: string, products: WooProductDraft[]) {
  const zip = new JSZip();
  const rootFolder = zip.folder('import-package');
  if (!rootFolder) {
    throw new Error('Could not initialize import package.');
  }

  rootFolder.file('products.csv', csvContent);
  const imagesFolder = rootFolder.folder('images');
  if (!imagesFolder) {
    throw new Error('Could not initialize package images folder.');
  }

  for (const [productIndex, product] of products.entries()) {
    const imageEntries = getProductImageFileEntries(product, productIndex);
    for (const entry of imageEntries) {
      const blob = await blobFromImage(entry.image);
      imagesFolder.file(entry.fileName, blob);
    }
  }

  return zip.generateAsync({ type: 'blob' });
}

export function countSelectedImages(products: WooProductDraft[]) {
  return products.reduce((total, product) => total + product.selectedImages.length, 0);
}
