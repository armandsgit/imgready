import type { Metadata } from 'next';
import SitePageView from '@/components/SitePageView';

export const metadata: Metadata = {
  title: 'Privacy Policy — ImgReady',
};

export default function PrivacyPage() {
  return <SitePageView slug="privacy" />;
}
