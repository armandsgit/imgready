import { defaultBrandingSettings, type BrandingSettings } from '@/lib/appConfig';
import { prisma } from '@/lib/prisma';

const BRANDING_SETTINGS_SLUG = '__branding';

function normalizeBrandingSettings(nextSettings: Partial<BrandingSettings>): BrandingSettings {
  return {
    logo: nextSettings.logo?.trim() || defaultBrandingSettings.logo,
    logoAlt: nextSettings.logoAlt?.trim() || defaultBrandingSettings.logoAlt,
    heroImage: nextSettings.heroImage?.trim() || defaultBrandingSettings.heroImage,
    heroImageAlt: nextSettings.heroImageAlt?.trim() || defaultBrandingSettings.heroImageAlt,
  };
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const settings = await prisma.sitePage.findUnique({
      where: { slug: BRANDING_SETTINGS_SLUG },
      select: { content: true },
    });

    if (!settings) {
      return defaultBrandingSettings;
    }

    const content = settings.content;
    const parsed = JSON.parse(content) as Partial<BrandingSettings>;

    return normalizeBrandingSettings(parsed);
  } catch {
    return defaultBrandingSettings;
  }
}

export async function saveBrandingSettings(nextSettings: BrandingSettings): Promise<BrandingSettings> {
  const normalized = normalizeBrandingSettings(nextSettings);

  await prisma.sitePage.upsert({
    where: { slug: BRANDING_SETTINGS_SLUG },
    update: {
      content: JSON.stringify(normalized),
      lastUpdatedAt: new Date(),
    },
    create: {
      slug: BRANDING_SETTINGS_SLUG,
      title: 'Branding Settings',
      content: JSON.stringify(normalized),
      lastUpdatedAt: new Date(),
    },
  });

  return normalized;
}
