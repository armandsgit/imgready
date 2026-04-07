import { prisma } from '@/lib/prisma';
import { getImageBackendEndpoint } from '@/lib/backendConfig';

export interface AdminSystemMetrics {
  cpuPercent: number | null;
  ramPercent: number | null;
  diskPercent: number | null;
  uptime: number | null;
  activeProcesses: number | null;
}

export interface AdminRecentJob {
  id: string;
  userId: string;
  userEmail: string;
  mode: string;
  imagesCount: number;
  creditsUsed: number;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
}

export interface AdminAnalyticsPayload {
  stats: {
    activeJobsNow: number;
    imagesProcessedToday: number;
    averageProcessingTimeMs: number | null;
    failedJobsToday: number;
    queueSize: number;
    processedImagesLast24h: number;
  };
  system: AdminSystemMetrics;
  jobs: AdminRecentJob[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

interface GetAdminAnalyticsOptions {
  status?: string;
  mode?: string;
  search?: string;
  take?: number;
  offset?: number;
}

const JOB_RETENTION_DAYS = 30;

async function getSystemMetrics(): Promise<AdminSystemMetrics> {
  try {
    const response = await fetch(getImageBackendEndpoint('/admin/system-metrics'), {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`System metrics request failed with ${response.status}`);
    }

    const payload = (await response.json()) as AdminSystemMetrics;
    return {
      cpuPercent: payload.cpuPercent ?? null,
      ramPercent: payload.ramPercent ?? null,
      diskPercent: payload.diskPercent ?? null,
      uptime: payload.uptime ?? null,
      activeProcesses: payload.activeProcesses ?? null,
    };
  } catch {
    return {
      cpuPercent: null,
      ramPercent: null,
      diskPercent: null,
      uptime: null,
      activeProcesses: null,
    };
  }
}

export async function getAdminAnalytics({
  status = 'all',
  mode = 'all',
  search = '',
  take = 10,
  offset = 0,
}: GetAdminAnalyticsOptions = {}): Promise<AdminAnalyticsPayload> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const retentionCutoff = new Date(now.getTime() - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.processingJob.deleteMany({
    where: {
      status: {
        in: ['done', 'failed'],
      },
      finishedAt: {
        lt: retentionCutoff,
      },
    },
  });

  const searchTerm = search.trim().toLowerCase();
  const filters = {
    ...(status !== 'all' ? { status } : {}),
    ...(mode !== 'all' ? { mode } : {}),
    ...(searchTerm
      ? {
          userEmail: {
            contains: searchTerm,
          },
        }
      : {}),
  };

  const [activeJobsNow, queueSize, failedJobsToday, completedTodayAgg, completedLast24hAgg, averageDurationAgg, totalJobs, jobs, system] =
    await Promise.all([
      prisma.processingJob.count({
        where: {
          status: {
            in: ['queued', 'processing'],
          },
        },
      }),
      prisma.processingJob.count({
        where: {
          status: 'queued',
        },
      }),
      prisma.processingJob.count({
        where: {
          status: 'failed',
          finishedAt: {
            gte: startOfDay,
          },
        },
      }),
      prisma.processingJob.aggregate({
        where: {
          status: 'done',
          finishedAt: {
            gte: startOfDay,
          },
        },
        _sum: {
          imagesCount: true,
        },
      }),
      prisma.processingJob.aggregate({
        where: {
          status: 'done',
          finishedAt: {
            gte: last24Hours,
          },
        },
        _sum: {
          imagesCount: true,
        },
      }),
      prisma.processingJob.aggregate({
        where: {
          status: 'done',
          finishedAt: {
            gte: startOfDay,
          },
          durationMs: {
            not: null,
          },
        },
        _avg: {
          durationMs: true,
        },
      }),
      prisma.processingJob.count({
        where: filters,
      }),
      prisma.processingJob.findMany({
        where: filters,
        orderBy: {
          startedAt: 'desc',
        },
        take,
        skip: offset,
        select: {
          id: true,
          userId: true,
          userEmail: true,
          mode: true,
          imagesCount: true,
          creditsUsed: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          errorMessage: true,
        },
      }),
      getSystemMetrics(),
    ]);

  return {
    stats: {
      activeJobsNow,
      imagesProcessedToday: completedTodayAgg._sum.imagesCount ?? 0,
      averageProcessingTimeMs:
        typeof averageDurationAgg._avg.durationMs === 'number'
          ? Math.round(averageDurationAgg._avg.durationMs)
          : null,
      failedJobsToday,
      queueSize,
      processedImagesLast24h: completedLast24hAgg._sum.imagesCount ?? 0,
    },
    system,
    jobs: jobs.map((job) => ({
      ...job,
      startedAt: job.startedAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
    })),
    pagination: {
      limit: take,
      offset,
      total: totalJobs,
      hasMore: offset + jobs.length < totalJobs,
    },
  };
}
