import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { defaultBrandingSettings, type BrandingSettings } from '@/lib/appConfig';

const brandingFilePath = path.join(process.cwd(), 'data', 'branding.json');

export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const content = await readFile(brandingFilePath, 'utf8');
    const parsed = JSON.parse(content) as Partial<BrandingSettings>;

    return {
      logo: parsed.logo?.trim() || defaultBrandingSettings.logo,
      logoAlt: parsed.logoAlt?.trim() || defaultBrandingSettings.logoAlt,
      heroImage: parsed.heroImage?.trim() || defaultBrandingSettings.heroImage,
      heroImageAlt: parsed.heroImageAlt?.trim() || defaultBrandingSettings.heroImageAlt,
    };
  } catch {
    return defaultBrandingSettings;
  }
}

export async function saveBrandingSettings(nextSettings: BrandingSettings): Promise<BrandingSettings> {
  const normalized: BrandingSettings = {
    logo: nextSettings.logo.trim() || defaultBrandingSettings.logo,
    logoAlt: nextSettings.logoAlt.trim() || defaultBrandingSettings.logoAlt,
    heroImage: nextSettings.heroImage.trim() || defaultBrandingSettings.heroImage,
    heroImageAlt: nextSettings.heroImageAlt.trim() || defaultBrandingSettings.heroImageAlt,
  };

  await mkdir(path.dirname(brandingFilePath), { recursive: true });
  await writeFile(brandingFilePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

  return normalized;
}
