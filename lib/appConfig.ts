export const appConfig = {
  branding: {
    logo: process.env.NEXT_PUBLIC_APP_LOGO || '/img/logomain.png',
    logoAlt: process.env.NEXT_PUBLIC_APP_LOGO_ALT || 'AI Tools',
    heroImage: process.env.NEXT_PUBLIC_HERO_IMAGE || '/img/pic.jpg',
    heroImageAlt: process.env.NEXT_PUBLIC_HERO_IMAGE_ALT || 'Product sample',
  },
} as const;

export interface BrandingSettings {
  logo: string;
  logoAlt: string;
  heroImage: string;
  heroImageAlt: string;
}

export const defaultBrandingSettings: BrandingSettings = {
  logo: appConfig.branding.logo,
  logoAlt: appConfig.branding.logoAlt,
  heroImage: appConfig.branding.heroImage,
  heroImageAlt: appConfig.branding.heroImageAlt,
};
