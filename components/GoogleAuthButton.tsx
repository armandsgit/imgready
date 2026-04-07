'use client';

import { Loader2 } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

interface GoogleAuthButtonProps {
  callbackUrl: string;
  label?: string;
  onError?: (message: string | null) => void;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.32-2.04 3.03l3.3 2.56c1.92-1.77 3.04-4.38 3.04-7.48 0-.7-.06-1.38-.18-2.02H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.75 0 5.06-.91 6.75-2.48l-3.3-2.56c-.91.61-2.08.97-3.45.97-2.65 0-4.9-1.79-5.7-4.2l-3.42 2.64A9.99 9.99 0 0 0 12 22z"
      />
      <path
        fill="#4A90E2"
        d="M6.3 13.73A5.99 5.99 0 0 1 6 12c0-.6.1-1.18.28-1.73L2.86 7.63A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.47l3.22-2.74z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.07c1.5 0 2.84.52 3.9 1.53l2.92-2.92C17.05 3.04 14.74 2 12 2a9.99 9.99 0 0 0-8.92 5.63l3.42 2.64c.8-2.41 3.05-4.2 5.5-4.2z"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  callbackUrl,
  label = 'Continue with Google',
  onError,
}: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    onError?.(null);

    try {
      const providersResponse = await fetch('/api/auth/providers', { cache: 'no-store' });
      const providers = (await providersResponse.json()) as Record<string, { id: string }>;

      if (!providers.google) {
        throw new Error('Google sign-in is not configured yet.');
      }

      try {
        window.sessionStorage.setItem('showWelcomeToast', 'true');
      } catch {}

      await signIn('google', { callbackUrl });
    } catch (error) {
      setLoading(false);
      onError?.(error instanceof Error ? error.message : 'Google sign-in is not available right now. Please try again.');
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleGoogleSignIn()}
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
      {label}
    </button>
  );
}
