import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { getStripeSubscriptionCancellationUnix, setStripeSubscriptionCancelAtPeriodEnd } from '@/lib/stripe';

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
        cancelAtPeriodEnd: true,
        planExpiresAt: true,
        scheduledPlan: true,
        planChangeAt: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (user.plan === 'free') {
      return NextResponse.json({ success: true, mode: 'free' });
    }

    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active Stripe subscription found for this account.' }, { status: 400 });
    }

    if (user.cancelAtPeriodEnd) {
      const planChangeAt = user.planChangeAt ?? user.planExpiresAt;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'cancelling',
          scheduledPlan: 'free',
          planChangeAt,
        },
      });

      return NextResponse.json({ success: true, mode: 'cancel_at_period_end' });
    }

    const updatedSubscription = await setStripeSubscriptionCancelAtPeriodEnd({
      subscriptionId: user.stripeSubscriptionId,
      cancelAtPeriodEnd: true,
    });

    const periodEnd =
      getStripeSubscriptionCancellationUnix(updatedSubscription) ??
      updatedSubscription.items?.data?.[0]?.current_period_end ??
      updatedSubscription.current_period_end ??
      null;
    const planChangeAt = periodEnd ? new Date(periodEnd * 1000) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'cancelling',
        cancelAtPeriodEnd: Boolean(updatedSubscription.cancel_at_period_end || updatedSubscription.cancel_at),
        planExpiresAt: planChangeAt,
        scheduledPlan: 'free',
        planChangeAt,
      },
    });

    return NextResponse.json({ success: true, mode: 'cancel_at_period_end' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not downgrade to Free.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
