import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const REFERRAL_COOKIE_NAME = 'imgready_ref';
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_REWARD_CREDITS = 100;

export function normalizeReferralCode(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

export function getReferralCodeFromCookieHeader(cookieHeader: string | null | undefined) {
  if (!cookieHeader) {
    return '';
  }

  const referralCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL_COOKIE_NAME}=`));

  if (!referralCookie) {
    return '';
  }

  const [, rawValue = ''] = referralCookie.split('=');
  return normalizeReferralCode(decodeURIComponent(rawValue));
}

export async function generateUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomBytes(REFERRAL_CODE_LENGTH)
      .toString('base64url')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, REFERRAL_CODE_LENGTH);

    if (!code) {
      continue;
    }

    const existingUser = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });

    if (!existingUser) {
      return code;
    }
  }

  throw new Error('Could not generate a unique referral code.');
}

export async function resolveReferrerIdFromCode(referralCode: string | null | undefined) {
  const normalizedCode = normalizeReferralCode(referralCode);

  if (!normalizedCode) {
    return null;
  }

  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalizedCode },
    select: { id: true },
  });

  return referrer?.id ?? null;
}

export async function resolveReferrerFromCode(referralCode: string | null | undefined) {
  const normalizedCode = normalizeReferralCode(referralCode);

  if (!normalizedCode) {
    return null;
  }

  return prisma.user.findUnique({
    where: { referralCode: normalizedCode },
    select: {
      id: true,
      email: true,
    },
  });
}

export async function ensureUserReferralCode(userId: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralCode: true,
    },
  });

  if (!existingUser) {
    return null;
  }

  if (existingUser.referralCode) {
    return existingUser.referralCode;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const referralCode = await generateUniqueReferralCode();

    try {
      const updateResult = await prisma.user.updateMany({
        where: {
          id: userId,
          referralCode: null,
        },
        data: {
          referralCode,
        },
      });

      if (updateResult.count > 0) {
        return referralCode;
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });

      if (currentUser?.referralCode) {
        return currentUser.referralCode;
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2025')
      ) {
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { referralCode: true },
        });

        if (currentUser?.referralCode) {
          return currentUser.referralCode;
        }

        continue;
      }

      throw error;
    }
  }

  throw new Error('Could not assign a referral code.');
}

export function buildReferralLink(origin: string, referralCode: string) {
  const url = new URL(origin);
  url.searchParams.set('ref', referralCode);
  return url.toString();
}

export async function awardReferralReward(params: {
  referredUserId: string;
  sourceType: string;
  sourceId: string;
}) {
  console.log('[referral] evaluating reward', {
    referredUserId: params.referredUserId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
  });

  const referredUser = await prisma.user.findUnique({
    where: { id: params.referredUserId },
    select: {
      id: true,
      referredById: true,
      referralRewardGrantedAt: true,
    },
  });

  if (
    !referredUser?.referredById ||
    referredUser.referredById === referredUser.id ||
    referredUser.referralRewardGrantedAt
  ) {
    console.log('[referral] reward skipped', {
      referredUserId: params.referredUserId,
      hasReferrer: Boolean(referredUser?.referredById),
      selfReferral: Boolean(referredUser?.referredById && referredUser.referredById === referredUser.id),
      alreadyGranted: Boolean(referredUser?.referralRewardGrantedAt),
    });
    return;
  }

  const rewardGrantResult = await prisma.user.updateMany({
    where: {
      id: referredUser.id,
      referralRewardGrantedAt: null,
    },
    data: {
      referralRewardGrantedAt: new Date(),
    },
  });

  if (rewardGrantResult.count === 0) {
    console.log('[referral] reward skipped because grant flag was already set', {
      referredUserId: params.referredUserId,
    });
    return;
  }

  await prisma.$transaction([
    prisma.affiliateCommission.create({
      data: {
        referrerId: referredUser.referredById,
        referredUserId: referredUser.id,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        amountCents: REFERRAL_REWARD_CREDITS,
      },
    }),
    prisma.user.update({
      where: { id: referredUser.referredById },
      data: {
        credits: {
          increment: REFERRAL_REWARD_CREDITS,
        },
        affiliateBalance: {
          increment: REFERRAL_REWARD_CREDITS,
        },
      },
    }),
  ]);

  console.log('[referral] reward granted', {
    referredUserId: referredUser.id,
    referrerId: referredUser.referredById,
    rewardCredits: REFERRAL_REWARD_CREDITS,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
  });
}
