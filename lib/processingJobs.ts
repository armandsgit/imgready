import { prisma } from '@/lib/prisma';
import { getProcessingCreditCost } from '@/lib/credits';
import type { ProcessingMode } from '@/types';

interface CreateProcessingJobInput {
  userId: string;
  userEmail: string;
  mode: ProcessingMode;
  imagesCount?: number;
  status?: 'queued' | 'processing';
}

export async function createProcessingJob({
  userId,
  userEmail,
  mode,
  imagesCount = 1,
  status = 'queued',
}: CreateProcessingJobInput) {
  return prisma.processingJob.create({
    data: {
      userId,
      userEmail,
      mode,
      imagesCount,
      creditsUsed: getProcessingCreditCost(mode) * imagesCount,
      status,
    },
    select: {
      id: true,
    },
  });
}

export async function markProcessingJobStatus(
  jobId: string,
  status: 'queued' | 'processing' | 'done' | 'failed',
  options?: {
    errorMessage?: string | null;
  }
) {
  const currentJob = await prisma.processingJob.findUnique({
    where: { id: jobId },
    select: {
      startedAt: true,
    },
  });

  if (!currentJob) {
    return;
  }

  const completed = status === 'done' || status === 'failed';
  const finishedAt = completed ? new Date() : null;
  const durationMs = finishedAt ? Math.max(0, finishedAt.getTime() - currentJob.startedAt.getTime()) : null;

  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt,
      durationMs,
      errorMessage: status === 'failed' ? options?.errorMessage ?? 'Unknown error' : null,
    },
  });
}
