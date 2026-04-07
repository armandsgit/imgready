import { prisma } from '@/lib/prisma';
import { getBillingCredits } from '@/lib/stripe';

export async function ensureUserPlanValidity(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      credits: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
      subscriptionStatus: true,
      cancelAtPeriodEnd: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  });

  if (!user) {
    return null;
  }

  const isExpired =
    user.plan !== 'free' &&
    Boolean(user.planExpiresAt && user.planExpiresAt.getTime() <= Date.now());

  if (!isExpired) {
    return user;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      plan: 'free',
      credits: getBillingCredits('free'),
      scheduledPlan: null,
      planChangeAt: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      subscriptionStatus: 'expired',
      cancelAtPeriodEnd: false,
      planStartedAt: null,
      planExpiresAt: null,
    },
    select: {
      id: true,
      plan: true,
      scheduledPlan: true,
      planChangeAt: true,
      credits: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
      subscriptionStatus: true,
      cancelAtPeriodEnd: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  });
}
