import type { Metadata } from 'next';
import SitePageView from '@/components/SitePageView';

export const metadata: Metadata = {
  title: 'Refund Policy — ImgReady',
  description: 'Read the ImgReady refund policy for subscriptions and extra credit purchases.',
  alternates: {
    canonical: '/refund',
  },
};

export default function RefundPage() {
  return <SitePageView slug="refund" />;
}
