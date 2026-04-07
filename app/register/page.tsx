'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import ResendVerificationForm from '@/components/ResendVerificationForm';
import { PLAN_CONFIG, type PlanId } from '@/lib/plans';

const REGISTER_PLAN_OPTIONS: PlanId[] = ['free', 'starter', 'pro'];

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<PlanId>('free');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [devPreviewMode, setDevPreviewMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPlan = params.get('plan');

    if (requestedPlan === 'free' || requestedPlan === 'starter' || requestedPlan === 'pro') {
      setPlan(requestedPlan);
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          plan,
        }),
      });

      const payload = (await response.json()) as { error?: string; previewUrl?: string; deliveryMode?: 'provider' | 'development-preview' };

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create account.');
      }

      setVerificationSent(true);
      setPreviewUrl(payload.previewUrl ?? null);
      setDevPreviewMode(payload.deliveryMode === 'development-preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--bg-secondary)] px-6 py-20">
      <div className="relative mx-auto w-full max-w-md">
        <div className="panel rounded-[32px] p-8">
          {verificationSent ? (
            <div className="space-y-5 text-center">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Verify email</p>
                <h1 className="text-3xl font-semibold text-[color:var(--text-primary)]">Check your inbox</h1>
                <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
                  We sent a verification email to <span className="font-medium text-[color:var(--text-primary)]">{email}</span>. Please verify your address before logging in.
                </p>
              </div>

              {previewUrl && devPreviewMode && (
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                    Development only
                  </p>
                  <a
                    href={previewUrl}
                    className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]"
                  >
                    Development only: open verification link
                  </a>
                </div>
              )}

              <ResendVerificationForm initialEmail={email} />

              <Link
                href="/login?registered=1&callbackUrl=/post-auth"
                className="theme-accent-button inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
              >
                Continue to login
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Get started</p>
                <h1 className="text-3xl font-semibold text-[color:var(--text-primary)]">Create an account</h1>
                <p className="text-sm text-[color:var(--text-secondary)]">New accounts start on the Free plan automatically, and you can upgrade whenever you need more throughput.</p>
              </div>

              <div className="mt-8 space-y-4">
                <GoogleAuthButton callbackUrl={`/post-auth?plan=${plan}`} onError={setError} />

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[color:var(--border-color)]" />
                  <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">or continue with email</span>
                  <div className="h-px flex-1 bg-[color:var(--border-color)]" />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <div className="space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">Plan</span>
                  <div className="grid gap-3">
                    {REGISTER_PLAN_OPTIONS.map((planId) => {
                      const option = PLAN_CONFIG[planId];
                      const active = plan === planId;

                      return (
                        <button
                          key={planId}
                          type="button"
                          onClick={() => setPlan(planId)}
                          className={`rounded-2xl border px-4 py-3 text-left transition ${
                            active
                              ? 'border-[color:var(--accent-primary)] bg-[color:var(--accent-soft)]'
                              : 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] hover:border-[color:var(--border-strong)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[color:var(--text-primary)]">{option.name}</p>
                              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{option.features[0]}</p>
                            </div>
                            <span className="text-sm font-medium text-[color:var(--text-primary)]">{option.monthlyPriceLabel}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--text-primary)] outline-none transition-colors focus:border-[color:var(--accent-primary)]"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[color:var(--text-primary)]">Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--text-primary)] outline-none transition-colors focus:border-[color:var(--accent-primary)]"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                  />
                </label>

                {error && (
                  <p className="rounded-2xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error-text)]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="theme-accent-button inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[color:var(--text-secondary)]">
                Already have an account?{' '}
                <Link href="/login" className="theme-accent-text font-medium hover:text-white">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
