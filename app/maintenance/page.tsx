import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Maintenance',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-[#111014] px-6 py-24 text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center rounded-[32px] border border-white/10 bg-white/[0.03] px-8 py-16 text-center shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
        <div className="mb-4 rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
          Maintenance Mode
        </div>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          ImgReady is temporarily unavailable while we finish final checks.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
          The app will be back shortly. If you already have private access, open your maintenance bypass link to
          continue using the site.
        </p>
      </div>
    </main>
  );
}
