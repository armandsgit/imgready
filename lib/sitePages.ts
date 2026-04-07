import { prisma } from '@/lib/prisma';

export const SITE_PAGE_SLUGS = ['terms', 'privacy', 'refund', 'contact'] as const;
export type SitePageSlug = (typeof SITE_PAGE_SLUGS)[number];

const INITIAL_LAST_UPDATED_AT = new Date('2026-04-01T00:00:00.000Z');

const DEFAULT_SITE_PAGES: Record<
  SitePageSlug,
  {
    title: string;
    content: string;
  }
> = {
  terms: {
    title: 'Terms of Service',
    content: `## Overview
ImgReady provides tools for processing product images, including background removal, centering, resizing, and optimization.

## Use of Service
Users must use ImgReady lawfully and must not upload illegal, harmful, or abusive content.

## Accounts
Users are responsible for their accounts and login credentials.

## Credits System
- Remove background = 1 credit per image
- Optimize only = 0.5 credit per image
- Credits are non-transferable
- Credits do not expire unless stated otherwise in future updates

## Subscriptions
- billed monthly
- renew automatically unless canceled
- cancellation takes effect at the end of the billing period

## Payments
Payments are processed through Stripe or another payment provider. ImgReady does not store card details.

## Service Availability
ImgReady aims to provide reliable access but does not guarantee uninterrupted availability.

## Limitation of Liability
ImgReady is not liable for indirect losses, business losses, or uploaded content issues.

## Contact
support@imgready.io`,
  },
  privacy: {
    title: 'Privacy Policy',
    content: `## Information We Collect
- email address
- account data
- usage data
- uploaded images for processing

## Uploaded Images
Uploaded images are processed automatically and are not used for AI training.

## How We Use Data
- provide the service
- manage billing
- track usage
- improve performance

## Payments
Payments are handled by Stripe or another third-party provider.

## Cookies
Cookies may be used for session/authentication purposes.

## GDPR
Users may request access to or deletion of their data by contacting support@imgready.io

## Security
Reasonable measures are taken to protect user data.

## Contact
support@imgready.io`,
  },
  refund: {
    title: 'Refund Policy',
    content: `## Subscriptions
Subscriptions can be canceled anytime and remain active until the billing period ends.

## Refunds
No refunds are provided for partial subscription periods unless required by law or in cases of billing errors.

## Credits
Purchased credits are non-refundable and non-transferable.

## Support
Refund requests or billing issues can be sent to support@imgready.io`,
  },
  contact: {
    title: 'Contact & Support',
    content: `Need help or have questions?

## Support email
support@imgready.io

## Typical topics
- billing
- credits
- image processing issues

## Response time
Usually within 24–48 hours`,
  },
};

export async function ensureSitePages() {
  await Promise.all(
    SITE_PAGE_SLUGS.map((slug) =>
      prisma.sitePage.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          title: DEFAULT_SITE_PAGES[slug].title,
          content: DEFAULT_SITE_PAGES[slug].content,
          lastUpdatedAt: INITIAL_LAST_UPDATED_AT,
        },
      })
    )
  );
}

export async function getAllSitePages() {
  await ensureSitePages();

  const pages = await prisma.sitePage.findMany({
    where: {
      slug: {
        in: [...SITE_PAGE_SLUGS],
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return SITE_PAGE_SLUGS.map((slug) => {
    const page = pages.find((entry) => entry.slug === slug)!;

    return {
      ...page,
      slug,
    };
  });
}

export async function getSitePage(slug: SitePageSlug) {
  await ensureSitePages();

  const page = await prisma.sitePage.findUnique({
    where: { slug },
  });

  if (!page) {
    return null;
  }

  return {
    ...page,
    slug,
  };
}

export function isSitePageSlug(value: string): value is SitePageSlug {
  return SITE_PAGE_SLUGS.includes(value as SitePageSlug);
}

export function getDefaultSitePage(slug: SitePageSlug) {
  return {
    slug,
    title: DEFAULT_SITE_PAGES[slug].title,
    content: DEFAULT_SITE_PAGES[slug].content,
    lastUpdatedAt: INITIAL_LAST_UPDATED_AT,
  };
}
