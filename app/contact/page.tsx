import type { Metadata } from 'next';
import SitePageView from '@/components/SitePageView';

export const metadata: Metadata = {
  title: 'Contact & Support — ImgReady',
};

export default function ContactPage() {
  return <SitePageView slug="contact" />;
}
