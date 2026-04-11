import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.imgready.io';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/account',
        '/api',
        '/login',
        '/post-auth',
        '/register',
        '/remove-background',
        '/verify-email',
        '/woocommerce-importer',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
