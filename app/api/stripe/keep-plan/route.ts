import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import {
  cancelStripeSubscriptionSchedule,
  getStripePriceId,
  getStripeSubscription,
  getStripeSubscriptionScheduleId,
  isBillingPlanId,
  setStripeSubscriptionCancelAtPeriodEnd,
  updateStripeSubscriptionPlan,
} from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please log in to manage your subscription.' }, { status: 401 });
    }

    await ensureUserPlanValidity(session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        plan: true,
        scheduledPlan: true,
        planChangeAt: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!user.scheduledPlan || !user.planChangeAt) {
      return NextResponse.json({ error: 'No scheduled downgrade found for this account.' }, { status: 400 });
    }

    if (!isBillingPlanId(user.plan)) {
      return NextResponse.json({ error: 'Only paid plans can keep their current subscription.' }, { status: 400 });
    }

    if (!user.stripeSubscriptionId) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          scheduledPlan: null,
          planChangeAt: null,
        },
      });

      return NextResponse.json({ success: true, mode: 'cleared_without_subscription' });
    }

    let subscription = await getStripeSubscription(user.stripeSubscriptionId);

    if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
      return NextResponse.json(
        { error: 'This subscription has already ended and cannot keep the current plan.' },
        { status: 400 }
      );
    }

    if (subscription.cancel_at_period_end) {
      subscription = await setStripeSubscriptionCancelAtPeriodEnd({
        subscriptionId: user.stripeSubscriptionId,
        cancelAtPeriodEnd: false,
      });
    }

    const scheduleId = getStripeSubscriptionScheduleId(subscription);

    if (scheduleId) {
      await cancelStripeSubscriptionSchedule(scheduleId);
      subscription = await getStripeSubscription(user.stripeSubscriptionId);
    }

    const currentPriceId = subscription.items?.data?.[0]?.price?.id ?? null;
    const targetPriceId = getStripePriceId(user.plan);

    if (currentPriceId !== targetPriceId) {
      subscription = await updateStripeSubscriptionPlan({
        subscriptionId: user.stripeSubscriptionId,
        priceId: targetPriceId,
        prorationBehavior: 'none',
      });
    }

    const periodEnd =
      subscription.items?.data?.[0]?.current_period_end ??
      subscription.current_period_end ??
      null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        scheduledPlan: null,
        planChangeAt: null,
        stripePriceId: targetPriceId,
        subscriptionStatus: subscription.status ?? 'active',
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        planExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });

    return NextResponse.json({ success: true, mode: 'kept_current_plan' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not keep the current plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
