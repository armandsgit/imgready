'use client';

import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PLAN_CONFIG, type PlanId, getPlanName } from '@/lib/plans';
import PlanChangeModal from '@/components/PlanChangeModal';

const PLAN_ORDER: PlanId[] = ['free', 'starter', 'pro'];
const PLAN_DESCRIPTION_COPY: Record<PlanId, string> = {
  free: 'Perfect for testing before upgrading',
  starter: 'Ideal for growing product catalogs',
  pro: 'Built for scaling and bulk uploads',
  business: 'Built for scaling and bulk uploads',
};
const PLAN_PRICE_PER_IMAGE: Partial<Record<PlanId, string>> = {
  starter: '~€0.045/image',
  pro: '~€0.031/image',
};

interface MeResponse {
  email: string;
  plan: string;
  credits: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  planExpiresAt?: string | null;
}

interface ChangePlanResponse {
  error?: string;
  url?: string;
  mode?: 'checkout' | 'updated' | 'pending_upgrade' | 'scheduled_downgrade';
}

interface PlanSwitchModalState {
  currentPlan: string;
  targetPlan: 'free' | 'starter' | 'pro';
  billingEndDate?: string | null;
}

function getExistingSubscriberCta(currentPlan: string, targetPlan: 'starter' | 'pro') {
  const normalizedCurrent = currentPlan.trim().toLowerCase();

  if (normalizedCurrent === 'starter' && targetPlan === 'pro') {
    return 'Upgrade to Pro';
  }

  if (normalizedCurrent === 'pro' && targetPlan === 'starter') {
    return 'Switch to Starter';
  }

  return targetPlan === 'starter' ? 'Get Starter' : 'Get Pro';
}

function formatExpiryDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getGuestPlanCta(planId: PlanId) {
  switch (planId) {
    case 'free':
      return 'Start free';
    case 'starter':
      return 'Get Starter';
    case 'pro':
      return 'Get Pro';
    case 'business':
      return 'Get Pro';
  }
}

export default function PricingPlans() {
  const [account, setAccount] = useState<MeResponse | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<'starter' | 'pro' | null>(null);
  const [changingPlan, setChangingPlan] = useState<'starter' | 'pro' | null>(null);
  const [downgradingToFree, setDowngradingToFree] = useState(false);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const [planSwitchModal, setPlanSwitchModal] = useState<PlanSwitchModalState | null>(null);

  const loadAccount = useCallback(async () => {
    setAccountLoading(true);

    try {
      const response = await fetch('/api/me', { cache: 'no-store' });

      if (!response.ok) {
        setAccount(null);
        return;
      }

      const payload = (await response.json()) as MeResponse;
      setAccount(payload);
    } finally {
      setAccountLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  async function handleManageBilling() {
    setError(null);
    setBillingPortalLoading(true);

    try {
      const response = await fetch('/api/stripe/customer-portal', { method: 'POST' });
      const payload = (await response.json()) as ChangePlanResponse;

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Could not open billing portal.');
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal.');
      setBillingPortalLoading(false);
    }
  }

  async function changeExistingPlan(plan: 'starter' | 'pro') {
    setError(null);
    setChangingPlan(plan);

    try {
      const response = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as ChangePlanResponse;

      if (!response.ok) {
        throw new Error(payload.error || 'Could not change your plan.');
      }

      if (payload.url) {
        window.location.href = payload.url;
        return;
      }

      await loadAccount();
      if (payload.mode === 'scheduled_downgrade') {
        window.location.href = '/account?subscription=scheduled-downgrade';
        return;
      }

      if (payload.mode === 'pending_upgrade') {
        window.location.href = '/account?subscription=pending-upgrade';
        return;
      }

      window.location.href = '/account?subscription=updated';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your plan.');
    } finally {
      setChangingPlan(null);
    }
  }

  async function downgradeToFree() {
    setError(null);
    setDowngradingToFree(true);

    try {
      const response = await fetch('/api/stripe/downgrade', { method: 'POST' });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not downgrade to Free.');
      }

      await loadAccount();
      window.location.href = '/account';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not downgrade to Free.');
    } finally {
      setDowngradingToFree(false);
    }
  }

  async function startCheckout(plan: 'starter' | 'pro') {
    setError(null);
    setCheckoutPlan(plan);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }

        throw new Error(payload.error || 'Could not start checkout.');
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
    } finally {
      setCheckoutPlan(null);
    }
  }

  async function handleCheckout(plan: 'starter' | 'pro') {
    const currentPlan = account?.plan?.trim().toLowerCase();

    if (currentPlan === plan) {
      return;
    }

    if (currentPlan === 'starter' || currentPlan === 'pro') {
      const expiryDate = formatExpiryDate(account?.planExpiresAt);

      setPlanSwitchModal({
        currentPlan,
        targetPlan: plan,
        billingEndDate: expiryDate,
      });
      return;
    }

    await startCheckout(plan);
  }

  function handleFreePlanClick() {
    if (!account) {
      window.location.href = '/register?plan=free';
      return;
    }

    if (account.plan === 'free') {
      return;
    }

    const expiryDate = formatExpiryDate(account.planExpiresAt);
    setPlanSwitchModal({
      currentPlan: account.plan,
      targetPlan: 'free',
      billingEndDate: expiryDate,
    });
  }

  return (
    <div className="relative mx-auto w-full max-w-6xl px-6">
      {planSwitchModal && (
        <PlanChangeModal
          currentPlan={planSwitchModal.currentPlan}
          targetPlan={planSwitchModal.targetPlan}
          billingEndDate={planSwitchModal.billingEndDate}
          onClose={() => setPlanSwitchModal(null)}
          onConfirm={() => {
            const nextPlan = planSwitchModal.targetPlan;
            setPlanSwitchModal(null);
            if (nextPlan === 'free') {
              void downgradeToFree();
              return;
            }
            if (account?.stripeSubscriptionId) {
              void changeExistingPlan(nextPlan);
              return;
            }
            void startCheckout(nextPlan);
          }}
        />
      )}

      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Pricing</p>
        <h1 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)] md:text-4xl">Simple pricing</h1>
        <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">
          Choose the plan that fits your monthly image volume and processing needs.
        </p>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          All plans include the same features — only credits and limits differ.
        </p>
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">1 image = 1 credit</p>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">Cancel anytime</p>
      </div>

      {error && (
        <p
          className="mx-auto mt-8 max-w-2xl rounded-2xl border px-4 py-3 text-sm theme-danger-text"
          style={{ borderColor: 'var(--danger-soft-border)', background: 'var(--danger-soft-bg)' }}
        >
          {error}
        </p>
      )}

      <div className="mt-14 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLAN_CONFIG[planId];
          const paidPlanId = plan.id === 'starter' || plan.id === 'pro' ? plan.id : null;

          return (
            <article
              key={plan.id}
              className={`panel relative flex h-full flex-col rounded-[28px] p-8 ${
                plan.recommended
                  ? 'border-[color:var(--accent-primary)] shadow-[0_0_56px_rgba(124,58,237,0.3)] xl:scale-[1.03]'
                  : ''
              }`}
            >
              {plan.recommended && (
                <div className="theme-accent-badge absolute right-6 top-6 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-primary)]">
                  Best value
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-[color:var(--text-primary)]">{plan.name}</p>
                <p className="mt-4 text-4xl font-semibold text-[color:var(--text-primary)]">{plan.price}</p>
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                  {plan.price === '€0' ? 'Start free' : 'per month'}
                </p>
                {plan.id === 'free' && (
                  <p className="mt-2 text-sm font-medium text-[color:var(--accent-primary)]">No credit card required</p>
                )}
                {PLAN_PRICE_PER_IMAGE[plan.id] && (
                  <p className="mt-2 text-sm font-medium text-[color:var(--accent-primary)]">{PLAN_PRICE_PER_IMAGE[plan.id]}</p>
                )}
                {plan.id === 'pro' && (
                  <p className="mt-2 text-sm text-[color:var(--status-success-text)]">Best value for higher monthly volume</p>
                )}
                <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{PLAN_DESCRIPTION_COPY[plan.id]}</p>
              </div>

              <div className="mt-10 space-y-4">
                {(plan.id === 'free'
                  ? ['10 credits included', 'No credit card required', 'Max 3 images per upload']
                  : plan.id === 'starter'
                    ? ['200 credits per month', 'All features included', 'Max 20 images per upload']
                    : ['600 credits per month', 'All features included', 'Max 50 images per upload']
                ).map((feature) => (
                  <div key={feature} className="flex items-center gap-3 text-sm text-[color:var(--text-secondary)]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--accent-primary)]" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {plan.id === 'free' ? (
                account ? (
                  <button
                    type="button"
                    onClick={handleFreePlanClick}
                    disabled={downgradingToFree}
                    className="theme-secondary-button mt-10 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downgradingToFree ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Downgrading...
                      </span>
                    ) : account.plan === 'free' ? (
                      'Current plan ✓'
                    ) : (
                      'Downgrade to Free'
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/register?plan=${plan.id}`}
                    className="theme-secondary-button mt-10 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
                  >
                    {getGuestPlanCta(plan.id)}
                  </Link>
                )
              ) : account && paidPlanId ? (
                account.stripeSubscriptionId && account.plan === plan.id ? (
                  <button
                    type="button"
                    disabled
                    className={`mt-10 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition-colors transition-shadow disabled:cursor-not-allowed disabled:opacity-60 ${
                      plan.recommended
                        ? 'theme-accent-button text-white'
                        : 'theme-secondary-button text-[color:var(--text-primary)]'
                    }`}
                  >
                    Active
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCheckout(paidPlanId)}
                    disabled={checkoutPlan === paidPlanId || changingPlan === paidPlanId || accountLoading}
                    className={`mt-10 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition-colors transition-shadow disabled:cursor-not-allowed disabled:opacity-60 ${
                      plan.recommended
                        ? 'theme-accent-button text-white'
                        : 'theme-secondary-button text-[color:var(--text-primary)]'
                    }`}
                  >
                    {changingPlan === plan.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Changing plan...
                      </span>
                    ) : checkoutPlan === plan.id ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Opening checkout...
                      </span>
                    ) : account.stripeSubscriptionId ? (
                      getExistingSubscriberCta(account.plan, paidPlanId)
                    ) : (
                      getGuestPlanCta(plan.id)
                    )}
                  </button>
                )
              ) : paidPlanId ? (
                <Link
                  href={`/register?plan=${plan.id}`}
                  className={`mt-10 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium transition-colors transition-shadow ${
                    plan.recommended
                      ? 'theme-accent-button text-white'
                      : 'theme-secondary-button text-[color:var(--text-primary)]'
                  }`}
                >
                  {getGuestPlanCta(plan.id)}
                </Link>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
