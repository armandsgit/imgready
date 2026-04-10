import { prisma } from '@/lib/prisma';
import { getPlanCredits, hasUnlimitedCredits, isPlanId, type PlanId, UNLIMITED_CREDITS } from '@/lib/plans';

interface CreditStateUser {
  id: string;
  plan: string;
  credits: number;
  planStartedAt: Date | null;
  planExpiresAt: Date | null;
  createdAt?: Date | null;
}

export interface CreditBreakdown {
  totalCredits: number;
  planCreditsRemaining: number;
  topUpCreditsRemaining: number;
  periodCreditsUsed: number;
  planAllowance: number;
}

function resolvePlan(plan: string): PlanId {
  return isPlanId(plan) ? plan : 'free';
}

function getPlanWindowStart(user: CreditStateUser) {
  return user.planStartedAt ?? user.createdAt ?? null;
}

export function isSameBillingCycle(currentStart: Date | null, nextStart: Date | null) {
  if (!currentStart || !nextStart) {
    return false;
  }

  return Math.abs(currentStart.getTime() - nextStart.getTime()) < 1000;
}

export async function getProcessedCreditsForPlanWindow(user: CreditStateUser) {
  const windowStart = getPlanWindowStart(user);

  if (!windowStart) {
    return 0;
  }

  const aggregate = await prisma.processingJob.aggregate({
    where: {
      userId: user.id,
      status: 'done',
      startedAt: {
        gte: windowStart,
        ...(user.planExpiresAt ? { lt: user.planExpiresAt } : {}),
      },
    },
    _sum: {
      creditsUsed: true,
    },
  });

  return aggregate._sum.creditsUsed ?? 0;
}

export function getCreditBreakdown(params: {
  plan: string;
  totalCredits: number;
  periodCreditsUsed: number;
}): CreditBreakdown {
  const { plan, totalCredits, periodCreditsUsed } = params;

  if (hasUnlimitedCredits(totalCredits)) {
    return {
      totalCredits,
      planCreditsRemaining: UNLIMITED_CREDITS,
      topUpCreditsRemaining: 0,
      periodCreditsUsed,
      planAllowance: UNLIMITED_CREDITS,
    };
  }

  const planAllowance = getPlanCredits(resolvePlan(plan));
  const theoreticalPlanCreditsRemaining = Math.max(planAllowance - periodCreditsUsed, 0);
  const planCreditsRemaining = Math.min(theoreticalPlanCreditsRemaining, Math.max(totalCredits, 0));
  const topUpCreditsRemaining = Math.max(totalCredits - planCreditsRemaining, 0);

  return {
    totalCredits,
    planCreditsRemaining,
    topUpCreditsRemaining,
    periodCreditsUsed,
    planAllowance,
  };
}

export async function getCreditBreakdownForUser(user: CreditStateUser) {
  const periodCreditsUsed = await getProcessedCreditsForPlanWindow(user);
  return getCreditBreakdown({
    plan: user.plan,
    totalCredits: user.credits,
    periodCreditsUsed,
  });
}

export async function getRenewedCreditTotal(params: {
  user: CreditStateUser;
  nextPlan: string;
}) {
  const breakdown = await getCreditBreakdownForUser(params.user);
  const nextPlanAllowance = getPlanCredits(resolvePlan(params.nextPlan));

  if (hasUnlimitedCredits(breakdown.totalCredits)) {
    return nextPlanAllowance;
  }

  return breakdown.topUpCreditsRemaining + nextPlanAllowance;
}
