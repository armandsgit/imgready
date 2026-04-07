import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getPlanCredits, isPlanId } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import {
  REFERRAL_COOKIE_NAME,
  generateUniqueReferralCode,
  normalizeReferralCode,
  resolveReferrerFromCode,
} from '@/lib/referrals';

interface PostAuthRedirectPageProps {
  searchParams?: {
    plan?: string;
  };
}

export default async function PostAuthRedirectPage({ searchParams }: PostAuthRedirectPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect('/login');
  }

  const email = session.user.email.trim().toLowerCase();
  const selectedPlan = searchParams?.plan?.trim().toLowerCase();
  const nextPlan = selectedPlan && isPlanId(selectedPlan) ? selectedPlan : 'free';
  const provisionedPlan = 'free';
  const referralCode = normalizeReferralCode(cookies().get(REFERRAL_COOKIE_NAME)?.value);
  const referrer = await resolveReferrerFromCode(referralCode);
  const referrerId = referrer && referrer.email !== email ? referrer.id : null;
  console.log('[referral] post-auth provisioning', {
    email,
    referralCode: referralCode || null,
    referrerId,
  });

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      emailVerified: true,
      plan: true,
    },
  });

  if (!existingUser) {
    const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);

    await prisma.user.create({
      data: {
        email,
        password: randomPassword,
        emailVerified: true,
        referralCode: await generateUniqueReferralCode(),
        ...(referrerId ? { referredById: referrerId } : {}),
        plan: provisionedPlan,
        credits: getPlanCredits(provisionedPlan),
      },
    });
  } else if (!existingUser.emailVerified) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerified: true,
      },
    });
  }

  if (isAdminEmail(session.user.email)) {
    redirect('/admin');
  }

  if (nextPlan !== 'free') {
    redirect('/pricing');
  }

  redirect('/remove-background');
}
