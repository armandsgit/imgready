'use client';

import { useState } from 'react';

interface ReferralCopyButtonProps {
  value: string;
}

export default function ReferralCopyButton({ value }: ReferralCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
