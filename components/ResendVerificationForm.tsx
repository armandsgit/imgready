'use client';

import { FormEvent, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ResendVerificationFormProps {
  initialEmail?: string;
  buttonLabel?: string;
}

export default function ResendVerificationForm({
  initialEmail = '',
  buttonLabel = 'Resend email',
}: ResendVerificationFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [devPreviewMode, setDevPreviewMode] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPreviewUrl(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        previewUrl?: string;
        deliveryMode?: 'provider' | 'development-preview';
      };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not resend verification email.');
      }

      setSuccess(payload.message || 'Verification email sent.');
      setPreviewUrl(payload.previewUrl ?? null);
      setDevPreviewMode(payload.deliveryMode === 'development-preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!initialEmail && (
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none focus:border-[color:var(--accent-primary)]"
          required
        />
      )}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {buttonLabel}
      </button>

      {success && <p className="text-sm text-[color:var(--status-success-text)]">{success}</p>}
      {error && <p className="text-sm text-[color:var(--status-error-text)]">{error}</p>}

      {previewUrl && devPreviewMode && (
        <a
          href={previewUrl}
          className="theme-accent-text inline-flex text-sm font-medium hover:text-white"
        >
          Development only: open verification link
        </a>
      )}
    </form>
  );
}
