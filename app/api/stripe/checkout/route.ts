import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { createBillingPortalSession, createCheckoutSession, createStripeCustomer, isBillingPlanId } from '@/lib/stripe';

export const runtime = 'nodejs';

interface CheckoutBody {
  plan?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please log in to upgrade your plan.' }, { status: 401 });
    }

    await ensureUserPlanValidity(session.user.id);

    const body = (await request.json()) as CheckoutBody;
    const requestedPlan = body.plan?.trim().toLowerCase() ?? '';

    if (!isBillingPlanId(requestedPlan)) {
      return NextResponse.json({ error: 'Please choose a valid paid plan.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

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

    const origin = new URL(request.url).origin;

    if (user.stripeSubscriptionId && stripeCustomerId) {
      const portalSession = await createBillingPortalSession({
        customerId: stripeCustomerId,
        origin,
      });

      return NextResponse.json({
        url: portalSession.url,
        mode: 'portal',
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start Stripe Checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
