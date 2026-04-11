'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

const CREDIT_TOP_UP_PLANS = [
  {
    credits: 100,
    price: '€5',
    pricePerCredit: '€0.05 per image',
    badge: 'Basic',
    note: null,
    highlighted: false,
  },
  {
    credits: 500,
    price: '€18',
    pricePerCredit: '~€0.036 per image',
    badge: 'Most popular',
    note: null,
    highlighted: true,
  },
  {
    credits: 1000,
    price: '€35',
    pricePerCredit: '~€0.035 per image',
    badge: 'Best value',
    note: 'Best value',
    highlighted: false,
  },
] as const;

interface CreditTopUpProps {
  onBuy: (credits: number) => void | Promise<void>;
  loadingCredits?: number | null;
  currentCredits?: number | null;
  title?: string;
  description?: string;
  helperText?: string;
  className?: string;
}

export default function CreditTopUp({
  onBuy,
  loadingCredits = null,
  currentCredits = null,
  title = 'Buy more credits',
  description = 'Add extra credits without changing your subscription.',
  helperText,
  className = '',
}: CreditTopUpProps) {
  const showWarning = typeof currentCredits === 'number' && currentCredits < 10;

  return (
    <div className={`rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--panel-bg)] p-5 ${className}`}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{title}</h3>
          {showWarning && (
            <span className="rounded-full border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] px-3 py-1 text-sm font-medium text-[color:var(--status-warning-text)]">
              Only {currentCredits} credits left — avoid interruption
            </span>
          )}
        </div>
        <p className="text-sm text-[color:var(--text-secondary)]">{description}</p>
        {helperText ? <p className="text-xs text-[color:var(--text-muted)]">{helperText}</p> : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {CREDIT_TOP_UP_PLANS.map((plan) => {
          const isLoading = loadingCredits === plan.credits;

          return (
            <article
              key={plan.credits}
              className={`group relative overflow-hidden rounded-2xl border p-5 ${
                plan.highlighted
                  ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-soft)]'
                  : 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]'
              }`}
            >
              {plan.highlighted ? (
                <span className="theme-accent-button absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold">
                  Most popular
                </span>
              ) : (
                <span className="absolute right-4 top-4 rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-semibold text-[color:var(--text-secondary)]">
                  {plan.badge}
                </span>
              )}

              <div className="mt-8 space-y-2">
                <p className="text-lg font-semibold text-[color:var(--text-primary)]">{plan.credits} credits</p>
                <p className="text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">{plan.price}</p>
                <p className="text-xs text-[color:var(--text-muted)]">{plan.pricePerCredit}</p>
                {plan.note && <p className="text-xs text-[color:var(--status-success-text)]">{plan.note}</p>}
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--accent-primary)]" />
                  <span>Credits are added on top of your current balance</span>
                </div>
                <button
                  type="button"
                  onClick={() => void onBuy(plan.credits)}
                  disabled={loadingCredits !== null}
                  className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.highlighted
                      ? 'theme-accent-button'
                      : 'border border-[color:var(--border-color)] bg-[color:var(--surface-strong)] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)]'
                    }`}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Opening...
                    </span>
                  ) : (
                    'Buy now'
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
