import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import {
  createCreditsCheckoutSession,
  createStripeCustomer,
  isCreditPackage,
} from '@/lib/stripe';

export const runtime = 'nodejs';

interface BuyCreditsBody {
  package?: number;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please log in to buy credits.' }, { status: 401 });
    }

    await ensureUserPlanValidity(session.user.id);

    const body = (await request.json()) as BuyCreditsBody;
    const creditPackage = Number(body.package);

    if (!Number.isFinite(creditPackage) || !isCreditPackage(creditPackage)) {
      return NextResponse.json({ error: 'Please choose a valid credit package.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
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
    const checkoutSession = await createCreditsCheckoutSession({
      customerId: stripeCustomerId,
      userId: user.id,
      creditPackage,
      origin,
    });

    if (!checkoutSession.url) {
      return NextResponse.json({ error: 'Stripe checkout session did not return a redirect URL.' }, { status: 500 });
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start Stripe checkout for credits.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
