'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FileText, Loader2 } from 'lucide-react';
import type { SitePageSlug } from '@/lib/sitePages';

interface EditableSitePage {
  id: string;
  slug: SitePageSlug;
  title: string;
  content: string;
  lastUpdatedAt: string | Date;
  createdAt: string | Date;
}

interface AdminSitePagesPanelProps {
  initialPages: EditableSitePage[];
}

interface EditableSitePageState {
  id: string;
  slug: SitePageSlug;
  title: string;
  content: string;
  lastUpdatedAt: string;
  createdAt: string;
}

const PAGE_LABELS: Record<SitePageSlug, string> = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  refund: 'Refund Policy',
  contact: 'Contact & Support',
};

function formatDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminSitePagesPanel({ initialPages }: AdminSitePagesPanelProps) {
  const [pages, setPages] = useState<EditableSitePageState[]>(
    initialPages.map((page) => ({
      ...page,
      lastUpdatedAt: typeof page.lastUpdatedAt === 'string' ? page.lastUpdatedAt : page.lastUpdatedAt.toISOString(),
      createdAt: typeof page.createdAt === 'string' ? page.createdAt : page.createdAt.toISOString(),
    }))
  );
  const [selectedSlug, setSelectedSlug] = useState<SitePageSlug>(initialPages[0]?.slug ?? 'terms');
  const [savingSlug, setSavingSlug] = useState<SitePageSlug | null>(null);
  const [resettingSlug, setResettingSlug] = useState<SitePageSlug | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPage = useMemo(
    () => pages.find((page) => page.slug === selectedSlug) ?? pages[0],
    [pages, selectedSlug]
  );

  function updateSelectedPage(next: Partial<EditableSitePageState>) {
    setPages((current) =>
      current.map((page) => (page.slug === selectedSlug ? { ...page, ...next } : page))
    );
  }

  async function handleSave() {
    if (!selectedPage) {
      return;
    }

    setSavingSlug(selectedPage.slug);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/site-pages/${selectedPage.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: selectedPage.title,
          content: selectedPage.content,
        }),
      });

      const payload = (await response.json()) as { error?: string; page?: EditableSitePage };
      if (!response.ok || !payload.page) {
        throw new Error(payload.error || 'Could not save page.');
      }

      const normalizedPage: EditableSitePageState = {
        ...payload.page,
        lastUpdatedAt:
          typeof payload.page.lastUpdatedAt === 'string'
            ? payload.page.lastUpdatedAt
            : payload.page.lastUpdatedAt.toISOString(),
        createdAt:
          typeof payload.page.createdAt === 'string'
            ? payload.page.createdAt
            : payload.page.createdAt.toISOString(),
      };

      setPages((current) =>
        current.map((page) =>
          page.slug === selectedPage.slug
            ? {
                ...page,
                ...normalizedPage,
              }
            : page
        )
      );
      setFeedback('Page saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save page.');
    } finally {
      setSavingSlug(null);
    }
  }

  async function handleResetToDefault() {
    if (!selectedPage) {
      return;
    }

    setResettingSlug(selectedPage.slug);
    setFeedback(null);
    setError(null);

    try {
      const response = await fetch(`/api/admin/site-pages/${selectedPage.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resetToDefault: true,
        }),
      });

      const payload = (await response.json()) as { error?: string; page?: EditableSitePage };
      if (!response.ok || !payload.page) {
        throw new Error(payload.error || 'Could not reset page.');
      }

      const normalizedPage: EditableSitePageState = {
        ...payload.page,
        lastUpdatedAt:
          typeof payload.page.lastUpdatedAt === 'string'
            ? payload.page.lastUpdatedAt
            : payload.page.lastUpdatedAt.toISOString(),
        createdAt:
          typeof payload.page.createdAt === 'string'
            ? payload.page.createdAt
            : payload.page.createdAt.toISOString(),
      };

      setPages((current) =>
        current.map((page) => (page.slug === selectedPage.slug ? normalizedPage : page))
      );
      setFeedback('Page reset to default successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset page.');
    } finally {
      setResettingSlug(null);
    }
  }

  if (!selectedPage) {
    return null;
  }

  return (
    <section className="panel rounded-[28px] p-6 md:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Site pages</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">Legal & Support Pages</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
            Edit Terms, Privacy, Refunds, and Contact content directly from admin.
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
          <FileText className="h-5 w-5" />
        </div>
      </div>

      {feedback ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] px-4 py-3 text-sm text-[color:var(--status-success-text)]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{feedback}</span>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] px-4 py-3 text-sm text-[color:var(--status-error-text)]">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3">
          {pages.map((page) => {
            const selected = page.slug === selectedSlug;
            return (
              <button
                key={page.slug}
                type="button"
                onClick={() => {
                  setSelectedSlug(page.slug);
                  setFeedback(null);
                  setError(null);
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-[color:var(--accent-primary)] bg-[rgba(124,58,237,0.10)]'
                    : 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] hover:border-[color:var(--border-strong)]'
                }`}
              >
                <p className="text-sm font-medium text-[color:var(--text-primary)]">{PAGE_LABELS[page.slug]}</p>
                <p className="mt-1 text-xs text-[color:var(--text-muted)]">Last updated {formatDate(page.lastUpdatedAt)}</p>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">{selectedPage.slug}</p>
              <p className="mt-1 text-sm text-[color:var(--text-secondary)]">Last updated {formatDate(selectedPage.lastUpdatedAt)}</p>
            </div>
            <Link
              href={`/${selectedPage.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
            >
              Preview page
              <ExternalLink className="h-4 w-4" />
            </Link>
          </div>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Title</span>
            <input
              type="text"
              value={selectedPage.title}
              onChange={(event) => updateSelectedPage({ title: event.target.value })}
              className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-3 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Content</span>
            <textarea
              value={selectedPage.content}
              onChange={(event) => updateSelectedPage({ content: event.target.value })}
              rows={20}
              className="w-full rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
            />
          </label>

          <p className="text-xs text-[color:var(--text-muted)]">
            Use simple markdown-like formatting: <span className="text-[color:var(--text-secondary)]">## Heading</span>, bullet lists with <span className="text-[color:var(--text-secondary)]">- item</span>, and blank lines for paragraphs.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => void handleResetToDefault()}
              disabled={resettingSlug === selectedPage.slug || savingSlug === selectedPage.slug}
              className="inline-flex min-w-[148px] items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resettingSlug === selectedPage.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset to default'}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={savingSlug === selectedPage.slug || resettingSlug === selectedPage.slug}
              className="theme-accent-button inline-flex min-w-[148px] items-center justify-center rounded-xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
            >
              {savingSlug === selectedPage.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
