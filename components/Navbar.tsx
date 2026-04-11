'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { signOut } from 'next-auth/react';
import UserAvatar from '@/components/UserAvatar';
import type { BrandingSettings } from '@/lib/appConfig';
import { UNLIMITED_CREDITS, formatCredits } from '@/lib/plans';

interface MeResponse {
  email: string;
  credits: number;
  plan: string;
  image?: string | null;
}

interface NavbarProps {
  initialBranding: BrandingSettings;
  initialAccount: MeResponse | null;
}

const ACCOUNT_REFRESH_EVENT = 'account:refresh';

function formatPlanName(plan: string) {
  switch (plan.trim().toLowerCase()) {
    case 'starter':
      return 'Starter';
    case 'pro':
      return 'Pro';
    case 'free':
    default:
      return 'Free';
  }
}

export default function Navbar({ initialBranding, initialAccount }: NavbarProps) {
  const [account, setAccount] = useState<MeResponse | null>(initialAccount);
  const [loading, setLoading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const branding = initialBranding;

  const loadAccount = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch('/api/me', { cache: 'no-store', signal: controller.signal });

      if (!response.ok) {
        setAccount(null);
        return;
      }

      const payload = (await response.json()) as MeResponse;
      setAccount(payload);
    } catch {
      setAccount(null);
    } finally {
      window.clearTimeout(timeout);
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    function handleAccountRefresh(event: Event) {
      const customEvent = event as CustomEvent<MeResponse | undefined>;

      if (customEvent.detail) {
        setAccount(customEvent.detail);
        setLoading(false);
        return;
      }

      void loadAccount(false);
    }

    window.addEventListener(ACCOUNT_REFRESH_EVENT, handleAccountRefresh as EventListener);

    return () => {
      window.removeEventListener(ACCOUNT_REFRESH_EVENT, handleAccountRefresh as EventListener);
    };
  }, [loadAccount]);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ callbackUrl: '/' });
  }

  return (
    <header className="sticky top-0 z-50 h-[64px] bg-[rgba(11,11,13,0.62)] backdrop-blur-2xl sm:h-[72px]">
      <div className="mx-auto flex h-full max-w-[1180px] items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-10 lg:gap-12">
          <Link href="/" className="relative block h-7 w-[156px] shrink-0 sm:h-8 sm:w-[238px]">
            <img
              src={branding.logo}
              alt={branding.logoAlt}
              className="h-full w-full object-contain object-left"
            />
          </Link>
          <nav className="hidden items-center md:flex">
            <Link
              href="/pricing"
              className="text-sm font-medium tracking-[0.01em] text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
            >
              Pricing
            </Link>
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3 md:gap-4">
          {loading ? (
            <div className="h-10" />
          ) : account ? (
            <>
              <span className={`hidden text-sm font-medium lg:inline ${account.credits === 0 ? 'text-[color:var(--status-warning-text)]' : 'text-[color:var(--text-secondary)]'}`}>
                {account.credits === UNLIMITED_CREDITS ? 'Unlimited credits' : `${formatCredits(account.credits)} credits`}
                {account.credits === 0 ? ' ⚠' : ''}
              </span>
              <Link
                href="/pricing"
                className="theme-secondary-button hidden rounded-xl px-4 py-2 text-sm font-medium sm:inline-flex"
              >
                Upgrade
              </Link>
              <Link
                href="/account"
                className="inline-flex items-center rounded-full transition hover:opacity-85"
                aria-label="Open account"
              >
                <UserAvatar email={account.email} image={account.image} size="sm" />
              </Link>
              <Link
                href="/account"
                className="hidden min-w-0 text-right leading-tight transition hover:opacity-80 lg:block"
              >
                <span className="block max-w-[220px] truncate text-[13px] font-medium text-[color:var(--text-primary)]">
                  {`Account · ${formatPlanName(account.plan)}`}
                </span>
                <span className="mt-0.5 block text-[11px] text-[color:var(--text-muted)]">
                  {account.email}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center rounded-xl border border-transparent px-2.5 py-2 text-sm font-medium text-[color:var(--text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
              >
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Logout'}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/login"
                className="px-1.5 py-2 text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)] sm:px-2"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="theme-secondary-button inline-flex items-center rounded-xl px-3 py-2 text-sm font-medium sm:px-4"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </header>
  );
}
