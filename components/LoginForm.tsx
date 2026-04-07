'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import GoogleAuthButton from '@/components/GoogleAuthButton';

interface LoginFormProps {
  registered?: boolean;
  verified?: boolean;
  callbackUrl?: string;
  authError?: string;
}

function getFriendlyAuthError(error: string | null | undefined) {
  if (!error) {
    return null;
  }

  if (error === 'OAuthSignin' || error === 'OAuthCallback' || error === 'OAuthCreateAccount') {
    return 'Google sign-in failed. Please try again.';
  }

  if (error === 'AccessDenied') {
    return 'Access was denied during Google sign-in.';
  }

  return 'Authentication failed. Please try again.';
}

export default function LoginForm({
  registered = false,
  verified = false,
  callbackUrl = '/post-auth',
  authError,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const oauthError = getFriendlyAuthError(authError);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResendMessage(null);
    setPreviewUrl(null);
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (!result || result.error) {
      setLoading(false);
      setError(
        result?.error === 'EMAIL_NOT_VERIFIED'
          ? 'Please verify your email before continuing.'
          : 'Invalid email or password.'
      );
      return;
    }

    try {
      window.sessionStorage.setItem('showWelcomeToast', 'true');
    } catch {}

    window.location.href = result.url ?? callbackUrl;
  }

  async function handleResendVerification() {
    if (!email) {
      setError('Enter your email address to resend verification.');
      return;
    }

    setResendLoading(true);
    setResendMessage(null);
    setPreviewUrl(null);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { error?: string; message?: string; previewUrl?: string };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not resend verification email.');
      }

      setResendMessage(payload.message || 'Verification email sent.');
      setPreviewUrl(payload.previewUrl ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email.');
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="panel rounded-[32px] p-8">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Welcome back</p>
        <h1 className="text-3xl font-semibold text-[color:var(--text-primary)]">Log in</h1>
        <p className="text-sm text-[color:var(--text-secondary)]">Use your account to keep removing backgrounds.</p>
      </div>

      <div className="mt-8 space-y-4">
        <GoogleAuthButton callbackUrl={callbackUrl} onError={setError} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[color:var(--border-color)]" />
          <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">or continue with email</span>
          <div className="h-px flex-1 bg-[color:var(--border-color)]" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--text-primary)]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
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
            className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </label>

        {registered && (
          <p className="rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success-text)]">
            Account created. Check your inbox and verify your email before logging in.
          </p>
        )}

        {verified && (
          <p className="rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success-text)]">
            Email verified successfully. You can log in now.
          </p>
        )}

        {oauthError && !loading && !error && (
          <p className="rounded-2xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error-text)]">
            {oauthError}
          </p>
        )}

        {error && !loading && (
          <p className="rounded-2xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error-text)]">
            {error}
          </p>
        )}

        {error === 'Please verify your email before continuing.' && (
          <div className="space-y-3 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-4">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Resend verification email
            </button>

            {resendMessage && <p className="text-sm text-[color:var(--status-success-text)]">{resendMessage}</p>}

            {previewUrl && (
              <a
                href={previewUrl}
                className="theme-accent-text inline-flex text-sm font-medium hover:text-white"
              >
                Open verification link
              </a>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="theme-accent-button inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Log in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[color:var(--text-secondary)]">
        Need an account?{' '}
        <Link href="/register" className="theme-accent-text font-medium hover:text-white">
          Register
        </Link>
      </p>
    </div>
  );
}
