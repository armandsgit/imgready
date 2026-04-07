'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface ManageBillingButtonProps {
  enabled: boolean;
}

export default function ManageBillingButton({ enabled }: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!enabled || loading) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
      });

      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Could not open billing portal.');
      }

      window.location.href = payload.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal.');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={!enabled || loading}
        className="inline-flex items-center justify-center rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage billing'}
      </button>
      {error && <p className="text-sm text-[color:var(--status-error-text)]">{error}</p>}
    </div>
  );
}
