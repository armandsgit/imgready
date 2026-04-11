import type { Metadata } from 'next';
import MarkdownContent from '@/components/MarkdownContent';

export const metadata: Metadata = {
  title: 'Cookies — ImgReady',
  description: 'Learn how ImgReady uses cookies for essential site functionality and analytics preferences.',
  alternates: {
    canonical: '/cookies',
  },
};

const COOKIE_PAGE_CONTENT = `## What cookies are
Cookies are small text files stored on your device to help websites remember information about your visit.

## What cookies we use
### Essential cookies
These are required for the app to function, including login and security.

### Analytics cookies
We use Google Analytics to understand how users interact with the app. This helps us improve performance and usability.

## How to manage cookies
You can manage your cookie preferences anytime in the cookie settings.`;

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[color:var(--bg-secondary)] px-6 py-20">
      <div className="mx-auto max-w-[820px]">
        <div className="panel rounded-[32px] p-8 md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Cookie policy</p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">Cookies</h1>
          <div className="mt-8">
            <MarkdownContent content={COOKIE_PAGE_CONTENT} />
          </div>
        </div>
      </div>
    </main>
  );
}
