import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { getRenewedCreditTotal } from '@/lib/creditBalances';
import { prisma } from '@/lib/prisma';
import {
  createCheckoutSession,
  getStripePriceId,
  isBillingPlanId,
  isBillingUpgrade,
  createStripeCustomer,
  getStripeSubscription,
  updateStripeSubscriptionPlan,
} from '@/lib/stripe';

export const runtime = 'nodejs';

interface ChangePlanBody {
  plan?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please log in to change your plan.' }, { status: 401 });
    }

    await ensureUserPlanValidity(session.user.id);

    const body = (await request.json()) as ChangePlanBody;
    const requestedPlan = body.plan?.trim().toLowerCase() ?? '';

    if (!isBillingPlanId(requestedPlan)) {
      return NextResponse.json({ error: 'Please choose a valid paid plan.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        plan: true,
        credits: true,
        createdAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        planStartedAt: true,
        planExpiresAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active Stripe subscription found for this account.' }, { status: 400 });
    }

    if (user.plan === requestedPlan) {
      return NextResponse.json({ error: `You are already on the ${requestedPlan} plan.` }, { status: 400 });
    }

    const subscription = await getStripeSubscription(user.stripeSubscriptionId);
    const updatableStatuses = new Set(['active', 'trialing']);
    const origin = new URL(request.url).origin;

    if (!updatableStatuses.has(subscription.status ?? '')) {
      let stripeCustomerId = user.stripeCustomerId;

      if (!stripeCustomerId) {
        const customer = await createStripeCustomer(user.email, user.id);
        stripeCustomerId = customer.id;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeCustomerId,
          },
        });
      }

      const checkoutSession = await createCheckoutSession({
        customerId: stripeCustomerId,
        userId: user.id,
        plan: requestedPlan,
        origin,
      });

      if (!checkoutSession.url) {
        return NextResponse.json({ error: 'Stripe checkout session did not return a redirect URL.' }, { status: 500 });
      }

      return NextResponse.json({ url: checkoutSession.url, mode: 'checkout' });
    }

    if (!isBillingPlanId(user.plan)) {
      return NextResponse.json({ error: 'Your current paid plan could not be resolved.' }, { status: 400 });
    }

    const isUpgrade = isBillingUpgrade(user.plan, requestedPlan);

    const updatedSubscription = await updateStripeSubscriptionPlan({
      subscriptionId: user.stripeSubscriptionId,
      priceId: getStripePriceId(requestedPlan),
      prorationBehavior: isUpgrade ? 'always_invoice' : 'none',
      paymentBehavior: isUpgrade ? 'error_if_incomplete' : undefined,
    });

    const periodStart =
      updatedSubscription.items?.data?.[0]?.current_period_start ??
      updatedSubscription.current_period_start ??
      updatedSubscription.start_date ??
      null;
    const periodEnd =
      updatedSubscription.items?.data?.[0]?.current_period_end ??
      updatedSubscription.current_period_end ??
      null;
    const priceId = updatedSubscription.items?.data?.[0]?.price?.id ?? getStripePriceId(requestedPlan);
    const renewedCredits = isUpgrade
      ? await getRenewedCreditTotal({
          user,
          nextPlan: requestedPlan,
        })
      : user.credits;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: isUpgrade ? requestedPlan : user.plan,
        scheduledPlan: isUpgrade ? null : requestedPlan,
        planChangeAt: isUpgrade
          ? null
          : periodEnd
            ? new Date(periodEnd * 1000)
            : user.planExpiresAt,
        credits: renewedCredits,
        stripeSubscriptionId: updatedSubscription.id,
        stripePriceId: priceId,
        subscriptionStatus: updatedSubscription.status ?? 'active',
        cancelAtPeriodEnd: Boolean(updatedSubscription.cancel_at_period_end),
        planStartedAt: periodStart ? new Date(periodStart * 1000) : user.planStartedAt,
        planExpiresAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    });

    return NextResponse.json({ success: true, mode: isUpgrade ? 'updated' : 'scheduled_downgrade' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not change Stripe plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
