import type { Metadata } from 'next';
import PricingPlans from '@/components/PricingPlans';

export const metadata: Metadata = {
  title: 'Pricing — ImgReady',
  description: 'Simple ImgReady pricing for AI product image background removal and listing-ready image processing.',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--bg-secondary)] px-6 py-16 md:py-20">
      <div className="relative">
        <PricingPlans />
      </div>
    </main>
  );
}
