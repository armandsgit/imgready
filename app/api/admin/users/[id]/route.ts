import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { isAdminEmail, isProtectedAdmin } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

interface UpdateUserBody {
  credits?: number;
  emailVerified?: boolean;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    if (!params?.id) {
      return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateUserBody;
    const credits =
      typeof body.credits === 'number' && Number.isFinite(body.credits)
        ? Math.max(0, Math.trunc(body.credits))
        : null;
    const emailVerified = typeof body.emailVerified === 'boolean' ? body.emailVerified : null;

    if (credits === null || emailVerified === null) {
      return NextResponse.json({ error: 'Invalid user update payload.' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: {
        id: params.id,
      },
      data: {
        credits,
        emailVerified,
      },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        credits: true,
        emailVerified: true,
        subscriptionStatus: true,
        cancelAtPeriodEnd: true,
        planExpiresAt: true,
        processedCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      user: {
        ...user,
        planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found. Please refresh and try again.' }, { status: 404 });
    }

    const safeMessage =
      error instanceof Error && error.message && error.message !== '1 error'
        ? error.message
        : 'Could not save changes. Please try again.';

    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    if (!params?.id) {
      return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: params.id,
      },
      select: {
        email: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found. Please refresh and try again.' }, { status: 404 });
    }

    if (isProtectedAdmin(targetUser.email)) {
      return NextResponse.json({ error: 'Protected admin user cannot be deleted.' }, { status: 400 });
    }

    await prisma.user.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found. Please refresh and try again.' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Could not delete user. Please try again.' }, { status: 500 });
  }
}
