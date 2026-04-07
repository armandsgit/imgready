'use client';

import { Loader2, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

export default function AccountLogoutButton() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await signOut({ callbackUrl: '/' });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      Logout
    </button>
  );
}
