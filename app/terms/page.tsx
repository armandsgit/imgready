import type { Metadata } from 'next';
import SitePageView from '@/components/SitePageView';

export const metadata: Metadata = {
  title: 'Terms of Service — ImgReady',
};

export default function TermsPage() {
  return <SitePageView slug="terms" />;
}
