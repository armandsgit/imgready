import './globals.css';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import Navbar from '@/components/Navbar';
import CookieBanner from '@/components/CookieBanner';
import ReferralCapture from '@/components/ReferralCapture';
import SiteFooter from '@/components/SiteFooter';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { getBrandingSettings } from '@/lib/branding';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.imgready.io'),
  title: {
    default: 'ImgReady',
    template: '%s | ImgReady',
  },
  description: 'Create clean, listing-ready product images with white backgrounds in seconds.',
  applicationName: 'ImgReady',
  keywords: [
    'product image background remover',
    'AI product image tool',
    'white background product photos',
    'Amazon listing images',
    'product photo editor',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.imgready.io',
    siteName: 'ImgReady',
    title: 'ImgReady — Clean Product Images for E-commerce',
    description: 'Create clean, listing-ready product images with white backgrounds in seconds.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ImgReady — Clean Product Images for E-commerce',
    description: 'Create clean, listing-ready product images with white backgrounds in seconds.',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const isMaintenancePage = requestHeaders.get('x-imgready-maintenance-page') === '1';

  if (isMaintenancePage) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  const branding = await getBrandingSettings();
  const session = await getServerSession(authOptions);
  let initialAccount: { email: string; credits: number; plan: string; image?: string | null } | null = null;

  if (session?.user?.id) {
    await ensureUserPlanValidity(session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        credits: true,
        plan: true,
      },
    });

    if (user) {
      initialAccount = {
        email: user.email,
        credits: user.credits,
        plan: user.plan,
        image: session.user.image ?? null,
      };
    }
  }

  return (
    <html lang="en">
      <body>
        <ReferralCapture />
        <Navbar initialBranding={branding} initialAccount={initialAccount} />
        {children}
        <SiteFooter />
        <CookieBanner />
      </body>
    </html>
  );
}
