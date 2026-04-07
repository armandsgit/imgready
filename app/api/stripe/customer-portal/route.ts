import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createBillingPortalSession } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Please log in to manage billing.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'Billing portal is not available for this account yet.' }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const portalSession = await createBillingPortalSession({
      customerId: user.stripeCustomerId,
      origin,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not open billing portal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
