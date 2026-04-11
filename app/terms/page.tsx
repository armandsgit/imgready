import type { Metadata } from 'next';
import MarkdownContent from '@/components/MarkdownContent';
import { getSitePage } from '@/lib/sitePages';

export const metadata: Metadata = {
  title: 'Terms of Service — ImgReady',
  description: 'Read the ImgReady terms of service, subscription rules, and credit usage policy.',
  alternates: {
    canonical: '/terms',
  },
};

function formatLastUpdated(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default async function TermsPage() {
  const page = await getSitePage('terms');

  if (!page) {
    return null;
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg-secondary)] px-6 py-20">
      <div className="mx-auto max-w-[820px]">
        <div className="panel rounded-[32px] p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Last updated</p>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{formatLastUpdated(page.lastUpdatedAt)}</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">{page.title}</h1>
          <div className="mt-8">
            <MarkdownContent content={page.content} />
          </div>

          <div className="mt-8 rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-6">
            <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">How subscription and extra credits work</h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--text-secondary)]">
              <p>
                Monthly plan credits reset at the start of each billing cycle based on your current subscription.
              </p>
              <p>
                Purchased credits and bonus credits remain on your account until used and are not removed when your subscription renews.
              </p>
              <p>
                Extra credits are separate from your monthly plan allowance and are intended for additional usage beyond your subscription quota.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
