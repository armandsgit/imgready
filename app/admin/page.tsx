import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import AdminAnalyticsDashboard from '@/components/AdminAnalyticsDashboard';
import AdminBrandingPanel from '@/components/AdminBrandingPanel';
import AdminSitePagesPanel from '@/components/AdminSitePagesPanel';
import AdminUsersTable, { type AdminUserRecord } from '@/components/AdminUsersTable';
import { getAdminAnalytics } from '@/lib/adminAnalytics';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getBrandingSettings } from '@/lib/branding';
import { prisma } from '@/lib/prisma';
import { getAllSitePages } from '@/lib/sitePages';

export const metadata: Metadata = {
  title: 'Admin',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect('/');
  }

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      email: true,
      role: true,
      plan: true,
      credits: true,
      emailVerified: true,
      subscriptionStatus: true,
      cancelAtPeriodEnd: true,
      planExpiresAt: true,
      processedCount: true,
      createdAt: true,
    },
  });

  const initialUsers: AdminUserRecord[] = users.map((user) => ({
    ...user,
    plan: user.plan as AdminUserRecord['plan'],
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
  const branding = await getBrandingSettings();
  const initialAnalytics = await getAdminAnalytics();
  const sitePages = await getAllSitePages();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[color:var(--bg-secondary)] px-6 py-16">
      <div className="relative mx-auto max-w-[1200px] space-y-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Admin</p>
            <h1 className="text-4xl font-semibold text-[color:var(--text-primary)]">User management</h1>
            <p className="max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">
              Review plans, adjust credits, and manage account access for the internal workspace.
            </p>
          </div>
          <AdminBrandingPanel initialBranding={branding} />
        </div>

        <AdminAnalyticsDashboard initialAnalytics={initialAnalytics} />
        <AdminSitePagesPanel initialPages={sitePages} />

        <div className="grid gap-5 md:grid-cols-3">
          <div className="panel rounded-[28px] p-6">
            <p className="text-sm text-[color:var(--text-muted)]">Users</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">{users.length}</p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Accounts currently in the workspace</p>
          </div>
          <div className="panel rounded-[28px] p-6">
            <p className="text-sm text-[color:var(--text-muted)]">Starter / Pro</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              {users.filter((user) => user.plan !== 'free').length}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Paying users on active monthly plans</p>
          </div>
          <div className="panel rounded-[28px] p-6">
            <p className="text-sm text-[color:var(--text-muted)]">Processed images</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              {users.reduce((sum, user) => sum + user.processedCount, 0)}
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Total successful background removals</p>
          </div>
        </div>
        <AdminUsersTable initialUsers={initialUsers} />
      </div>
    </main>
  );
}
