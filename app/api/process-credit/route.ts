import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getProcessingCreditCost } from '@/lib/credits';
import { hasUnlimitedCredits } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import type { ProcessingMode } from '@/types';

interface ProcessCreditBody {
  mode?: ProcessingMode;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'You must be logged in to process images.' }, { status: 401 });
    }

    const body = (await request.json()) as ProcessCreditBody;
    const mode: ProcessingMode = body.mode === 'optimize-only' ? 'optimize-only' : 'remove-background';
    const cost = getProcessingCreditCost(mode);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Your account could not be found.' }, { status: 401 });
    }

    if (hasUnlimitedCredits(user.credits)) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          processedCount: {
            increment: 1,
          },
        },
      });

      return NextResponse.json({ credits: user.credits });
    }

    if (user.credits < cost) {
      return NextResponse.json({ error: 'You do not have enough credits left for this processing mode.' }, { status: 402 });
    }

    const updated = await prisma.user.updateMany({
      where: {
        id: session.user.id,
        credits: {
          gte: cost,
        },
      },
      data: {
        credits: {
          decrement: cost,
        },
        processedCount: {
          increment: 1,
        },
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'No credits left after processing. Please refresh and try again.' }, { status: 409 });
    }

    const refreshedUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { credits: true },
    });

    return NextResponse.json({ credits: refreshedUser?.credits ?? Math.max(user.credits - cost, 0) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
