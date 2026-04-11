import Link from 'next/link';
import type { Metadata } from 'next';
import { AlertTriangle, CheckCircle2, CreditCard, Mail, Sparkles } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import AccountLogoutButton from '@/components/AccountLogoutButton';
import AccountCreditsRefresh from '@/components/AccountCreditsRefresh';
import AccountCreditTopUp from '@/components/AccountCreditTopUp';
import ManageBillingButton from '@/components/ManageBillingButton';
import ReferralCopyButton from '@/components/ReferralCopyButton';
import ResumeSubscriptionButton from '@/components/ResumeSubscriptionButton';
import UndoDowngradeButton from '@/components/UndoDowngradeButton';
import UserAvatar from '@/components/UserAvatar';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { getCreditBreakdownForUser } from '@/lib/creditBalances';
import { PLAN_CONFIG, formatCredits, getPlanName, hasUnlimitedCredits, isPlanId } from '@/lib/plans';
import { prisma } from '@/lib/prisma';
import { buildReferralLink, ensureUserReferralCode } from '@/lib/referrals';
import {
  syncCheckoutSessionForUser,
  syncCreditTopUpSessionForUser,
  syncLatestStripeSubscriptionForCustomer,
  syncStripeSubscriptionForUser,
} from '@/lib/stripeSync';

export const metadata: Metadata = {
  title: 'Account — ImgReady',
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatDate(value: Date) {
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const year = value.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getBaseUrl() {
  const headerStore = headers();
  const forwardedProto = headerStore.get('x-forwarded-proto');
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host');

  if (host) {
    return `${forwardedProto ?? 'http'}://${host}`;
  }

  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
}

interface AccountPageProps {
  searchParams?: {
    checkout?: string;
    session_id?: string;
    subscription?: string;
    credits?: string;
  };
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect('/login');
  }

  let checkoutSyncMessage: string | null = null;
  let subscriptionMessage: string | null = null;
  let creditsMessage: string | null = null;

  if (searchParams?.checkout === 'success' && searchParams.session_id) {
    try {
      await syncCheckoutSessionForUser(searchParams.session_id, session.user.id);
      checkoutSyncMessage = 'Plan updated successfully. Your credits are ready.';
    } catch (error) {
      checkoutSyncMessage = error instanceof Error ? error.message : 'Could not confirm your Stripe checkout yet.';
    }
  }

  if (searchParams?.subscription === 'resumed') {
    subscriptionMessage = 'Subscription resumed successfully.';
  }

  if (searchParams?.subscription === 'undo-downgrade') {
    subscriptionMessage = 'Current plan restored. Automatic renewal will continue normally.';
  }

  if (searchParams?.subscription === 'updated') {
    subscriptionMessage = 'Plan updated successfully.';
  }

  if (searchParams?.subscription === 'billing-return') {
    subscriptionMessage = 'Billing changes synced from Stripe.';
  }

  if (searchParams?.subscription === 'pending-upgrade') {
    subscriptionMessage = 'Plan change requested. Your account updates as soon as Stripe confirms the upgrade.';
  }

  if (searchParams?.subscription === 'scheduled-downgrade') {
    subscriptionMessage = 'Plan change scheduled for your next billing cycle.';
  }

  if (searchParams?.credits === 'success') {
    if (searchParams.session_id) {
      try {
        await syncCreditTopUpSessionForUser(searchParams.session_id, session.user.id);
        creditsMessage = 'Credits added successfully.';
      } catch (error) {
        creditsMessage = error instanceof Error ? error.message : 'Could not confirm your credit purchase yet.';
      }
    } else {
      creditsMessage = 'Credit purchase received. Your balance updates after Stripe confirms payment.';
    }
  }

  await ensureUserPlanValidity(session.user.id);

  let user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      createdAt: true,
      plan: true,
      scheduledPlan: true,
      planChangeAt: true,
      credits: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      subscriptionStatus: true,
      cancelAtPeriodEnd: true,
      planStartedAt: true,
      planExpiresAt: true,
      processedCount: true,
      referralCode: true,
      affiliateBalance: true,
      creditTopUps: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          credits: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  if ((user.stripeSubscriptionId || user.stripeCustomerId) && user.plan !== 'free') {
    const wasPendingUpgrade = user.subscriptionStatus === 'pending_upgrade';
    const wasCancelling = user.cancelAtPeriodEnd;

    try {
      let subscriptionSyncResult: Awaited<ReturnType<typeof syncStripeSubscriptionForUser>> | null = null;

      if (user.stripeCustomerId) {
        subscriptionSyncResult = await syncLatestStripeSubscriptionForCustomer(
          user.stripeCustomerId,
          session.user.id,
          user.stripeSubscriptionId
        );
      } else if (user.stripeSubscriptionId) {
        subscriptionSyncResult = await syncStripeSubscriptionForUser(user.stripeSubscriptionId, session.user.id);
      }

      console.log('[account] stripe subscription synced', subscriptionSyncResult);

      user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          createdAt: true,
          plan: true,
          scheduledPlan: true,
          planChangeAt: true,
          credits: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          subscriptionStatus: true,
          cancelAtPeriodEnd: true,
          planStartedAt: true,
          planExpiresAt: true,
          processedCount: true,
          referralCode: true,
          affiliateBalance: true,
          creditTopUps: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 5,
            select: {
              id: true,
              credits: true,
              createdAt: true,
            },
          },
        },
      });
      if (wasPendingUpgrade) {
        subscriptionMessage = subscriptionMessage ?? 'Plan updated successfully. Your credits are ready.';
      } else if (!wasCancelling && user?.cancelAtPeriodEnd) {
        subscriptionMessage = subscriptionMessage ?? 'Subscription cancellation scheduled. Your plan remains active until the period ends.';
      }
    } catch (error) {
      console.error('[account] stripe subscription sync failed', error);
      subscriptionMessage = `Could not sync Stripe subscription status: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      // Keep the current local state visible if Stripe has not finalized the subscription update yet.
    }
  }

  if (!user) {
    redirect('/login');
  }

  const creditBreakdown = await getCreditBreakdownForUser({
    id: session.user.id,
    plan: user.plan,
    credits: user.credits,
    createdAt: user.createdAt,
    planStartedAt: user.planStartedAt,
    planExpiresAt: user.planExpiresAt,
  });

  const referralCode = user.referralCode ?? (await ensureUserReferralCode(session.user.id));
  const referralLink = referralCode ? buildReferralLink(getBaseUrl(), referralCode) : null;

  const planId = isPlanId(user.plan) ? user.plan : 'free';
  const scheduledPlanId =
    user.scheduledPlan && isPlanId(user.scheduledPlan) ? user.scheduledPlan : null;
  const planConfig = PLAN_CONFIG[planId];
  const lowCredits = !hasUnlimitedCredits(creditBreakdown.totalCredits) && creditBreakdown.totalCredits <= 5;
  const planExpired = Boolean(user.planExpiresAt && user.planExpiresAt.getTime() < Date.now());
  const monthlyLimit = hasUnlimitedCredits(creditBreakdown.totalCredits) ? 'Custom volume' : `${planConfig.credits} images`;
  const usageThisMonth = hasUnlimitedCredits(creditBreakdown.totalCredits)
    ? `${user.processedCount}`
    : formatCredits(creditBreakdown.periodCreditsUsed);
  const scheduledChangeDate = user.planChangeAt ?? user.planExpiresAt;
  const remainingDays =
    user.planExpiresAt ? Math.ceil((user.planExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isCancelling = Boolean(planId !== 'free' && user.cancelAtPeriodEnd && !planExpired);
  const canUpgradePlan = planId !== 'pro';
  const hasScheduledDowngrade = Boolean(planId !== 'free' && scheduledPlanId && scheduledChangeDate);
  const hasPendingUpgrade = Boolean(user.subscriptionStatus === 'pending_upgrade' && scheduledPlanId);
  const subscriptionStatus =
    planId === 'free'
      ? {
          label: 'Free plan',
          className: 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)]',
          helper: 'You are currently on the Free plan',
          dateLabel: 'Renewal',
          dateValue: 'Not applicable',
          dateHelper: 'Free plans do not expire.',
          notice: null,
        }
      : user.subscriptionStatus === 'past_due'
        ? {
            label: 'Payment issue',
            className: 'border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]',
            helper: 'Stripe could not complete your latest payment or upgrade charge.',
            dateLabel: 'Current renewal date',
            dateValue: user.planExpiresAt ? formatDate(user.planExpiresAt) : 'Not available',
            dateHelper: 'Update your payment method in billing and retry if needed.',
            notice: 'Your current plan stays active until Stripe confirms the payment.',
          }
      : planExpired || user.subscriptionStatus === 'expired'
        ? {
            label: 'Expired',
            className: 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error-text)]',
            helper: 'Your paid plan has ended',
            dateLabel: 'Expired on',
            dateValue: user.planExpiresAt ? formatDate(user.planExpiresAt) : 'Not available',
            dateHelper: 'Upgrade to restore paid plan access.',
            notice: null,
          }
        : isCancelling
          ? {
              label: 'Cancelling',
              className: 'border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]',
              helper: 'Your subscription will remain active until the end of the billing period',
              dateLabel: 'Ends on',
              dateValue: user.planExpiresAt ? formatDate(user.planExpiresAt) : 'Not available',
              dateHelper: 'Billing will not renew after the current period.',
              notice:
                remainingDays !== null && remainingDays >= 0 && remainingDays <= 7
                  ? `Your subscription ends in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`
                  : null,
            }
          : {
              label: 'Active',
              className: 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]',
              helper: 'Your subscription renews automatically',
              dateLabel: 'Renews on',
              dateValue: user.planExpiresAt ? formatDate(user.planExpiresAt) : 'Not available',
              dateHelper: 'Billing remains active until the next renewal date.',
              notice:
                remainingDays !== null && remainingDays >= 0 && remainingDays <= 7
                  ? `Your subscription renews in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`
                  : null,
            };

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-12 md:py-16">
      <AccountCreditsRefresh
        enabled={searchParams?.credits === 'success' || searchParams?.checkout === 'success'}
        initialAccount={{
          email: user.email,
          credits: user.credits,
          plan: user.plan,
          image: session.user.image ?? null,
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--text-muted)]">Account</p>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">Your account</h1>
              <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
                Review your plan, usage, and account status in one place.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {canUpgradePlan && (
                <Link
                  href="/pricing"
                  className="theme-accent-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
                >
                  Upgrade plan
                </Link>
              )}
              <AccountLogoutButton />
            </div>
          </div>
        </div>

        {(lowCredits || planExpired) && (
          <div
            className={`panel flex flex-col gap-3 rounded-[28px] px-5 py-4 md:flex-row md:items-center md:justify-between ${
              planExpired
                ? 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)]'
                : 'border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-4 w-4 ${planExpired ? 'text-[color:var(--status-error-text)]' : 'text-[color:var(--status-warning-text)]'}`} />
              <p className={`text-sm ${planExpired ? 'text-[color:var(--status-error-text)]' : 'text-[color:var(--status-warning-text)]'}`}>
                {planExpired
                  ? 'Your plan has expired. Upgrade to continue processing images.'
                  : `Only ${formatCredits(creditBreakdown.totalCredits)} ${creditBreakdown.totalCredits === 1 ? 'credit' : 'credits'} left.`}
              </p>
            </div>
            {canUpgradePlan && (
              <Link
                href="/pricing"
                className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium"
              >
                Upgrade
              </Link>
            )}
          </div>
        )}

        {(checkoutSyncMessage || subscriptionMessage || creditsMessage) && (
          <div className="panel rounded-[28px] border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-5 py-4">
            <p className="text-sm text-[color:var(--status-success-text)]">
              {checkoutSyncMessage ?? subscriptionMessage ?? creditsMessage}
            </p>
          </div>
        )}

        <section className="grid grid-cols-1 gap-5">
          <AccountCreditTopUp currentCredits={creditBreakdown.totalCredits} />
        </section>

        <section className="grid grid-cols-1 gap-5">
          <div className="panel h-fit rounded-[26px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Plan</p>
                <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Subscription</h2>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Current plan</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{getPlanName(user.plan)}</p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{planConfig.monthlyPriceLabel}</p>
                <div className="mt-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${subscriptionStatus.className}`}>
                    {subscriptionStatus.label}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{subscriptionStatus.helper}</p>
                {subscriptionStatus.notice && (
                  <p className="mt-2 text-sm text-[color:var(--status-warning-text)]">{subscriptionStatus.notice}</p>
                )}
                {scheduledPlanId && scheduledChangeDate && (
                  <div className="mt-4 rounded-[18px] border border-[color:var(--border-color)] bg-[color:var(--surface-strong)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Scheduled change</p>
                    <div className="mt-3 space-y-2 text-sm text-[color:var(--text-secondary)]">
                      <p>
                        Current plan:{' '}
                        <span className="font-medium text-[color:var(--text-primary)]">{getPlanName(user.plan)}</span>
                      </p>
                      <p>
                        Scheduled plan:{' '}
                        <span className="font-medium text-[color:var(--text-primary)]">{getPlanName(scheduledPlanId)}</span>
                      </p>
                      <p>
                        Changes on:{' '}
                        <span className="font-medium text-[color:var(--text-primary)]">
                          {hasPendingUpgrade ? 'After Stripe confirms payment' : formatDate(scheduledChangeDate)}
                        </span>
                      </p>
                    </div>
                    {hasPendingUpgrade && (
                      <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">
                        If the upgrade charge fails, keep your current plan and update your card in billing before trying again.
                      </p>
                    )}
                    {hasScheduledDowngrade && (
                      <div className="mt-4">
                        <UndoDowngradeButton
                          enabled={hasScheduledDowngrade}
                          label={`Keep ${getPlanName(user.plan)}`}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Credits remaining</p>
                <p className={`mt-2 text-xl font-semibold ${lowCredits ? 'text-[color:var(--status-warning-text)]' : 'text-[color:var(--text-primary)]'}`}>
                  {hasUnlimitedCredits(creditBreakdown.totalCredits) ? '∞' : formatCredits(creditBreakdown.totalCredits)}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Subscription and top-up credits combined.</p>
              </div>

              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Monthly usage</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                  {usageThisMonth} / {monthlyLimit}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Usage is based on your current plan allowance.</p>
              </div>

              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Subscription credits left</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                  {hasUnlimitedCredits(creditBreakdown.totalCredits) ? '∞' : formatCredits(creditBreakdown.planCreditsRemaining)}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">These reset with your next billing cycle.</p>
              </div>

              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Extra credits</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                  {hasUnlimitedCredits(creditBreakdown.totalCredits) ? '0' : formatCredits(creditBreakdown.topUpCreditsRemaining)}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Purchased and bonus credits stay on your account.</p>
              </div>

              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  {planId === 'free' ? 'Plan access' : 'Billing cycle started'}
                </p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">
                  {user.planStartedAt ? formatDate(user.planStartedAt) : planId === 'free' ? 'Always available' : 'Not available'}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                  {planId === 'free' ? 'Free access starts immediately.' : 'Billing cycle start date from Stripe.'}
                </p>
              </div>

              <div className="flex h-full flex-col rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">{subscriptionStatus.dateLabel}</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{subscriptionStatus.dateValue}</p>
                <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{subscriptionStatus.dateHelper}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">How credits work</p>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[color:var(--text-secondary)]">
                <p>
                  Subscription credits reset at the start of each billing cycle based on your plan allowance.
                </p>
                <p>
                  Purchased and bonus credits stay on your account and are not removed when your subscription renews.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
          <div className="panel flex h-full flex-col rounded-[26px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <UserAvatar email={user.email} image={session.user.image ?? null} size="lg" />
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Profile</p>
                  <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Account details</h2>
                </div>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                <Mail className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Email</p>
                <p className="mt-2 text-base font-medium text-[color:var(--text-primary)]">{user.email}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Verification</p>
                  <div className="mt-2 flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${user.emailVerified ? 'text-[color:var(--status-success-text)]' : 'text-[color:var(--status-warning-text)]'}`} />
                    <p className="text-base font-medium text-[color:var(--text-primary)]">
                      {user.emailVerified ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Created</p>
                  <p className="mt-2 text-base font-medium text-[color:var(--text-primary)]">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="panel flex h-full flex-col rounded-[26px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Usage</p>
                <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Usage</h2>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Images processed</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{usageThisMonth}</p>
              </div>

              <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Monthly limit</p>
                <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{monthlyLimit}</p>
              </div>
            </div>
          </div>

          <div className="panel flex h-full flex-col rounded-[26px] p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Actions</p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">Manage account</h2>
            <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
              {canUpgradePlan && (
                <Link
                  href="/pricing"
                  className="theme-accent-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
                >
                  Upgrade plan
                </Link>
              )}
              {hasScheduledDowngrade && (
                <UndoDowngradeButton enabled={hasScheduledDowngrade} label={`Keep ${getPlanName(user.plan)}`} />
              )}
              {isCancelling && <ResumeSubscriptionButton enabled={isCancelling} />}
              {user.stripeCustomerId && <ManageBillingButton enabled={Boolean(user.stripeCustomerId)} />}
              <AccountLogoutButton />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="panel flex h-full flex-col rounded-[26px] p-5 md:p-6">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Invite friends</p>
              <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Referral link</h2>
              <p className="text-sm text-[color:var(--text-secondary)]">
                Share your link and get 100 bonus credits when a referred customer becomes a paying user.
              </p>
            </div>

            <div className="mt-6 grid flex-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Referral link</p>
                <p className="mt-2 break-all text-sm font-medium text-[color:var(--text-primary)]">
                  {referralLink ?? 'Referral link unavailable'}
                </p>
              </div>
              {referralLink && (
                <div className="flex items-center">
                  <ReferralCopyButton value={referralLink} />
                </div>
              )}
            </div>
          </div>

          <div className="panel flex h-full flex-col rounded-[26px] p-5 md:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Referral rewards</p>
            <h2 className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">Bonus credits earned</h2>
            <div className="mt-6 flex flex-1 flex-col justify-center rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Referral rewards</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">
                +{formatCredits(user.affiliateBalance)} credits
              </p>
              <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                Referral rewards are added automatically after the first successful Stripe payment from a referred user.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5">
          <div className="panel h-fit rounded-[26px] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Billing</p>
                <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">Recent top-ups</h2>
              </div>
              <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                <CreditCard className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {user.creditTopUps.length > 0 ? (
                user.creditTopUps.map((topUp) => (
                  <div
                    key={topUp.id}
                    className="flex items-center justify-between rounded-[22px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-[color:var(--text-primary)]">+{topUp.credits} credits</p>
                      <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{formatDate(topUp.createdAt)}</p>
                    </div>
                    <span className="rounded-full border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-3 py-1 text-xs font-medium text-[color:var(--status-success-text)]">
                      Completed
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-[22px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-6 text-center">
                  <p className="text-sm font-medium text-[color:var(--text-primary)]">No credit top-ups yet</p>
                  <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                    When you buy extra credits, they will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
