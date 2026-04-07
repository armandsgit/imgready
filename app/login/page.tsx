import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import LoginForm from '@/components/LoginForm';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';

interface LoginPageProps {
  searchParams?: {
    registered?: string;
    verified?: string;
    callbackUrl?: string;
    error?: string;
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);

  if (session?.user?.email) {
    redirect(isAdminEmail(session.user.email) ? '/admin' : '/remove-background');
  }

  const registered = searchParams?.registered === '1';
  const verified = searchParams?.verified === '1';
  const callbackUrl = searchParams?.callbackUrl || '/post-auth';
  const authError = searchParams?.error;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--bg-secondary)] px-6 py-20">
      <div className="relative mx-auto w-full max-w-md">
        <LoginForm registered={registered} verified={verified} callbackUrl={callbackUrl} authError={authError} />
      </div>
    </main>
  );
}
