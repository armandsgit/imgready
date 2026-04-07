import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { markProcessingJobStatus } from '@/lib/processingJobs';

interface CompleteProcessJobBody {
  jobId?: string;
  status?: 'done' | 'failed';
  errorMessage?: string | null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as CompleteProcessJobBody;

  if (!body.jobId || (body.status !== 'done' && body.status !== 'failed')) {
    return NextResponse.json({ error: 'Invalid job payload.' }, { status: 400 });
  }

  const job = await prisma.processingJob.findUnique({
    where: { id: body.jobId },
    select: { userId: true },
  });

  if (!job || job.userId !== session.user.id) {
    return NextResponse.json({ error: 'Processing job not found.' }, { status: 404 });
  }

  await markProcessingJobStatus(body.jobId, body.status, {
    errorMessage: body.errorMessage,
  });

  return NextResponse.json({ success: true });
}
