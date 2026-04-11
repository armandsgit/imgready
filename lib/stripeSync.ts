import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRenewedCreditTotal, isSameBillingCycle } from '@/lib/creditBalances';
import { awardReferralReward } from '@/lib/referrals';
import {
  getCheckoutSession,
  getPlanFromStripePriceId,
  getStripeSubscription,
  getStripeSubscriptionsForCustomer,
  isCreditPackage,
  resolvePlanFromCheckoutSession,
  resolveSubscriptionPeriodStart,
  resolveSubscriptionPeriodEnd,
  resolveSubscriptionPriceId,
  resolveSubscriptionFromCheckoutSession,
} from '@/lib/stripe';

async function syncStripeSubscriptionRecordForUser(subscription: Awaited<ReturnType<typeof getStripeSubscription>>, userId: string) {
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const plan = getPlanFromStripePriceId(priceId);
  const subscriptionStatus = subscription.status ?? 'active';
  const nextSubscriptionStatus = subscription.cancel_at_period_end ? 'cancelling' : subscriptionStatus;

  if (!plan || !subscription.customer) {
    throw new Error('Stripe subscription does not match a configured ImgReady plan.');
  }

  if (!['active', 'trialing'].includes(subscriptionStatus)) {
    throw new Error('Stripe subscription is not active yet.');
  }

  const periodStart =
    subscription.items?.data?.[0]?.current_period_start ??
    subscription.current_period_start ??
    subscription.start_date ??
    null;
  const periodEnd =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end ??
    null;
  const nextPlanStartedAt = periodStart ? new Date(periodStart * 1000) : null;
  const nextPlanExpiresAt = periodEnd ? new Date(periodEnd * 1000) : null;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      credits: true,
      createdAt: true,
      planStartedAt: true,
      planExpiresAt: true,
      stripeSubscriptionId: true,
    },
  });

  if (!currentUser) {
    throw new Error('User not found.');
  }

  if (currentUser.stripeSubscriptionId && currentUser.stripeSubscriptionId !== subscription.id) {
    throw new Error('Stripe subscription does not belong to this account.');
  }

  const shouldResetCredits =
    currentUser.plan !== plan || !isSameBillingCycle(currentUser.planStartedAt, nextPlanStartedAt);
  const renewedCredits = shouldResetCredits
    ? await getRenewedCreditTotal({
        user: currentUser,
        nextPlan: plan,
      })
    : currentUser.credits;

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      scheduledPlan: null,
      planChangeAt: null,
      credits: renewedCredits,
      stripeCustomerId: subscription.customer,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: nextSubscriptionStatus,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      planStartedAt: nextPlanStartedAt,
      planExpiresAt: nextPlanExpiresAt,
    },
  });

  return { plan };
}

export async function syncStripeSubscriptionForUser(subscriptionId: string, userId: string) {
  const subscription = await getStripeSubscription(subscriptionId);
  return syncStripeSubscriptionRecordForUser(subscription, userId);
}

export async function syncLatestStripeSubscriptionForCustomer(customerId: string, userId: string) {
  const subscriptions = await getStripeSubscriptionsForCustomer(customerId);
  const candidates = (subscriptions.data ?? [])
    .filter((subscription) => ['active', 'trialing'].includes(subscription.status ?? 'active'))
    .sort((left, right) => {
      const leftTime = left.created ?? left.start_date ?? 0;
      const rightTime = right.created ?? right.start_date ?? 0;
      return rightTime - leftTime;
    });

  const subscription = candidates[0];

  if (!subscription) {
    throw new Error('No active Stripe subscription found for this customer.');
  }

  return syncStripeSubscriptionRecordForUser(subscription, userId);
}

export async function syncCheckoutSessionForUser(sessionId: string, userId: string) {
  const session = await getCheckoutSession(sessionId);

  if (!session.client_reference_id || session.client_reference_id !== userId) {
    throw new Error('This checkout session does not belong to the current user.');
  }

  const plan = resolvePlanFromCheckoutSession(session);
  const subscription = resolveSubscriptionFromCheckoutSession(session);

  if (!plan || !subscription?.id || !session.customer) {
    throw new Error('Stripe checkout has not produced an active subscription yet.');
  }

  if (session.status !== 'complete') {
    throw new Error('Stripe checkout is not complete yet.');
  }

  if (session.payment_status && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    throw new Error('Stripe payment is not completed yet.');
  }

  const subscriptionPriceId = resolveSubscriptionPriceId(subscription);
  let subscriptionPeriodStart = resolveSubscriptionPeriodStart(subscription);
  let subscriptionPeriodEnd = resolveSubscriptionPeriodEnd(subscription);

  if (!subscriptionPeriodStart || !subscriptionPeriodEnd) {
    const freshSubscription = await getStripeSubscription(subscription.id);
    subscriptionPeriodStart = freshSubscription.current_period_start ?? subscriptionPeriodStart ?? null;
    subscriptionPeriodEnd = freshSubscription.current_period_end ?? null;
  }

  const nextPlanStartedAt = subscriptionPeriodStart ? new Date(subscriptionPeriodStart * 1000) : null;
  const nextPlanExpiresAt = subscriptionPeriodEnd ? new Date(subscriptionPeriodEnd * 1000) : null;
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      plan: true,
      credits: true,
      createdAt: true,
      planStartedAt: true,
      planExpiresAt: true,
    },
  });

  if (!currentUser) {
    throw new Error('User not found.');
  }

  const shouldResetCredits =
    currentUser.plan !== plan || !isSameBillingCycle(currentUser.planStartedAt, nextPlanStartedAt);
  const renewedCredits = shouldResetCredits
    ? await getRenewedCreditTotal({
        user: currentUser,
        nextPlan: plan,
      })
    : currentUser.credits;

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      scheduledPlan: null,
      planChangeAt: null,
      credits: renewedCredits,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscriptionPriceId,
      subscriptionStatus: 'status' in subscription ? subscription.status ?? 'active' : 'active',
      cancelAtPeriodEnd: 'cancel_at_period_end' in subscription ? Boolean(subscription.cancel_at_period_end) : false,
      planStartedAt: nextPlanStartedAt,
      planExpiresAt: nextPlanExpiresAt,
    },
  });

  console.log('[referral] syncCheckoutSessionForUser completed', {
    sessionId,
    userId,
    plan,
  });

  try {
    await awardReferralReward({
      referredUserId: userId,
      sourceType: 'checkout_session_sync',
      sourceId: sessionId,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error;
    }
  }
}

export async function syncCreditTopUpSessionForUser(sessionId: string, userId: string) {
  const session = await getCheckoutSession(sessionId);

  if (!session.client_reference_id || session.client_reference_id !== userId) {
    throw new Error('This checkout session does not belong to the current user.');
  }

  if (session.mode !== 'payment') {
    throw new Error('This Stripe checkout session is not a credit purchase.');
  }

  if (session.status !== 'complete') {
    throw new Error('Stripe checkout is not complete yet.');
  }

  if (session.payment_status && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    throw new Error('Stripe payment is not completed yet.');
  }

  if (session.metadata?.purchaseType !== 'credit_topup') {
    throw new Error('This Stripe checkout session is not a credit top-up.');
  }

  const purchasedCredits = Number(session.metadata.credits);

  if (!isCreditPackage(purchasedCredits)) {
    throw new Error('This Stripe checkout session does not contain a valid credit package.');
  }

  try {
    await prisma.$transaction([
      prisma.processedStripeSession.create({
        data: {
          sessionId,
          kind: 'credit_topup',
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          credits: {
            increment: purchasedCredits,
          },
          ...(session.customer ? { stripeCustomerId: session.customer } : {}),
        },
      }),
      prisma.creditTopUp.create({
        data: {
          userId,
          sessionId,
          credits: purchasedCredits,
        },
      }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return;
    }

    throw error;
  }

  console.log('[referral] syncCreditTopUpSessionForUser completed', {
    sessionId,
    userId,
    purchasedCredits,
  });

  try {
    await awardReferralReward({
      referredUserId: userId,
      sourceType: 'credit_topup_sync',
      sourceId: sessionId,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
      throw error;
    }
  }
}
