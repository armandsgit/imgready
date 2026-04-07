'use client';

import { useEffect } from 'react';
import { REFERRAL_COOKIE_NAME, normalizeReferralCode } from '@/lib/referrals';

const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setReferralCookie(code: string) {
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; Max-Age=${REFERRAL_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

export default function ReferralCapture() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const referralCode = normalizeReferralCode(searchParams.get('ref'));

    if (referralCode) {
      setReferralCookie(referralCode);

      try {
        window.localStorage.setItem(REFERRAL_COOKIE_NAME, referralCode);
      } catch {}

      return;
    }

    try {
      const storedCode = normalizeReferralCode(window.localStorage.getItem(REFERRAL_COOKIE_NAME));

      if (!storedCode) {
        return;
      }

      const hasCookie = document.cookie
        .split(';')
        .map((part) => part.trim())
        .some((part) => part.startsWith(`${REFERRAL_COOKIE_NAME}=`));

      if (!hasCookie) {
        setReferralCookie(storedCode);
      }
    } catch {}
  }, []);

  return null;
}
