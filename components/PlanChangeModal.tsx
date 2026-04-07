'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getPlanName } from '@/lib/plans';

interface PlanChangeModalProps {
  currentPlan: string;
  targetPlan: 'free' | 'starter' | 'pro';
  billingEndDate?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function isScheduledChange(currentPlan: string, targetPlan: 'free' | 'starter' | 'pro') {
  const normalizedCurrent = currentPlan.trim().toLowerCase();

  if (targetPlan === 'free') {
    return normalizedCurrent === 'starter' || normalizedCurrent === 'pro';
  }

  return normalizedCurrent === 'pro' && targetPlan === 'starter';
}

function getPrimaryLabel(targetPlan: 'free' | 'starter' | 'pro') {
  switch (targetPlan) {
    case 'free':
      return 'Downgrade to Free';
    case 'starter':
      return 'Switch to Starter';
    case 'pro':
      return 'Upgrade to Pro';
  }
}

export default function PlanChangeModal({
  currentPlan,
  targetPlan,
  billingEndDate,
  onClose,
  onConfirm,
}: PlanChangeModalProps) {
  const currentPlanName = getPlanName(currentPlan);
  const targetPlanName = getPlanName(targetPlan);
  const scheduledChange = isScheduledChange(currentPlan, targetPlan);
  const title = `Switch to ${targetPlanName} plan?`;
  const body = scheduledChange
    ? `Switching from ${currentPlanName} to ${targetPlanName} will take effect on your next billing cycle.`
    : `Switching from ${currentPlanName} to ${targetPlanName} will apply immediately after you confirm your plan change.`;
  const bullets = scheduledChange
    ? ['You keep your current credits', `You keep ${currentPlanName} benefits until billing end`]
    : ['You keep your current credits', 'Your new plan starts as soon as the change is confirmed'];
  const footnote = scheduledChange
    ? `${billingEndDate ? `Your current cycle ends on ${billingEndDate}. ` : ''}You can upgrade again anytime.`
    : billingEndDate
      ? `Your current billing cycle ends on ${billingEndDate}.`
      : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(11,11,13,0.72)] px-6 backdrop-blur-[8px]">
      <div className="panel w-full max-w-[520px] rounded-[24px] p-6 animate-[modal-enter_180ms_ease-out]">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] p-3 text-[color:var(--status-warning-text)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{body}</p>
            <div className="mt-4 space-y-2">
              {bullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-2 text-sm text-[color:var(--text-primary)]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--status-success-text)]" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
            {footnote ? <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{footnote}</p> : null}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]"
          >
            Keep current plan
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="theme-accent-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            {getPrimaryLabel(targetPlan)}
          </button>
        </div>
      </div>
    </div>
  );
}
