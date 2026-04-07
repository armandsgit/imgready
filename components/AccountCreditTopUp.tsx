'use client';

import { useState } from 'react';
import CreditTopUp from '@/components/CreditTopUp';

interface AccountCreditTopUpProps {
  currentCredits: number;
}

export default function AccountCreditTopUp({ currentCredits }: AccountCreditTopUpProps) {
  const [loadingCredits, setLoadingCredits] = useState<number | null>(null);

  async function handleBuyCredits(credits: number) {
    setLoadingCredits(credits);

    try {
      const response = await fetch('/api/stripe/buy-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ package: credits }),
      });

      const payload = (await response.json()) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error || 'Could not start checkout for credits.');
      }

      window.location.href = payload.url;
    } finally {
      setLoadingCredits(null);
    }
  }

  return (
    <CreditTopUp
      onBuy={handleBuyCredits}
      loadingCredits={loadingCredits}
      currentCredits={currentCredits}
      title="Buy extra credits"
      description="Add extra credits anytime — perfect when you need more without upgrading your plan."
      helperText="Best value comes with monthly plans"
    />
  );
}
