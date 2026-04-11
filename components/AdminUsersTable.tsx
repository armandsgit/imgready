'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Search, X } from 'lucide-react';

type AdminPlan = 'free' | 'starter' | 'pro';

export interface AdminUserRecord {
  id: string;
  email: string;
  role: string;
  plan: string;
  credits: number;
  emailVerified: boolean;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  planExpiresAt: string | null;
  processedCount: number;
  createdAt: string;
}

const PROTECTED_ADMIN_EMAILS = new Set(['armands.visam@gmail.com']);

interface DraftState {
  credits: number;
  emailVerified: boolean;
}

interface AdminUsersTableProps {
  initialUsers: AdminUserRecord[];
}

function formatAdminDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatOptionalAdminDate(value: string | null) {
  if (!value) {
    return '—';
  }

  return formatAdminDate(value);
}

function getDaysUntil(value: string | null) {
  if (!value) {
    return null;
  }

  const end = new Date(value);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function planBadgeClasses(plan: string, role?: string) {
  if (role === 'admin') {
    return 'border-[color:var(--accent-primary)]/30 bg-[color:var(--accent-soft)] text-[color:var(--status-info-text)]';
  }

  switch (plan) {
    case 'pro':
      return 'border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]';
    case 'starter':
      return 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]';
    default:
      return 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)]';
  }
}

function isProtectedAdminUser(email: string) {
  return PROTECTED_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

function formatAdminCredits(credits: number) {
  return credits === -1 ? '∞' : `${credits}`;
}

function formatAdminPlan(plan: string, credits: number, role?: string) {
  if (role === 'admin') {
    return 'Custom';
  }

  return credits === -1 ? 'Unlimited' : plan;
}

function getSubscriptionMeta(user: Pick<AdminUserRecord, 'role' | 'plan' | 'subscriptionStatus' | 'cancelAtPeriodEnd' | 'planExpiresAt'>) {
  const daysUntil = getDaysUntil(user.planExpiresAt);

  if (user.role === 'admin') {
    return {
      label: 'active',
      className: 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]',
      helperLabel: 'Custom admin access',
    };
  }

  if (user.plan === 'free') {
    return {
      label: 'active',
      className: 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]',
      helperLabel: 'No paid subscription',
    };
  }

  if (user.subscriptionStatus === 'expired') {
    return {
      label: 'expired',
      className: 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error-text)]',
      helperLabel: 'Subscription ended',
    };
  }

  if (user.cancelAtPeriodEnd || user.subscriptionStatus === 'cancelling') {
    return {
      label: 'canceling',
      className: 'border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]',
      helperLabel:
        typeof daysUntil === 'number' && daysUntil >= 0
          ? `${daysUntil} day${daysUntil === 1 ? '' : 's'} left`
          : 'Ends at period end',
    };
  }

  return {
    label: user.subscriptionStatus ?? 'active',
    className: 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]',
    helperLabel:
      typeof daysUntil === 'number' && daysUntil >= 0
        ? `${daysUntil} day${daysUntil === 1 ? '' : 's'} left`
        : 'Active subscription',
  };
}

export default function AdminUsersTable({ initialUsers }: AdminUsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(
    Object.fromEntries(
      initialUsers.map((user) => [
        user.id,
        {
          credits: user.credits,
          emailVerified: user.emailVerified,
        },
      ])
    )
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | AdminPlan>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = user.email.toLowerCase().includes(search.trim().toLowerCase());
      const matchesPlan = planFilter === 'all' ? true : user.plan === planFilter;
      return matchesSearch && matchesPlan;
    });
  }, [planFilter, search, users]);

  const selectedUser = selectedUserId
    ? filteredUsers.find((user) => user.id === selectedUserId) ??
      users.find((user) => user.id === selectedUserId) ??
      null
    : null;

  const selectedDraft = selectedUser
    ? drafts[selectedUser.id] ?? { credits: selectedUser.credits, emailVerified: selectedUser.emailVerified }
    : null;

  const selectedSubscriptionMeta = selectedUser ? getSubscriptionMeta(selectedUser) : null;

  const hasUnsavedChanges = selectedUser
    ? selectedDraft?.credits !== selectedUser.credits ||
      selectedDraft?.emailVerified !== selectedUser.emailVerified
    : false;

  function updateDraft(userId: string, next: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        ...next,
      },
    }));
  }

  function adjustCredits(userId: string, delta: number) {
    const currentCredits = drafts[userId]?.credits ?? 0;
    updateDraft(userId, { credits: Math.max(0, currentCredits + delta) });
  }

  function startDelete(userId: string) {
    setPendingDeleteUserId(userId);
    setFeedback(null);
  }

  function cancelDelete() {
    setPendingDeleteUserId(null);
  }

  async function setUserVerification(userId: string, emailVerified: boolean) {
    const currentDraft = drafts[userId];

    if (!currentDraft) {
      return;
    }

    const nextDraft: DraftState = {
      ...currentDraft,
      emailVerified,
    };

    setDrafts((current) => ({
      ...current,
      [userId]: nextDraft,
    }));

    await saveUser(userId, nextDraft);
  }

  async function saveUser(userId: string, draftOverride?: DraftState) {
    const draft = draftOverride ?? drafts[userId];

    if (!draft) {
      return;
    }

    setSavingUserId(userId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: draft.credits,
          emailVerified: draft.emailVerified,
        }),
      });

      const payload = (await response.json()) as { error?: string; user?: AdminUserRecord };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || 'Could not save changes. Please try again.');
      }

      setUsers((current) => current.map((user) => (user.id === userId ? payload.user! : user)));
      setDrafts((current) => ({
        ...current,
        [userId]: {
          credits: payload.user!.credits,
          emailVerified: payload.user!.emailVerified,
        },
      }));
      setFeedback({ type: 'success', message: 'User updated successfully.' });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : '';
      setFeedback({
        type: 'error',
        message: rawMessage && rawMessage !== '1 error'
          ? rawMessage
          : 'Failed to update user. Please try again.',
      });
    } finally {
      setSavingUserId(null);
    }
  }

  async function confirmDelete(userId: string) {
    setDeletingUserId(userId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const payload = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok) {
        throw new Error(payload.error || 'Could not delete user. Please try again.');
      }

      const nextUsers = users.filter((user) => user.id !== userId);
      setUsers(nextUsers);
      setPendingDeleteUserId(null);
      setSelectedUserId((current) => {
        if (current !== userId) {
          return current;
        }

        return nextUsers[0]?.id ?? null;
      });
      setFeedback({ type: 'success', message: 'User deleted successfully.' });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : '';
      setFeedback({
        type: 'error',
        message: rawMessage || 'Could not delete user. Please try again.',
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]'
              : 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error-text)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
          <div className="panel rounded-[28px] p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by email"
                  className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] py-2 pl-10 pr-4 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
                />
              </div>

              <select
                value={planFilter}
                onChange={(event) => setPlanFilter(event.target.value as 'all' | AdminPlan)}
                className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
              >
                <option value="all">All plans</option>
                <option value="free">free</option>
                <option value="starter">starter</option>
                <option value="pro">pro</option>
              </select>
            </div>
          </div>

          <div className="panel rounded-[30px]">
            <div className="overflow-x-auto px-2">
              <table className="w-full min-w-[780px] table-fixed divide-y divide-[color:var(--border-color)]">
                <thead className="bg-[color:var(--surface-muted)]/70">
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
                    <th className="w-[34%] px-6 py-4 font-medium">Email</th>
                    <th className="w-[14%] px-6 py-4 font-medium">Plan</th>
                    <th className="w-[12%] px-6 py-4 font-medium">Credits</th>
                    <th className="w-[12%] px-6 py-4 font-medium">Processed</th>
                    <th className="w-[16%] px-6 py-4 font-medium">Subscription</th>
                    <th className="w-[140px] px-6 py-4 font-medium whitespace-nowrap">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--border-color)]">
                  {filteredUsers.map((user) => {
                    const subscriptionMeta = getSubscriptionMeta(user);

                    return (
                    <tr
                      key={user.id}
                      className={`transition-colors ${selectedUser?.id === user.id ? 'bg-[color:var(--accent-soft)]' : 'hover:bg-[color:var(--surface-contrast)]'}`}
                    >
                      <td className="px-6 py-5 align-middle">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-6 text-[color:var(--text-primary)]">{user.email}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                            <span>{user.role}</span>
                            <span>•</span>
                            <span className={user.emailVerified ? 'text-[color:var(--status-success-text)]' : 'text-[color:var(--status-warning-text)]'}>
                              {user.emailVerified ? 'verified' : 'unverified'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <div className="space-y-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${planBadgeClasses(user.plan, user.role)}`}>
                            {user.role === 'admin' ? 'custom' : user.plan}
                          </span>
                          <div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${subscriptionMeta.className}`}>
                              {subscriptionMeta.label}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-middle">
                        <span className="text-base font-semibold text-[color:var(--text-primary)]">{formatAdminCredits(user.credits)}</span>
                      </td>
                      <td className="px-6 py-5 align-middle text-sm text-[color:var(--text-secondary)]">{user.processedCount}</td>
                      <td className="px-6 py-5 align-middle">
                        <div className="space-y-1">
                          <p className="text-sm text-[color:var(--text-secondary)]">
                            {formatOptionalAdminDate(user.planExpiresAt)}
                          </p>
                          <p className="text-xs text-[color:var(--text-muted)]">
                            {subscriptionMeta.helperLabel}
                          </p>
                        </div>
                      </td>
                      <td className="w-[140px] px-6 py-5 align-middle whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(user.id)}
                          className={`inline-flex min-w-[112px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                            selectedUser?.id === user.id
                              ? 'theme-accent-fill text-white'
                              : 'border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)]'
                          }`}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[color:var(--text-muted)]">
                No users match the current search or filter.
              </div>
            )}
          </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 py-10 backdrop-blur-sm">
          <div className="panel max-h-[90vh] w-full max-w-[920px] overflow-y-auto rounded-[32px] p-7">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Edit user</p>
                <h2 className="text-2xl font-semibold text-[color:var(--text-primary)]">{selectedUser.email}</h2>
                <p className="max-w-2xl text-sm text-[color:var(--text-secondary)]">
                  Adjust credits and verification without changing Stripe-owned subscription plans.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
                aria-label="Close edit user modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Current plan</p>
                  <p className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">{formatAdminPlan(selectedUser.plan, selectedUser.credits, selectedUser.role)}</p>
                </div>
                <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Verification</p>
                  <p className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">
                    {selectedDraft?.emailVerified ? 'Verified' : 'Pending'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Subscription status</p>
                  <div className="mt-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] ${selectedSubscriptionMeta?.className ?? 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)]'}`}>
                      {selectedSubscriptionMeta?.label ?? 'free'}
                    </span>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Subscription ends</p>
                  <p className="mt-3 text-xl font-semibold text-[color:var(--text-primary)]">
                    {formatOptionalAdminDate(selectedUser.planExpiresAt)}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                    {selectedSubscriptionMeta?.helperLabel ?? 'No paid subscription'}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">Plan</p>
                    <div className="rounded-[20px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Stripe-managed</p>
                      <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                        Current plan: <span className="font-medium text-[color:var(--text-primary)]">{formatAdminPlan(selectedUser.plan, selectedUser.credits, selectedUser.role)}</span>
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                        Change paid plans only through Stripe checkout, customer portal, or webhook sync to avoid billing mismatches.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-[color:var(--text-primary)]">Credits</label>
                    <div className="inline-flex flex-wrap rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-1">
                      <button
                        type="button"
                        onClick={() => adjustCredits(selectedUser.id, 10)}
                        className="inline-flex min-w-[60px] items-center justify-center rounded-xl px-3 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-strong)]"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustCredits(selectedUser.id, 50)}
                        className="inline-flex min-w-[60px] items-center justify-center rounded-xl px-3 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-strong)]"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustCredits(selectedUser.id, -10)}
                        className="inline-flex min-w-[60px] items-center justify-center rounded-xl px-3 py-2 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--surface-strong)]"
                      >
                        -10
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={selectedDraft?.credits ?? selectedUser.credits}
                      onChange={(event) =>
                        updateDraft(selectedUser.id, {
                          credits: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                      className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-[color:var(--text-primary)]">Email verification</label>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void setUserVerification(selectedUser.id, true)}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                          selectedDraft?.emailVerified
                            ? 'theme-accent-fill text-white'
                            : 'theme-secondary-button'
                        }`}
                      >
                        Mark as verified
                      </button>
                      <button
                        type="button"
                        onClick={() => void setUserVerification(selectedUser.id, false)}
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                          selectedDraft?.emailVerified === false
                            ? 'border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-text)]'
                            : 'theme-secondary-button'
                        }`}
                      >
                        Require email verification
                      </button>
                    </div>
                  </div>

                  {hasUnsavedChanges && (
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      You have unsaved changes for this user.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => saveUser(selectedUser.id)}
                    disabled={savingUserId === selectedUser.id}
                    className="theme-accent-button inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingUserId === selectedUser.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {savingUserId === selectedUser.id ? 'Saving changes...' : 'Save changes'}
                  </button>

                  <div className="rounded-[24px] border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)]/60 p-4">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">Danger zone</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">
                      Permanently delete this user account and remove access from the app.
                    </p>

                    {isProtectedAdminUser(selectedUser.email) ? (
                      <div className="mt-4 rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-secondary)]">
                        This admin account is protected and cannot be deleted.
                      </div>
                    ) : pendingDeleteUserId === selectedUser.id ? (
                      <div className="mt-4 space-y-3">
                        <p className="text-sm text-[color:var(--status-error-text)]">
                          Confirm deletion for <span className="font-medium">{selectedUser.email}</span>. This action cannot be undone.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => confirmDelete(selectedUser.id)}
                            disabled={deletingUserId === selectedUser.id}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-2.5 text-sm font-medium text-[color:var(--status-error-text)] hover:border-[color:var(--status-error-border)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingUserId === selectedUser.id && <Loader2 className="h-4 w-4 animate-spin" />}
                            {deletingUserId === selectedUser.id ? 'Deleting...' : 'Confirm delete'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelDelete}
                            disabled={deletingUserId === selectedUser.id}
                            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2.5 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startDelete(selectedUser.id)}
                        className="mt-4 inline-flex items-center justify-center rounded-xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-2.5 text-sm font-medium text-[color:var(--status-error-text)] hover:border-[color:var(--status-error-border)]"
                      >
                        Delete user
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
