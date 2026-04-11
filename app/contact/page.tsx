import type { Metadata } from 'next';
import SitePageView from '@/components/SitePageView';

export const metadata: Metadata = {
  title: 'Contact & Support — ImgReady',
  description: 'Contact ImgReady support for help with product image processing, billing, and account questions.',
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return <SitePageView slug="contact" />;
}
