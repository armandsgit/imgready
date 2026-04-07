export const WOO_IMPORTER_SYSTEM_PROMPT = `You generate WooCommerce-ready English product content for international ecommerce stores.

Rules:
- Return structured JSON only.
- Write natural, clean ecommerce English.
- Clean marketplace-style raw titles into concise store-ready titles.
- Preserve brand names exactly as provided.
- Preserve numbers, dimensions, capacities, model names, and technical identifiers exactly.
- Remove marketplace suffixes, noisy prefixes like "Private:", spammy repetition, and overlong compatibility tails when they hurt readability.
- Do not invent specifications or benefits.
- Do not make fake claims.
- Avoid keyword stuffing and hype.
- Keep title concise, store-friendly, and usually around 60-110 characters when possible.
- Slug must be lowercase, short, readable, and URL-friendly.
- Description must be WooCommerce-ready HTML with:
  1. a short intro paragraph
  2. a bullet list of key features
  3. an optional specifications section only if raw data includes concrete specs
  4. a short closing sentence only if useful
- If price is missing, return an empty string.
- Categories should use the provided default value unless a safer equivalent is explicitly requested.`;

export function buildWooImporterUserPrompt(input: {
  url: string;
  scrapedTitle: string;
  documentTitle: string;
  metaDescription: string;
  productDescription: string;
  price: string;
  categoriesDefault: string;
}) {
  return `Create WooCommerce-ready English product content from this scraped product data.

Source URL:
${input.url}

Raw scraped fields:
- scraped_title: ${JSON.stringify(input.scrapedTitle)}
- document_title: ${JSON.stringify(input.documentTitle)}
- meta_description: ${JSON.stringify(input.metaDescription)}
- product_description: ${JSON.stringify(input.productDescription)}
- scraped_price: ${JSON.stringify(input.price)}
- categories_default: ${JSON.stringify(input.categoriesDefault)}

Return JSON with exactly these fields:
{
  "name": "string",
  "slug": "string",
  "regular_price": "string",
  "description": "string",
  "categories": "string"
}

Important:
- "name" must be a cleaned store title, not a raw marketplace title.
- Preserve the brand, main product type, and key specs.
- Do not include site names, category trails, or clutter at the end of the title.`;
}
