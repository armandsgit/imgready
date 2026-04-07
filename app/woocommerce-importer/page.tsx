import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import WooCommerceImporterClient from '@/components/WooCommerceImporterClient';
import { authOptions } from '@/lib/auth';

export default async function WooCommerceImporterPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  return <WooCommerceImporterClient />;
}
