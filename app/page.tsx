import Link from 'next/link';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { ArrowRight, Download, Upload, Zap } from 'lucide-react';
import HeroPreviewCarousel from '@/components/HeroPreviewCarousel';
import { authOptions } from '@/lib/auth';
import { ensureUserPlanValidity } from '@/lib/billing';
import { getBrandingSettings } from '@/lib/branding';
import { formatCredits, getPlanName } from '@/lib/plans';
import { prisma } from '@/lib/prisma';

const benefits = [
  {
    title: 'White background images',
    description: 'Create clean product photos that look consistent across listings and storefronts.',
  },
  {
    title: 'Automatically centered products',
    description: 'Keep the subject balanced in-frame without manual editing or alignment work.',
  },
  {
    title: 'Optimized image size',
    description: 'Export lightweight images that load fast and stay consistent across your store.',
  },
  {
    title: 'Faster product listing workflow',
    description: 'Turn raw photos into ready-to-upload assets in seconds instead of editing each image by hand.',
  },
] as const;

const steps = [
  {
    title: 'Upload images',
    description: 'Add product photos from your device and start processing in one step.',
    icon: Upload,
  },
  {
    title: 'Automatically process images',
    description: 'Remove backgrounds, center products, and optimize image size automatically.',
    icon: Zap,
  },
  {
    title: 'Download listing-ready results',
    description: 'Export polished product images that are ready for your store, marketplace, or catalog.',
    icon: Download,
  },
] as const;

export const metadata: Metadata = {
  title: 'ImgReady — AI Product Image Tool',
};

export default async function HomePage() {
  const branding = await getBrandingSettings();
  const session = await getServerSession(authOptions);
  let account: { credits: number; plan: string } | null = null;

  if (session?.user?.id) {
    await ensureUserPlanValidity(session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        credits: true,
        plan: true,
      },
    });

    if (user) {
      account = user;
    }
  }

  const isLoggedIn = Boolean(account);
  const currentCredits = account?.credits ?? 0;
  const currentPlanName = getPlanName(account?.plan ?? 'free');
  const primaryHeroHref = isLoggedIn ? '/remove-background' : '/register';
  const primaryHeroLabel = isLoggedIn ? 'Upload images' : 'Start free';

  return (
    <main className="relative min-h-screen overflow-hidden px-5 pb-20 pt-[92px] text-[color:var(--text-primary)] sm:px-6 sm:pb-24 sm:pt-[120px] lg:pt-[140px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1180px] flex-col gap-20 sm:gap-24 lg:gap-28">
        <section className="grid items-center gap-12 py-2 sm:gap-16 sm:py-4 xl:grid-cols-[minmax(0,1.08fr)_500px] xl:gap-20 xl:py-8">
          <div className="max-w-[660px]">
            <div className="inline-flex rounded-full border border-[color:var(--border-color)] bg-[rgba(28,28,30,0.52)] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)] backdrop-blur-xl sm:text-[11px] sm:tracking-[0.24em]">
              Listing-ready images
            </div>
            <h1 className="mt-5 max-w-[12ch] text-[34px] font-semibold leading-[0.94] tracking-[-0.04em] text-[color:var(--text-primary)] sm:mt-6 sm:max-w-none sm:text-[56px] sm:tracking-tight md:text-[74px]">
              {isLoggedIn ? 'Process your product images' : 'Make your product images look like Amazon listings in seconds'}
            </h1>
            <p className="mt-8 max-w-[580px] text-[17px] leading-7 text-[color:var(--text-secondary)] sm:mt-10 sm:text-[18px] sm:leading-8 lg:mt-12">
              {isLoggedIn
                ? 'Upload images and get clean, optimized, listing-ready results.'
                : 'Remove backgrounds, center products, and optimize images for fast-loading, clean product listings.'}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row lg:mt-14">
              <Link
                href={primaryHeroHref}
                className="theme-accent-button inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium"
              >
                {primaryHeroLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!isLoggedIn && (
                <Link
                  href="/pricing"
                  className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium"
                >
                  View pricing
                </Link>
              )}
            </div>
            {!isLoggedIn && (
              <p className="mt-4 text-sm font-medium text-[color:var(--accent-primary)]">
                10 free credits. No credit card required.
              </p>
            )}
            {isLoggedIn && (
              <p className="mt-4 text-sm text-[color:var(--text-muted)]">No setup required · Instant results</p>
            )}

            <div className="mt-10 space-y-3 text-sm text-[color:var(--text-secondary)] sm:mt-12 lg:mt-14">
              {!isLoggedIn && (
                <div className="space-y-2 text-[color:var(--text-muted)]">
                  <div className="flex flex-col gap-y-1.5 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
                    <div className="flex items-center gap-2">White background</div>
                    <div className="flex items-center gap-2">Centered products</div>
                    <div className="flex items-center gap-2">Web-optimized images</div>
                  </div>
                  <div className="text-sm text-[color:var(--text-muted)]/80">1 image = 1 credit · No subscription required</div>
                </div>
              )}
              <div className={isLoggedIn ? 'space-y-1.5' : 'hidden'}>
                {isLoggedIn ? (
                  <>
                    <div className="text-base font-medium text-[color:var(--text-primary)]">{`${formatCredits(currentCredits)} credits available`}</div>
                    <div className="text-sm text-[color:var(--text-muted)]">{`${currentPlanName} plan`}</div>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex justify-center xl:justify-end">
            <HeroPreviewCarousel heroImage={branding.heroImage} heroImageAlt={branding.heroImageAlt} isLoggedIn={isLoggedIn} />
          </div>
        </section>

        {!isLoggedIn && (
          <section className="space-y-6 sm:space-y-8">
            <div className="max-w-[760px]">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Benefits</p>
              <h2 className="mt-3 max-w-[14ch] text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:max-w-none md:text-4xl">
                Everything you need to create clean product images for listings
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {benefits.map((benefit) => (
                <article key={benefit.title} className="panel rounded-[24px] p-5 sm:rounded-[28px] sm:p-6">
                  <h3 className="text-[22px] font-semibold leading-tight text-[color:var(--text-primary)] sm:text-xl">{benefit.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{benefit.description}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-6 sm:space-y-8">
          <div className="max-w-[720px]">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">How it works</p>
            <h2 className="mt-3 max-w-[14ch] text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:max-w-none md:text-4xl">
              A simple workflow for listing-ready product images
            </h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article key={step.title} className="panel rounded-[24px] p-6 sm:rounded-[28px] sm:p-7">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Step {index + 1}</p>
                  <div className="mt-4 inline-flex rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[22px] font-semibold leading-tight text-[color:var(--text-primary)] sm:text-2xl">{step.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{step.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        {!isLoggedIn && (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="panel rounded-[28px] p-6 md:rounded-[32px] md:p-10">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Why ImgReady</p>
                <h2 className="mt-3 max-w-[14ch] text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:max-w-none md:text-4xl">
                  Built for sellers who need clean, consistent product images fast
                </h2>
                <p className="mt-4 max-w-[680px] text-sm leading-7 text-[color:var(--text-secondary)]">
                  ImgReady helps you remove busy backgrounds, standardize framing, and prepare product images that look ready to publish.
                </p>
              </div>

              <div className="panel rounded-[28px] p-6 md:rounded-[32px] md:p-8">
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Pricing preview</p>
                <h3 className="mt-3 text-[30px] font-semibold leading-tight text-[color:var(--text-primary)] sm:text-3xl">Start free, scale as you need</h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">1 image = 1 credit</p>
                <p className="mt-2 text-sm font-medium text-[color:var(--accent-primary)]">Free plan starts without a credit card.</p>

                <div className="mt-8 space-y-3">
                  <div className="rounded-[22px] border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-5 py-4">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">Free</p>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Get started with image credits for product photo processing, no card required.</p>
                  </div>
                  <div className="rounded-[22px] border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] px-5 py-4">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">Starter / Pro</p>
                    <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Upgrade when you need more monthly volume and faster throughput.</p>
                  </div>
                </div>

                <Link
                  href="/pricing"
                  className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[color:var(--text-primary)] hover:text-[color:var(--accent-hover)]"
                >
                  View pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            <section className="panel rounded-[28px] px-6 py-8 md:rounded-[36px] md:px-12 md:py-12">
              <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:justify-between">
                <div className="max-w-[720px]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Get started</p>
                  <h2 className="mt-3 max-w-[14ch] text-[32px] font-semibold leading-tight text-[color:var(--text-primary)] md:max-w-none md:text-4xl">
                    Start creating listing-ready product images
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">
                    Remove backgrounds, center products, and get fast-loading, clean product images ready for your store.
                  </p>
                  <p className="mt-2 text-sm font-medium text-[color:var(--accent-primary)]">Start free with 10 credits. No credit card required.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href={primaryHeroHref}
                    className="theme-accent-button inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-medium"
                  >
                    Start free
                  </Link>
                  <Link
                    href="/pricing"
                    className="theme-secondary-button inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium"
                  >
                    View pricing
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
