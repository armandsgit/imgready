import MarkdownContent from '@/components/MarkdownContent';
import { getSitePage, type SitePageSlug } from '@/lib/sitePages';

function formatLastUpdated(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default async function SitePageView({ slug }: { slug: SitePageSlug }) {
  const page = await getSitePage(slug);

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
        </div>
      </div>
    </main>
  );
}
