import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export interface SeoLandingPageCard {
  title: string;
  description: string;
}

export interface SeoLandingPageFaq {
  question: string;
  answer: string;
}

export interface SeoLandingPageRelatedLink {
  href: string;
  label: string;
}

interface SeoLandingPageProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta?: string;
  benefits: SeoLandingPageCard[];
  contentTitle: string;
  contentBody: string[];
  contentCards: SeoLandingPageCard[];
  faqs: SeoLandingPageFaq[];
  relatedLinks: SeoLandingPageRelatedLink[];
}

export default function SeoLandingPage({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta = 'View pricing',
  benefits,
  contentTitle,
  contentBody,
  contentCards,
  faqs,
  relatedLinks,
}: SeoLandingPageProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-20 pt-[92px] text-[color:var(--text-primary)] sm:px-6 sm:pb-24 sm:pt-[120px] lg:pt-[140px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />
      <div className="pointer-events-none absolute left-1/2 top-32 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.16),transparent_68%)] blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-16 sm:gap-20">
        <section className="grid items-center gap-10 xl:grid-cols-[minmax(0,1.08fr)_440px] xl:gap-16">
          <div className="max-w-[760px]">
            <div className="inline-flex rounded-full border border-[color:var(--border-color)] bg-[rgba(28,28,30,0.52)] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)] backdrop-blur-xl sm:text-[11px] sm:tracking-[0.24em]">
              {eyebrow}
            </div>
            <h1 className="mt-6 max-w-[12ch] text-[38px] font-semibold leading-[0.96] tracking-[-0.04em] text-[color:var(--text-primary)] sm:max-w-[13ch] sm:text-[58px] md:text-[72px]">
              {title}
            </h1>
            <p className="mt-8 max-w-[640px] text-[17px] leading-8 text-[color:var(--text-secondary)] sm:text-[18px]">
              {description}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/remove-background"
                className="theme-accent-button inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium"
              >
                {primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="theme-secondary-button inline-flex min-h-[52px] items-center justify-center rounded-xl px-6 py-3 text-sm font-medium"
              >
                {secondaryCta}
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[color:var(--text-muted)]">
              <Link className="hover:text-[color:var(--text-primary)]" href="/">
                ImgReady home
              </Link>
              {relatedLinks.map((link) => (
                <Link key={link.href} className="hover:text-[color:var(--text-primary)]" href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="panel rounded-[30px] p-5 sm:p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Workflow</p>
            <div className="mt-5 space-y-4">
              {benefits.slice(0, 3).map((benefit) => (
                <div key={benefit.title} className="rounded-[22px] border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent-primary)]" />
                    <div>
                      <h2 className="text-base font-semibold text-[color:var(--text-primary)]">{benefit.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-secondary)]">{benefit.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="panel rounded-[24px] p-5 sm:rounded-[28px] sm:p-6">
              <h2 className="text-xl font-semibold leading-tight text-[color:var(--text-primary)]">{benefit.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{benefit.description}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="panel rounded-[28px] p-6 md:rounded-[32px] md:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Use case</p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:text-4xl">
              {contentTitle}
            </h2>
            <div className="mt-6 space-y-5 text-sm leading-7 text-[color:var(--text-secondary)]">
              {contentBody.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {contentCards.map((card) => (
              <article key={card.title} className="panel rounded-[24px] p-5">
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">FAQ</p>
            <h2 className="mt-3 text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:text-4xl">
              Common questions
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <article key={faq.question} className="panel rounded-[24px] p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{faq.question}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel rounded-[28px] px-6 py-8 md:rounded-[36px] md:px-12 md:py-12">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Start processing</p>
              <h2 className="mt-3 max-w-[720px] text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:text-4xl">
                Turn product photos into clean, listing-ready images.
              </h2>
              <p className="mt-4 max-w-[680px] text-sm leading-7 text-[color:var(--text-secondary)]">
                Upload your images, process them in ImgReady, and download results that are easier to use across your store, catalog, or marketplace listings.
              </p>
            </div>
            <Link
              href="/remove-background"
              className="theme-accent-button inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium"
            >
              {primaryCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
