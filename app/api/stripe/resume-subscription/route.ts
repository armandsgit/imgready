import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { getStripeSubscription, resumeStripeSubscription } from '@/lib/stripe';

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
        stripeSubscriptionId: true,
        cancelAtPeriodEnd: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No Stripe subscription found for this account.' }, { status: 400 });
    }

    const currentSubscription = await getStripeSubscription(user.stripeSubscriptionId);

    if (currentSubscription.status === 'canceled' || currentSubscription.status === 'incomplete_expired') {
      return NextResponse.json({ error: 'This subscription has already ended and cannot be resumed.' }, { status: 400 });
    }

    if (!currentSubscription.cancel_at_period_end && !user.cancelAtPeriodEnd) {
      return NextResponse.json({ success: true, mode: 'active' });
    }

    const updatedSubscription = await resumeStripeSubscription(user.stripeSubscriptionId);
    const periodEnd =
      updatedSubscription.items?.data?.[0]?.current_period_end ??
      updatedSubscription.current_period_end ??
      null;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: updatedSubscription.status ?? 'active',
        cancelAtPeriodEnd: false,
        planExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });

    return NextResponse.json({ success: true, mode: 'resumed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not resume subscription.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
