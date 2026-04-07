import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import HomePageClient from '@/components/HomePageClient';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Remove Background — ImgReady',
};

export default async function RemoveBackgroundPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  await ensureUserPlanValidity(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      plan: true,
      credits: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      cancelAtPeriodEnd: true,
      planExpiresAt: true,
      scheduledPlan: true,
      planChangeAt: true,
    },
  });

  return (
    <HomePageClient
      initialAccount={
        user
          ? {
              ...user,
              planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
              planChangeAt: user.planChangeAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
