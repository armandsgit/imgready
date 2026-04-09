import { NextResponse } from 'next/server';
import { checkAuthRateLimit, getRequestIp } from '@/lib/authRateLimit';
import { issueVerificationToken } from '@/lib/emailVerification';
import { prisma } from '@/lib/prisma';

interface ResendVerificationBody {
  email?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ResendVerificationBody;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Please enter your email address.' }, { status: 400 });
    }

    const rateLimit = checkAuthRateLimit('resend-verification', `${email}:${getRequestIp(request)}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many verification email requests. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (user && !user.emailVerified) {
      const baseUrl = new URL(request.url).origin;
      const emailResult = await issueVerificationToken(user.id, user.email, baseUrl);

      return NextResponse.json({
        success: true,
        previewUrl: emailResult.previewUrl,
        deliveryMode: emailResult.deliveryMode,
        message: 'Verification email sent.',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'If an unverified account exists, a new verification email has been sent.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
