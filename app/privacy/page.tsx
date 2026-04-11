import type { Metadata } from 'next';
import SitePageView from '@/components/SitePageView';

export const metadata: Metadata = {
  title: 'Privacy Policy — ImgReady',
  description: 'Read how ImgReady handles privacy, account data, and product image processing data.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return <SitePageView slug="privacy" />;
}
