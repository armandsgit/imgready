import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { prisma } from '@/lib/prisma';

const JOB_RETENTION_DAYS = 30;

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const retentionCutoff = new Date(Date.now() - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await prisma.processingJob.deleteMany({
    where: {
      status: {
        in: ['done', 'failed'],
      },
      finishedAt: {
        lt: retentionCutoff,
      },
    },
  });

  return NextResponse.json({ deletedCount: deleted.count });
}
