import type { WooProductDraft } from '@/components/woocommerce-importer/ProductCard';

const CSV_HEADERS = [
  'name',
  'slug',
  'type',
  'regular_price',
  'description',
  'manage_stock',
  'stock',
  'stock_status',
  'published',
  'categories',
] as const;

function escapeCsvValue(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildWooCommerceCsv(products: WooProductDraft[]) {
  const rows = products.map((product) => [
    product.productName,
    product.slug,
    product.type,
    product.regularPrice,
    product.description,
    product.manageStock ? '1' : '0',
    product.stock,
    product.stockStatus,
    product.published ? '1' : '0',
    product.categories,
  ]);

  const csvLines = [
    CSV_HEADERS.join(','),
    ...rows.map((row) => row.map((value) => escapeCsvValue(String(value ?? ''))).join(',')),
  ];

  return `\uFEFF${csvLines.join('\n')}`;
}
