import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { getAdminAnalytics } from '@/lib/adminAnalytics';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '10') || 10));
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0') || 0);
  const analytics = await getAdminAnalytics({
    status: searchParams.get('status') ?? 'all',
    mode: searchParams.get('mode') ?? 'all',
    search: searchParams.get('search') ?? '',
    take: limit,
    offset,
  });

  return NextResponse.json(analytics);
}
