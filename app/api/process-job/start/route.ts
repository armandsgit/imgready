import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createProcessingJob } from '@/lib/processingJobs';
import type { ProcessingMode } from '@/types';

interface StartProcessJobBody {
  mode?: ProcessingMode;
  imagesCount?: number;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as StartProcessJobBody;
  const mode: ProcessingMode = body.mode === 'optimize-only' ? 'optimize-only' : 'remove-background';
  const imagesCount = typeof body.imagesCount === 'number' && Number.isFinite(body.imagesCount) ? Math.max(1, Math.trunc(body.imagesCount)) : 1;

  const job = await createProcessingJob({
    userId: session.user.id,
    userEmail: user.email,
    mode,
    imagesCount,
    status: 'processing',
  });

  return NextResponse.json({ jobId: job.id });
}
