'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const branding = initialBranding;
  const canUpgradePlan = account?.plan.trim().toLowerCase() !== 'pro';

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

  useEffect(() => {
    if (!accountMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountMenuOpen]);

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
              <span className={`hidden text-sm font-medium sm:inline ${account.credits === 0 ? 'text-[color:var(--status-warning-text)]' : 'text-[color:var(--text-secondary)]'}`}>
                {account.credits === UNLIMITED_CREDITS ? 'Unlimited credits' : `${formatCredits(account.credits)} credits`}
                {account.credits === 0 ? ' ⚠' : ''}
              </span>
              {canUpgradePlan && (
                <Link
                  href="/pricing"
                  className="theme-secondary-button hidden rounded-xl px-4 py-2 text-sm font-medium sm:inline-flex"
                >
                  Upgrade
                </Link>
              )}
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  className="inline-flex items-center rounded-full transition hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[color:var(--page-bg)]"
                  aria-label="Open account menu"
                  aria-expanded={accountMenuOpen}
                >
                  <UserAvatar email={account.email} image={account.image} size="sm" />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[min(300px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-[color:var(--border-color)] bg-[rgba(28,28,32,0.96)] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                    <div className="flex items-center gap-3 rounded-2xl bg-[color:var(--surface-muted)] p-3">
                      <UserAvatar email={account.email} image={account.image} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">ImgReady Account</p>
                        <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{account.email}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[color:var(--text-secondary)]">Plan</span>
                        <span className="font-medium text-[color:var(--text-primary)]">{formatPlanName(account.plan)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[color:var(--text-secondary)]">Credits</span>
                        <span className={`font-medium ${account.credits === 0 ? 'text-[color:var(--status-warning-text)]' : 'text-[color:var(--text-primary)]'}`}>
                          {account.credits === UNLIMITED_CREDITS ? 'Unlimited' : formatCredits(account.credits)}
                          {account.credits === 0 ? ' ⚠' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="my-3 h-px bg-[color:var(--border-color)]" />

                    <div className="grid gap-2">
                      {canUpgradePlan && (
                        <Link
                          href="/pricing"
                          onClick={() => setAccountMenuOpen(false)}
                          className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium"
                        >
                          Upgrade plan
                        </Link>
                      )}
                      <Link
                        href="/account"
                        onClick={() => setAccountMenuOpen(false)}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Buy credits
                      </Link>
                    </div>

                    <div className="my-3 h-px bg-[color:var(--border-color)]" />

                    <div className="grid gap-2">
                      <Link
                        href="/account"
                        onClick={() => setAccountMenuOpen(false)}
                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-[color:var(--surface-strong)]"
                      >
                        Account settings
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="inline-flex items-center justify-center rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-[color:var(--text-secondary)] hover:border-[color:var(--border-color)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Logout'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
