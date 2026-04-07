import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildWooImporterUserPrompt, WOO_IMPORTER_SYSTEM_PROMPT } from '@/lib/woocommerceImporterPrompt';

const PRODUCT_TITLE_PATTERNS = [
  /<h1[^>]*(?:class|id)=["'][^"']*(?:product[-_\s]?title|product_title|product-name|productname|pdp-title|product-detail-title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
  /<h1[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i,
  /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
];

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;
const IMAGE_REJECTION_KEYWORDS = [
  'logo',
  'icon',
  'sprite',
  'banner',
  'ad',
  'prime',
  'fresh',
  'nav',
  'header',
  'footer',
  'promo',
  'placeholder',
  'pixel',
  'ui',
  'avatar',
  'profile',
  'user',
  'account',
  'person',
  'default-image',
  'no-image',
  'anonymous',
  'generic-user',
  'silhouette',
];
const MIN_IMAGE_SIZE = 300;

interface ImageCandidate {
  url: string;
  source: string;
  alt?: string;
  width?: number;
  height?: number;
  context?: string;
  score: number;
  positiveSignals: string[];
  negativeSignals: string[];
}

interface ProductPayload {
  product: {
    name: string;
    source_title: string;
    slug: string;
    type: 'simple';
    regular_price: string;
    source_price: string;
    suggested_price: string;
    estimated_market_range?: string;
    description: string;
    manage_stock: 1;
    stock: 1;
    stock_status: 'instock';
    published: 0;
    categories: string;
  };
  images: string[];
}

interface AiProductContent {
  name: string;
  slug: string;
  regular_price: string;
  description: string;
  categories: string;
}

interface PriceSignal {
  amount: number;
  currency: string;
  source: string;
  label?: string;
}

function dedupeTitleSegments(value: string) {
  const normalized = value
    .split(/[,|/]/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const segment of normalized) {
    const key = segment.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(segment);
  }

  return deduped.join(', ');
}

function trimMarketplaceSuffixes(value: string) {
  return value
    .replace(/\s*[:|\-]\s*amazon\.[a-z.]+.*$/i, '')
    .replace(/\s*[:|\-]\s*(electronics|photo|fashion|home|kitchen|store).*$/i, '')
    .replace(/\s*[\-–|]\s*(buy now|shop now|official store).*$/i, '')
    .trim();
}

function trimCompatibilityTail(value: string) {
  if (value.length <= 110) {
    return value;
  }

  const compatibilityIndex = value.search(/\b(?:compatible with|for iphone|works with|fits)\b/i);
  if (compatibilityIndex > 48) {
    return value.slice(0, compatibilityIndex).replace(/[,\s-]+$/g, '').trim();
  }

  return value;
}

function cleanStoreTitle(rawTitle: string, documentTitle: string) {
  const source = (rawTitle || documentTitle || '').trim();
  if (!source) {
    return '';
  }

  let cleaned = source
    .replace(/^\s*(?:private|privāts|privat)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = trimMarketplaceSuffixes(cleaned);
  cleaned = cleaned.replace(/\b(?:free delivery|eligible orders|shop with|shop on)\b.*$/i, '').trim();
  cleaned = cleaned.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').trim();
  cleaned = dedupeTitleSegments(cleaned);
  cleaned = trimCompatibilityTail(cleaned);

  if (cleaned.length > 110) {
    const truncated = cleaned.slice(0, 110);
    const safeBoundary = Math.max(truncated.lastIndexOf(','), truncated.lastIndexOf(' '));
    cleaned = truncated.slice(0, safeBoundary > 72 ? safeBoundary : 110).replace(/[,\s-]+$/g, '').trim();
  }

  return cleaned || source;
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeUrl(rawUrl: string, baseUrl: string) {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return null;
  }
}

function canonicalizeProductUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);

    if (isEbayLikeUrl(rawUrl)) {
      const itemId = parsed.pathname.match(/\/itm\/(?:[^/]+\/)?(\d+)/)?.[1];
      if (itemId) {
        return `https://www.ebay.com/itm/${itemId}`;
      }
    }

    if (isAmazonLikeUrl(rawUrl)) {
      const asin = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)?.[1];
      if (asin) {
        return `${parsed.origin}/dp/${asin}`;
      }
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

function isProductInterstitial(html: string) {
  return /pardon our interruption|access denied|captcha|robot check|verify you are a human|security measure/i.test(html);
}

function hasUsableProductSignals(sourceTitle: string, images: string[], price: string) {
  const normalizedTitle = sourceTitle.trim().toLowerCase();
  const weakTitle =
    !normalizedTitle ||
    normalizedTitle === 'imported product' ||
    normalizedTitle.includes('pardon our interruption') ||
    normalizedTitle.includes('access denied');

  return !weakTitle || images.length > 0 || Boolean(price.trim());
}

function isAmazonLikeUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('amazon.');
  } catch {
    return false;
  }
}

function isEbayLikeUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().includes('ebay.');
  } catch {
    return false;
  }
}

function isShopifyLikeHtml(html: string) {
  return /shopify|cdn\.shopify\.com|ProductJson-|ShopifyAnalytics/i.test(html);
}

function isWooCommerceLikePage(url: string, html: string) {
  return /woocommerce-product-gallery|wp-content\/uploads|woocommerce/i.test(html) || /wp-content/i.test(url);
}

function upgradeAmazonImageUrl(imageUrl: string) {
  return imageUrl
    .replace(/\._[^.]+_\./, '.')
    .replace(/\._SL\d+_\./, '.')
    .replace(/\._SX\d+_\./, '.')
    .replace(/\._SY\d+_\./, '.')
    .replace(/\._UX\d+_\./, '.')
    .replace(/\._UY\d+_\./, '.');
}

function upgradeEbayImageUrl(imageUrl: string) {
  return imageUrl.replace(/s-l\d+\.(jpg|jpeg|png|webp)$/i, 's-l1600.$1');
}

function upgradeShopifyImageUrl(imageUrl: string) {
  return imageUrl
    .replace(/_(\d+x\d+|pico|icon|thumb|small|compact|medium|large|grande|1024x1024|master)(?=\.)/i, '')
    .replace(/(\.(?:jpg|jpeg|png|webp))(?:\?v=\d+)?$/i, '$1');
}

function upgradeGenericImageUrl(imageUrl: string) {
  return imageUrl
    .replace(/([?&])(width|height|w|h|resize_w|resize_h)=\d+/gi, '$1')
    .replace(/[?&]+$/, '');
}

function normalizeImageCandidateUrl(rawUrl: string, baseUrl: string) {
  const normalized = normalizeUrl(rawUrl, baseUrl);
  if (!normalized) {
    return null;
  }

  if (isAmazonLikeUrl(normalized)) {
    return upgradeAmazonImageUrl(normalized);
  }

  if (isEbayLikeUrl(normalized)) {
    return upgradeEbayImageUrl(normalized);
  }

  if (/cdn\.shopify\.com/i.test(normalized)) {
    return upgradeShopifyImageUrl(normalized);
  }

  return upgradeGenericImageUrl(normalized);
}

function parseInteger(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function collectMatches(value: string, regex: RegExp) {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(value)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  return matches;
}

function extractAmazonGalleryCandidates(html: string, baseUrl: string) {
  const rawUrls = new Set<string>();

  const patterns = [
    /"hiRes"\s*:\s*"([^"]+)"/g,
    /"large"\s*:\s*"([^"]+)"/g,
    /"mainUrl"\s*:\s*"([^"]+)"/g,
    /"thumbUrl"\s*:\s*"([^"]+)"/g,
  ];

  for (const pattern of patterns) {
    for (const match of collectMatches(html, pattern)) {
      rawUrls.add(match.replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
    }
  }

  for (const match of collectMatches(html, /"colorImages"\s*:\s*\{[\s\S]*?"initial"\s*:\s*\[([\s\S]*?)\]\s*\}/g)) {
    for (const imageMatch of [
      ...collectMatches(match, /"hiRes"\s*:\s*"([^"]+)"/g),
      ...collectMatches(match, /"large"\s*:\s*"([^"]+)"/g),
      ...collectMatches(match, /"mainUrl"\s*:\s*"([^"]+)"/g),
      ...collectMatches(match, /"thumbUrl"\s*:\s*"([^"]+)"/g),
    ]) {
      rawUrls.add(imageMatch.replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
    }
  }

  for (const match of collectMatches(html, /data-old-hires=["']([^"']+)["']/gi)) {
    rawUrls.add(match.replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
  }

  for (const match of collectMatches(html, /data-a-dynamic-image=["']([^"']+)["']/gi)) {
    for (const imageUrl of collectMatches(match.replace(/&quot;/g, '"'), /https?:\/\/m\.media-amazon\.com\/images\/I\/[^"'\s,}]+/gi)) {
      rawUrls.add(imageUrl);
    }
  }

  for (const imageUrl of collectMatches(html.replace(/\\\//g, '/'), /https?:\/\/m\.media-amazon\.com\/images\/I\/[^"'\\\s<,]+/gi)) {
    rawUrls.add(imageUrl.replace(/\\u0026/g, '&'));
  }

  return [...rawUrls]
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl, baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'amazon-gallery',
          context: 'product-gallery',
          score: 120,
          positiveSignals: ['amazon-gallery'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractAmazonLandingImageCandidates(html: string, baseUrl: string) {
  const landingUrls = collectMatches(html, /"landingImage"\s*:\s*"([^"]+)"/g);

  return landingUrls
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl.replace(/\\u0026/g, '&').replace(/\\"/g, '"'), baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'amazon-landing-image',
          context: 'product-gallery',
          score: 100,
          positiveSignals: ['amazon-landing-image'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractEbayGalleryCandidates(html: string, baseUrl: string) {
  const rawUrls = new Set<string>();
  const normalizedHtml = html.replace(/\\\//g, '/');
  const patterns = [
    /"imageUrl"\s*:\s*"([^"]+)"/g,
    /"imageUrls"\s*:\s*\[([\s\S]*?)\]/g,
    /"mainImgUrl"\s*:\s*"([^"]+)"/g,
    /"maxImageUrl"\s*:\s*"([^"]+)"/g,
    /"galleryPlusPictureURL"\s*:\s*"([^"]+)"/g,
    /"additionalImages"\s*:\s*\[([\s\S]*?)\]/g,
    /"pictureURLSuperSize"\s*:\s*"([^"]+)"/g,
    /"pictureUrl"\s*:\s*"([^"]+)"/g,
    /"pictureURL"\s*:\s*"([^"]+)"/g,
    /"thumbnailImages"\s*:\s*\[([\s\S]*?)\]/g,
  ];

  for (const pattern of patterns) {
    for (const match of collectMatches(normalizedHtml, pattern)) {
      const normalizedMatch = match.replace(/\\u0026/g, '&').replace(/\\"/g, '"').replace(/\\\//g, '/');

      if (normalizedMatch.includes('http')) {
        for (const nestedUrl of collectMatches(normalizedMatch, /https?:\/\/[^"'\s,\\\]]+/g)) {
          rawUrls.add(nestedUrl.replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
        }
        rawUrls.add(normalizedMatch);
      }
    }
  }

  for (const imageUrl of collectMatches(normalizedHtml, /(?:https?:)?\/\/(?:i\.ebayimg\.com|i\.ebayimg\.cdn|ir\.ebaystatic\.com)\/[^"'\\\s<,]+/gi)) {
    const expanded = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
    rawUrls.add(expanded.replace(/\\u0026/g, '&'));
  }

  for (const srcset of collectMatches(normalizedHtml, /srcset=["']([^"']+)["']/gi)) {
    for (const imageUrl of collectMatches(srcset, /(?:https?:)?\/\/(?:i\.ebayimg\.com|i\.ebayimg\.cdn|ir\.ebaystatic\.com)\/[^"'\\\s,]+/gi)) {
      const expanded = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
      rawUrls.add(expanded.replace(/\\u0026/g, '&'));
    }
  }

  return [...rawUrls]
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl, baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'ebay-gallery',
          context: 'product-gallery',
          score: 118,
          positiveSignals: ['ebay-gallery'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractShopifyGalleryCandidates(html: string, baseUrl: string) {
  const rawUrls = new Set<string>();

  for (const block of html.match(/<script[^>]+id=["'][^"']*ProductJson[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []) {
    const json = safeParseJson(block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim()) as
      | { images?: unknown[]; featured_image?: string }
      | null;
    if (json?.featured_image) {
      rawUrls.add(json.featured_image);
    }
    if (Array.isArray(json?.images)) {
      for (const image of json.images) {
        if (typeof image === 'string') {
          rawUrls.add(image);
        }
      }
    }
  }

  for (const match of collectMatches(html, /"featured_image"\s*:\s*"([^"]+)"/g)) {
    rawUrls.add(match.replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
  }

  for (const match of collectMatches(html, /"images"\s*:\s*\[([\s\S]*?)\]/g)) {
    for (const url of collectMatches(match, /"([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g)) {
      rawUrls.add(url.replace(/\\u0026/g, '&').replace(/\\"/g, '"'));
    }
  }

  return [...rawUrls]
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl, baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'shopify-gallery',
          context: 'product-gallery',
          score: 116,
          positiveSignals: ['shopify-gallery'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractWooCommerceGalleryCandidates(html: string, baseUrl: string) {
  const rawUrls = new Set<string>();

  for (const match of collectMatches(html, /woocommerce-product-gallery__image[^>]*>\s*<a[^>]+href=["']([^"']+)["']/gi)) {
    rawUrls.add(match);
  }

  for (const match of collectMatches(html, /data-large_image=["']([^"']+)["']/gi)) {
    rawUrls.add(match);
  }

  for (const match of collectMatches(html, /data-src=["']([^"']+)["']/gi)) {
    rawUrls.add(match);
  }

  return [...rawUrls]
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl, baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'woocommerce-gallery',
          context: 'product-gallery',
          score: 112,
          positiveSignals: ['woocommerce-gallery'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractGenericProductGalleryCandidates(html: string, baseUrl: string) {
  const rawUrls = new Set<string>();

  const patterns = [
    /data-zoom-image=["']([^"']+)["']/gi,
    /data-image-url=["']([^"']+)["']/gi,
    /data-large-image=["']([^"']+)["']/gi,
    /product[-_\s]gallery[\s\S]{0,400}?src=["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of collectMatches(html, pattern)) {
      rawUrls.add(match);
    }
  }

  return [...rawUrls]
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl, baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'generic-product-gallery',
          context: 'product-gallery',
          score: 92,
          positiveSignals: ['generic-product-gallery'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractProductTitle(html: string) {
  for (const pattern of PRODUCT_TITLE_PATTERNS) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return stripTags(match[1]);
    }
  }

  const jsonLdName = extractJsonLdProductName(html);
  if (jsonLdName) {
    return jsonLdName;
  }

  const documentTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return documentTitle ? stripTags(documentTitle) : 'Imported product';
}

function extractDocumentTitle(html: string) {
  const documentTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return documentTitle ? stripTags(documentTitle) : '';
}

function extractJsonLdBlocks(html: string) {
  const matches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  return matches
    .map((block) => block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim())
    .filter(Boolean);
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function walkJsonLd(node: unknown, callback: (value: Record<string, unknown>) => void) {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkJsonLd(item, callback);
    }
    return;
  }

  if (typeof node === 'object') {
    const record = node as Record<string, unknown>;
    callback(record);

    for (const value of Object.values(record)) {
      walkJsonLd(value, callback);
    }
  }
}

function isProductType(typeValue: unknown) {
  if (typeof typeValue === 'string') {
    return typeValue.toLowerCase() === 'product';
  }

  if (Array.isArray(typeValue)) {
    return typeValue.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'product');
  }

  return false;
}

function extractJsonLdProductName(html: string) {
  for (const block of extractJsonLdBlocks(html)) {
    const parsed = safeParseJson(block);
    let foundName: string | null = null;

    walkJsonLd(parsed, (value) => {
      if (foundName) {
        return;
      }

      if (isProductType(value['@type']) && typeof value.name === 'string' && value.name.trim()) {
        foundName = stripTags(value.name);
      }
    });

    if (foundName) {
      return foundName;
    }
  }

  return null;
}

function extractJsonLdImages(html: string, baseUrl: string) {
  const images: ImageCandidate[] = [];

  for (const block of extractJsonLdBlocks(html)) {
    const parsed = safeParseJson(block);

    walkJsonLd(parsed, (value) => {
      if (!isProductType(value['@type'])) {
        return;
      }

      const imageField = value.image;
      if (typeof imageField === 'string') {
        const normalized = normalizeImageCandidateUrl(imageField, baseUrl);
        if (normalized) {
          images.push({
            url: normalized,
            source: 'jsonld-product-image',
            context: 'structured-product',
            score: 80,
            positiveSignals: ['jsonld-product-image'],
            negativeSignals: [],
          });
        }
      } else if (Array.isArray(imageField)) {
        for (const entry of imageField) {
          if (typeof entry === 'string') {
            const normalized = normalizeImageCandidateUrl(entry, baseUrl);
            if (normalized) {
              images.push({
                url: normalized,
                source: 'jsonld-product-image',
                context: 'structured-product',
                score: 80,
                positiveSignals: ['jsonld-product-image'],
                negativeSignals: [],
              });
            }
          } else if (entry && typeof entry === 'object' && typeof (entry as { url?: unknown }).url === 'string') {
            const normalized = normalizeImageCandidateUrl((entry as { url: string }).url, baseUrl);
            if (normalized) {
              images.push({
                url: normalized,
                source: 'jsonld-product-image',
                context: 'structured-product',
                score: 80,
                positiveSignals: ['jsonld-product-image'],
                negativeSignals: [],
              });
            }
          }
        }
      }
    });
  }

  return images;
}

function extractMetaImages(html: string, baseUrl: string) {
  const matches = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi) ?? [];
  return matches
    .map((entry) => entry.match(/content=["']([^"']+)["']/i)?.[1] ?? '')
    .map((imageUrl) => normalizeImageCandidateUrl(imageUrl, baseUrl))
    .filter((value): value is string => Boolean(value))
    .map(
      (url) =>
        ({
          url,
          source: 'og-image',
          context: 'meta-image',
          score: 40,
          positiveSignals: ['og-image'],
          negativeSignals: [],
        }) satisfies ImageCandidate
    );
}

function extractInlineImages(html: string, baseUrl: string) {
  const matches = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) ?? [];
  const candidates: Array<ImageCandidate | null> = matches
    .map((entry) => {
      const src = entry.match(/src=["']([^"']+)["']/i)?.[1] ?? '';
      const alt = stripTags(entry.match(/alt=["']([^"']*)["']/i)?.[1] ?? '');
      const width = parseInteger(entry.match(/width=["']?(\d+)/i)?.[1]);
      const height = parseInteger(entry.match(/height=["']?(\d+)/i)?.[1]);
      return {
        src,
        alt,
        width,
        height,
      };
    })
    .map((entry) => {
      const url = normalizeImageCandidateUrl(entry.src, baseUrl);
      if (!url || !IMAGE_EXTENSIONS.test(url)) {
        return null;
      }

      return {
        url,
        alt: entry.alt,
        width: entry.width,
        height: entry.height,
        source: 'inline-img',
        context: 'dom-image',
        score: 20,
        positiveSignals: ['inline-img'],
        negativeSignals: [],
      } satisfies ImageCandidate;
    });

  return candidates.filter((value): value is ImageCandidate => value !== null);
}

function scoreImageCandidate(candidate: ImageCandidate) {
  const evaluated = {
    ...candidate,
    positiveSignals: [...candidate.positiveSignals],
    negativeSignals: [...candidate.negativeSignals],
  };

  const searchText = `${candidate.url} ${candidate.alt ?? ''} ${candidate.source}`.toLowerCase();

  for (const keyword of IMAGE_REJECTION_KEYWORDS) {
    if (searchText.includes(keyword)) {
      evaluated.score -= 140;
      evaluated.negativeSignals.push(`keyword:${keyword}`);
    }
  }

  const hasAvatarKeyword =
    searchText.includes('avatar') ||
    searchText.includes('profile') ||
    searchText.includes('generic-user') ||
    searchText.includes('default-image') ||
    searchText.includes('anonymous') ||
    searchText.includes('silhouette');

  if (hasAvatarKeyword) {
    evaluated.score = -1000;
    evaluated.negativeSignals.push('rejected:avatar-keyword');
    return evaluated;
  }

  if (candidate.width && candidate.width < MIN_IMAGE_SIZE) {
    evaluated.score -= 80;
    evaluated.negativeSignals.push(`small-width:${candidate.width}`);
  }

  if (candidate.height && candidate.height < MIN_IMAGE_SIZE) {
    evaluated.score -= 80;
    evaluated.negativeSignals.push(`small-height:${candidate.height}`);
  }

  const maxSide = Math.max(candidate.width ?? 0, candidate.height ?? 0);
  if (maxSide >= 1200) {
    evaluated.score += 36;
    evaluated.positiveSignals.push('large-1200');
  } else if (maxSide >= 800) {
    evaluated.score += 24;
    evaluated.positiveSignals.push('large-800');
  } else if (maxSide >= 300) {
    evaluated.score += 10;
    evaluated.positiveSignals.push('usable-size');
  }

  if (isAmazonLikeUrl(candidate.url) || candidate.url.includes('/images/')) {
    evaluated.score += 16;
    evaluated.positiveSignals.push('product-image-host');
  }

  if (candidate.width && candidate.height) {
    const ratio = candidate.width / candidate.height;
    if (ratio > 3 || ratio < 0.33) {
      evaluated.score -= 40;
      evaluated.negativeSignals.push(`suspicious-ratio:${ratio.toFixed(2)}`);
    }

    const isSquare = ratio > 0.9 && ratio < 1.1;
    const maxSideForAvatar = Math.max(candidate.width, candidate.height);
    if (isSquare && maxSideForAvatar <= 600 && candidate.source === 'inline-img') {
      evaluated.score -= 120;
      evaluated.negativeSignals.push('likely-square-avatar-asset');
    }
  }

  if (candidate.context === 'product-gallery' || candidate.context === 'structured-product') {
    evaluated.score += 32;
    evaluated.positiveSignals.push(`context:${candidate.context}`);
  }

  if (candidate.context === 'dom-image' || candidate.source === 'inline-img') {
    evaluated.score -= 35;
    evaluated.negativeSignals.push('not-in-product-gallery-context');
  }

  return evaluated;
}

function rankAndSelectImages(candidates: ImageCandidate[], limit = 8) {
  const grouped = new Map<string, ImageCandidate>();

  for (const candidate of candidates.map(scoreImageCandidate)) {
    const key = candidate.url.replace(/[?#].*$/, '');
    const existing = grouped.get(key);
    if (!existing || candidate.score > existing.score) {
      grouped.set(key, candidate);
    } else if (existing) {
      existing.score += 10;
      existing.positiveSignals.push('repeated-source');
    }
  }

  const accepted = [...grouped.values()]
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const rejected = [...grouped.values()]
    .filter((candidate) => candidate.score <= 0)
    .sort((left, right) => left.score - right.score);

  console.log(
    '[process-products] selected-images',
    accepted.map((candidate) => ({
      url: candidate.url,
      source: candidate.source,
      score: candidate.score,
      positiveSignals: candidate.positiveSignals,
      negativeSignals: candidate.negativeSignals,
    }))
  );
  console.log(
    '[process-products] rejected-images',
    rejected.slice(0, 12).map((candidate) => ({
      url: candidate.url,
      source: candidate.source,
      score: candidate.score,
      negativeSignals: candidate.negativeSignals,
    }))
  );

  return accepted.map((candidate) => candidate.url);
}

function extractDescription(html: string) {
  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];
  if (metaDescription) {
    return stripTags(metaDescription);
  }

  const productDescription = html.match(
    /<(?:div|section|p)[^>]*(?:class|id)=["'][^"']*(?:description|product-description|product-summary|summary)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|p)>/i
  )?.[1];

  if (productDescription) {
    return stripTags(productDescription);
  }

  return '';
}

function extractMetaDescription(html: string) {
  const metaDescription = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];
  return metaDescription ? stripTags(metaDescription) : '';
}

function extractJsonLdPrice(html: string) {
  for (const block of extractJsonLdBlocks(html)) {
    const parsed = safeParseJson(block);
    let foundPrice: string | null = null;

    walkJsonLd(parsed, (value) => {
      if (foundPrice) {
        return;
      }

      if (!isProductType(value['@type'])) {
        return;
      }

      const offers = value.offers;
      const offerRecords = Array.isArray(offers) ? offers : offers ? [offers] : [];

      for (const offer of offerRecords) {
        if (!offer || typeof offer !== 'object') {
          continue;
        }

        const record = offer as Record<string, unknown>;
        if (typeof record.price === 'string' && record.price.trim()) {
          foundPrice = record.price.trim();
          return;
        }

        if (typeof record.price === 'number') {
          foundPrice = String(record.price);
          return;
        }
      }
    });

    if (foundPrice) {
      return foundPrice;
    }
  }

  return '';
}

function extractMetaPrice(html: string) {
  const price =
    html.match(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ??
    html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1];

  return price ? stripTags(price) : '';
}

function extractVisiblePrice(html: string) {
  const currencyMatch =
    html.match(/(?:\$|€|£)\s?\d[\d.,]*/)?.[0] ??
    html.match(/\b\d[\d.,]*\s?(?:USD|EUR|GBP)\b/i)?.[0];

  return currencyMatch ? stripTags(currencyMatch) : '';
}

function extractPrice(html: string) {
  return extractMetaPrice(html) || extractJsonLdPrice(html) || extractVisiblePrice(html) || '';
}

function normalizePrice(value: string) {
  return value.trim();
}

function parsePriceSignal(value: string, source: string, label?: string): PriceSignal | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const currency = trimmed.includes('€')
    ? 'EUR'
    : trimmed.includes('£')
      ? 'GBP'
      : trimmed.includes('$')
        ? 'USD'
        : /\bEUR\b/i.test(trimmed)
          ? 'EUR'
          : /\bGBP\b/i.test(trimmed)
            ? 'GBP'
            : /\bUSD\b/i.test(trimmed)
              ? 'USD'
              : 'EUR';

  const numericPart = trimmed.replace(/[^0-9.,]/g, '');
  const normalized = numericPart.includes(',') && numericPart.includes('.')
    ? numericPart.replace(/,/g, '')
    : numericPart.includes(',') && !numericPart.includes('.')
      ? numericPart.replace(',', '.')
      : numericPart;
  const amount = Number.parseFloat(normalized);

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return { amount, currency, source, label };
}

function convertToEur(signal: PriceSignal) {
  const rates: Record<string, number> = {
    EUR: 1,
    USD: 0.92,
    GBP: 1.17,
  };

  return signal.amount * (rates[signal.currency] ?? 1);
}

function formatPriceDisplay(amount: number, currency: string) {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
  };

  return `${amount.toFixed(2)} ${symbols[currency] ?? currency}`.replace('.00 ', ' ');
}

function roundSuggestedPrice(amount: number) {
  if (amount < 20) {
    return Math.max(0.99, Math.round(amount) - 0.01);
  }

  return Math.ceil(amount) - 0.01;
}

function toWooPriceString(amount: number) {
  return amount.toFixed(2);
}

function extractPriceSignals(html: string) {
  const signals: PriceSignal[] = [];

  const directSignals = [
    parsePriceSignal(extractMetaPrice(html), 'meta-price'),
    parsePriceSignal(extractJsonLdPrice(html), 'jsonld-price'),
    parsePriceSignal(extractVisiblePrice(html), 'visible-price'),
  ].filter((value): value is PriceSignal => Boolean(value));

  signals.push(...directSignals);

  for (const block of extractJsonLdBlocks(html)) {
    const parsed = safeParseJson(block);
    walkJsonLd(parsed, (value) => {
      if (!isProductType(value['@type'])) {
        return;
      }

      const offers = value.offers;
      const offerRecords = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const offer of offerRecords) {
        if (!offer || typeof offer !== 'object') {
          continue;
        }
        const record = offer as Record<string, unknown>;
        const priceValue =
          typeof record.price === 'string' ? record.price : typeof record.price === 'number' ? String(record.price) : '';
        const currency = typeof record.priceCurrency === 'string' ? record.priceCurrency.toUpperCase() : undefined;
        if (!priceValue) {
          continue;
        }
        const parsedSignal = parsePriceSignal(currency ? `${priceValue} ${currency}` : priceValue, 'jsonld-offer');
        if (parsedSignal) {
          signals.push(parsedSignal);
        }
      }
    });
  }

  return signals;
}

async function fetchAdditionalComparisonSignals(productTitle: string, sourceUrl: string) {
  const comparisonApi = process.env.PRICE_COMPARISON_API_URL;
  if (!comparisonApi) {
    return [] as PriceSignal[];
  }

  try {
    const response = await fetch(`${comparisonApi}?q=${encodeURIComponent(productTitle)}&source=${encodeURIComponent(sourceUrl)}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return [] as PriceSignal[];
    }

    const payload = (await response.json()) as {
      results?: Array<{ price?: string; currency?: string; title?: string }>;
    };

    return (payload.results ?? [])
      .map((entry) => parsePriceSignal(`${entry.price ?? ''} ${entry.currency ?? ''}`.trim(), 'comparison-api', entry.title))
      .filter((value): value is PriceSignal => Boolean(value));
  } catch {
    return [] as PriceSignal[];
  }
}

function matchPriceSignals(signals: PriceSignal[], sourceTitle: string) {
  const titleTokens = new Set(
    sourceTitle
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3)
  );

  return signals.filter((signal) => {
    if (!signal.label) {
      return true;
    }

    const labelTokens = signal.label
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);
    const overlap = labelTokens.filter((token) => titleTokens.has(token)).length;
    return overlap >= Math.min(3, Math.max(1, Math.floor(labelTokens.length * 0.3)));
  });
}

function filterOutlierPrices(signals: PriceSignal[]) {
  if (signals.length <= 2) {
    return signals;
  }

  const eurValues = signals.map(convertToEur).sort((a, b) => a - b);
  const median = eurValues[Math.floor(eurValues.length / 2)];

  return signals.filter((signal) => {
    const value = convertToEur(signal);
    return value >= median * 0.55 && value <= median * 1.55;
  });
}

function buildSuggestedPricing(sourcePrice: string, signals: PriceSignal[]) {
  const parsedSource = parsePriceSignal(sourcePrice, 'source-price');
  if (!parsedSource) {
    return {
      sourcePrice: sourcePrice.trim(),
      suggestedPrice: '',
      estimatedMarketRange: '',
    };
  }

  const relevantSignals = filterOutlierPrices(signals);
  const baseCurrency = parsedSource.currency;

  if (relevantSignals.length === 0) {
    return {
      sourcePrice: toWooPriceString(parsedSource.amount),
      suggestedPrice: toWooPriceString(parsedSource.amount),
      estimatedMarketRange: '',
    };
  }

  const eurValues = relevantSignals.map(convertToEur);
  const average = eurValues.reduce((sum, value) => sum + value, 0) / eurValues.length;
  const min = Math.min(...eurValues);
  const max = Math.max(...eurValues);
  const rates: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17 };
  const baseRate = rates[baseCurrency] ?? 1;
  const marketMidInBase = average / baseRate;
  const minInBase = min / baseRate;
  const maxInBase = max / baseRate;
  const suggested = roundSuggestedPrice(Math.max(parsedSource.amount, marketMidInBase * 1.06));

  return {
    sourcePrice: toWooPriceString(parsedSource.amount),
    suggestedPrice: toWooPriceString(suggested),
    estimatedMarketRange:
      relevantSignals.length >= 2
        ? `${formatPriceDisplay(minInBase, baseCurrency)} - ${formatPriceDisplay(maxInBase, baseCurrency)}`
        : '',
  };
}

function basicHtmlDescription(name: string, description: string) {
  const safeDescription = description.trim();
  if (safeDescription) {
    return `<p>${safeDescription}</p>`;
  }

  return `<p>${name} prepared for WooCommerce import.</p>`;
}

async function generateAiContent(input: {
  url: string;
  scrapedTitle: string;
  documentTitle: string;
  metaDescription: string;
  productDescription: string;
  price: string;
  categoriesDefault: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'woocommerce_product_content',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                slug: { type: 'string' },
                regular_price: { type: 'string' },
                description: { type: 'string' },
                categories: { type: 'string' },
              },
              required: ['name', 'slug', 'regular_price', 'description', 'categories'],
            },
          },
        },
        messages: [
          {
            role: 'system',
            content: WOO_IMPORTER_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: buildWooImporterUserPrompt(input),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content) as Partial<AiProductContent>;
    if (
      typeof parsed.name !== 'string' ||
      typeof parsed.slug !== 'string' ||
      typeof parsed.regular_price !== 'string' ||
      typeof parsed.description !== 'string' ||
      typeof parsed.categories !== 'string'
    ) {
      return null;
    }

    return parsed as AiProductContent;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be logged in to import products.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const url = typeof body?.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'Product URL is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Please enter a valid product URL.' }, { status: 400 });
    }

    const canonicalUrl = canonicalizeProductUrl(parsedUrl.toString());
    const response = await fetch(canonicalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        Referer: parsedUrl.origin,
      },
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Could not load product page (${response.status}).` }, { status: 502 });
    }

    const html = await response.text();
    const finalUrl = response.url || parsedUrl.toString();
    const sourceTitle = extractProductTitle(html);
    const documentTitle = extractDocumentTitle(html);
    const metaDescription = extractMetaDescription(html);
    const description = extractDescription(html);
    const price = normalizePrice(extractPrice(html));

    const platformCandidates: ImageCandidate[] = isAmazonLikeUrl(finalUrl)
      ? [...extractAmazonGalleryCandidates(html, finalUrl), ...extractAmazonLandingImageCandidates(html, finalUrl)]
      : isEbayLikeUrl(finalUrl)
        ? extractEbayGalleryCandidates(html, finalUrl)
        : isShopifyLikeHtml(html)
          ? extractShopifyGalleryCandidates(html, finalUrl)
          : isWooCommerceLikePage(finalUrl, html)
            ? extractWooCommerceGalleryCandidates(html, finalUrl)
            : extractGenericProductGalleryCandidates(html, finalUrl);

    const genericCandidates = [
      ...extractJsonLdImages(html, finalUrl),
      ...extractMetaImages(html, finalUrl),
      ...extractInlineImages(html, finalUrl),
    ];

    const images = rankAndSelectImages(
      platformCandidates.length > 0 ? [...platformCandidates, ...genericCandidates] : genericCandidates,
      10
    );

    if (isProductInterstitial(html) && !hasUsableProductSignals(sourceTitle, images, price)) {
      return NextResponse.json(
        { error: 'This product page blocked automated access. Try a cleaner product URL or another product page.' },
        { status: 502 }
      );
    }

    const aiContent = await generateAiContent({
      url: finalUrl,
      scrapedTitle: sourceTitle,
      documentTitle,
      metaDescription,
      productDescription: description,
      price,
      categoriesDefault: '',
    });

    const storeTitle = aiContent?.name?.trim() || cleanStoreTitle(sourceTitle, documentTitle) || sourceTitle;
    const comparisonSignals = matchPriceSignals(
      [...extractPriceSignals(html), ...(await fetchAdditionalComparisonSignals(storeTitle, finalUrl))],
      sourceTitle
    );
    const pricing = buildSuggestedPricing(price, comparisonSignals);

    console.log(
      '[process-products] price-signals',
      comparisonSignals.map((signal) => ({
        source: signal.source,
        amount: signal.amount,
        currency: signal.currency,
        label: signal.label,
      }))
    );

    const payload: ProductPayload = {
      product: {
        name: storeTitle,
        source_title: sourceTitle,
        slug: aiContent?.slug?.trim() || slugify(storeTitle || parsedUrl.hostname),
        type: 'simple',
        regular_price: pricing.suggestedPrice || aiContent?.regular_price?.trim() || price,
        source_price: pricing.sourcePrice || price,
        suggested_price: pricing.suggestedPrice || aiContent?.regular_price?.trim() || price,
        estimated_market_range: pricing.estimatedMarketRange || undefined,
        description: aiContent?.description?.trim() || basicHtmlDescription(storeTitle, description || metaDescription),
        manage_stock: 1,
        stock: 1,
        stock_status: 'instock',
        published: 0,
        categories: aiContent?.categories?.trim() || '',
      },
      images,
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
