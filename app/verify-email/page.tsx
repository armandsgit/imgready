import Link from 'next/link';
import type { Metadata } from 'next';
import ResendVerificationForm from '@/components/ResendVerificationForm';
import { prisma } from '@/lib/prisma';
import { hashVerificationToken } from '@/lib/emailVerification';

export const metadata: Metadata = {
  title: 'Verify Email',
  robots: {
    index: false,
    follow: false,
  },
};

interface VerifyEmailPageProps {
  searchParams?: {
    token?: string;
  };
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const token = searchParams?.token?.trim();

  let status: 'success' | 'invalid' | 'expired' = 'invalid';

  if (token) {
    const tokenHash = hashVerificationToken(token);
    const verification = await prisma.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (verification) {
      if (verification.expiresAt > new Date()) {
        await prisma.$transaction([
          prisma.user.update({
            where: {
              id: verification.userId,
            },
            data: {
              emailVerified: true,
            },
          }),
          prisma.emailVerificationToken.deleteMany({
            where: {
              userId: verification.userId,
            },
          }),
        ]);
        status = 'success';
      } else {
        await prisma.emailVerificationToken.delete({
          where: {
            tokenHash,
          },
        });
        status = 'expired';
      }
    }
  }

  const copy =
    status === 'success'
      ? {
          title: 'Email verified',
          description: 'Your account is ready. Log in to continue using the app.',
          cta: 'Continue to login',
        }
      : status === 'expired'
        ? {
            title: 'Verification link expired',
            description: 'Request a new verification email from the login screen and try again.',
            cta: 'Back to login',
          }
        : {
            title: 'Invalid verification link',
            description: 'This verification link is not valid. Request a new email from the login page.',
            cta: 'Back to login',
          };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--bg-secondary)] px-6 py-20">
      <div className="relative mx-auto w-full max-w-md">
        <div className="panel rounded-[32px] p-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Verification</p>
          <h1 className="mt-3 text-3xl font-semibold text-[color:var(--text-primary)]">{copy.title}</h1>
          <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{copy.description}</p>
          {status === 'success' ? (
            <Link
              href="/login?verified=1"
              className="theme-accent-button mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-medium"
            >
              {copy.cta}
            </Link>
          ) : (
            <div className="mt-8 space-y-4">
              <ResendVerificationForm buttonLabel="Resend verification email" />
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-5 py-3 text-sm font-medium text-[color:var(--text-primary)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]"
              >
                Back to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
