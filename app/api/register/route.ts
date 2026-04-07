import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isAdminEmail } from '@/lib/admin';
import { issueVerificationToken } from '@/lib/emailVerification';
import { getPlanCredits, isPlanId } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import {
  generateUniqueReferralCode,
  getReferralCodeFromCookieHeader,
  resolveReferrerFromCode,
} from '@/lib/referrals';

interface RegisterBody {
  email?: string;
  password?: string;
  plan?: string;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterBody;
    const email = body.email?.trim().toLowerCase();
    const password = body.password?.trim();
    const selectedPlan = (body.plan ?? 'free').trim().toLowerCase();
    const provisionedPlan = 'free';
    const referralCode = getReferralCodeFromCookieHeader(request.headers.get('cookie'));
    const referrer = await resolveReferrerFromCode(referralCode);
    const referrerId = referrer && referrer.email !== email ? referrer.id : null;
    console.log('[referral] register attempt', {
      email,
      referralCode: referralCode || null,
      referrerId,
    });

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (!isPlanId(selectedPlan)) {
      return NextResponse.json({ error: 'Please choose a valid subscription plan.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        const baseUrl = new URL(request.url).origin;
        const emailResult = await issueVerificationToken(existingUser.id, email, baseUrl);

        return NextResponse.json(
          {
            success: true,
            verificationSent: true,
            previewUrl: emailResult.previewUrl,
            deliveryMode: emailResult.deliveryMode,
          },
          { status: 200 }
        );
      }

      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: isAdminEmail(email) ? 'admin' : 'user',
        emailVerified: false,
        referralCode: await generateUniqueReferralCode(),
        ...(referrerId ? { referredById: referrerId } : {}),
        // New accounts always start on Free. Paid plans are only granted after Stripe confirmation.
        plan: provisionedPlan,
        credits: getPlanCredits(provisionedPlan),
      },
      select: {
        id: true,
      },
    });

    const baseUrl = new URL(request.url).origin;
    const emailResult = await issueVerificationToken(user.id, email, baseUrl);

    return NextResponse.json(
      {
        success: true,
        verificationSent: true,
        previewUrl: emailResult.previewUrl,
        deliveryMode: emailResult.deliveryMode,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
