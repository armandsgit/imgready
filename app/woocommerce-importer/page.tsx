import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import WooCommerceImporterClient from '@/components/WooCommerceImporterClient';
import { authOptions } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'WooCommerce Importer',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function WooCommerceImporterPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  return <WooCommerceImporterClient />;
}
