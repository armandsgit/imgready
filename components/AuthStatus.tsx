'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { formatCredits, getPlanName } from '@/lib/plans';

interface AuthStatusProps {
  refreshKey?: number;
}

interface MeResponse {
  email: string;
  plan: string;
  credits: number;
}

export default function AuthStatus({ refreshKey = 0 }: AuthStatusProps) {
  const [account, setAccount] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      setLoading(true);

      try {
        const response = await fetch('/api/me', {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!cancelled) {
            setAccount(null);
          }
          return;
        }

        const payload = (await response.json()) as MeResponse;

        if (!cancelled) {
          setAccount(payload);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ callbackUrl: '/' });
  }

  if (loading) {
    return (
      <div className="panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[color:var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading account
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex items-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="theme-accent-button inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium"
        >
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="panel flex items-center gap-4 rounded-2xl px-4 py-2.5 text-sm">
      <div className="text-right">
        <p className="font-medium text-[color:var(--text-primary)]">{account.email}</p>
        <p className="text-xs text-[color:var(--text-muted)]">
          {getPlanName(account.plan)} plan • Credits: {formatCredits(account.credits)}
        </p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Logout
      </button>
    </div>
  );
}
