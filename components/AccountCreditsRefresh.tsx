'use client';

import { useEffect } from 'react';

const ACCOUNT_REFRESH_EVENT = 'account:refresh';

interface MeResponse {
  email: string;
  credits: number;
  plan: string;
  image?: string | null;
}

interface AccountCreditsRefreshProps {
  enabled: boolean;
  initialAccount?: MeResponse | null;
}

export default function AccountCreditsRefresh({ enabled, initialAccount = null }: AccountCreditsRefreshProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
    const delays = [0, 1500, 3500, 6000];

    if (initialAccount) {
      window.dispatchEvent(new CustomEvent<MeResponse>(ACCOUNT_REFRESH_EVENT, { detail: initialAccount }));
    }

    async function refreshAccount() {
      try {
        const response = await fetch('/api/me', { cache: 'no-store' });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as MeResponse;

        if (!cancelled) {
          window.dispatchEvent(new CustomEvent<MeResponse>(ACCOUNT_REFRESH_EVENT, { detail: payload }));
        }
      } catch {
        // Ignore transient refresh errors after Stripe redirect.
      }
    }

    const timeouts = delays.map((delay) => window.setTimeout(() => void refreshAccount(), delay));

    return () => {
      cancelled = true;
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [enabled]);

  return null;
}
