'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Cpu, HardDrive, ImageIcon, Search, ServerCrash, TimerReset } from 'lucide-react';
import type { AdminAnalyticsPayload, AdminRecentJob } from '@/lib/adminAnalytics';

interface AdminAnalyticsDashboardProps {
  initialAnalytics: AdminAnalyticsPayload;
}

function formatDuration(durationMs: number | null) {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) {
    return '—';
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(durationMs >= 10000 ? 0 : 1)} s`;
}

function formatPercent(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(0)}%` : '—';
}

function formatUptime(seconds: number | null) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
    return '—';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatCreditsUsed(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function statusClasses(status: string) {
  switch (status) {
    case 'done':
      return 'border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)] text-[color:var(--status-success-text)]';
    case 'failed':
      return 'border-[color:var(--status-error-border)] bg-[color:var(--status-error-bg)] text-[color:var(--status-error-text)]';
    case 'processing':
      return 'border-[color:var(--status-info-border)] bg-[color:var(--status-info-bg)] text-[color:var(--status-info-text)]';
    default:
      return 'border-[color:var(--border-color)] bg-[color:var(--surface-muted)] text-[color:var(--text-secondary)]';
  }
}

function modeLabel(mode: string) {
  return mode === 'optimize-only' ? 'Optimize only' : 'Remove background';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function AdminAnalyticsDashboard({ initialAnalytics }: AdminAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'processing' | 'done' | 'failed'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'remove-background' | 'optimize-only'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics(reset = true, nextOffset = 0) {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          status: statusFilter,
          mode: modeFilter,
          search,
          limit: '10',
          offset: `${nextOffset}`,
        });
        const response = await fetch(`/api/admin/analytics?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to load analytics');
        }

        const payload = (await response.json()) as AdminAnalyticsPayload;
        if (!cancelled) {
          setAnalytics((current) =>
            reset || nextOffset === 0
              ? payload
              : {
                  ...payload,
                  jobs: [...current.jobs, ...payload.jobs],
                }
          );
        }
      } catch {
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics(true, 0);
    const intervalId = window.setInterval(() => {
      void loadAnalytics(true);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [modeFilter, search, statusFilter]);

  async function handleLoadMore() {
    if (!analytics.pagination.hasMore || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        mode: modeFilter,
        search,
        limit: '10',
        offset: `${analytics.jobs.length}`,
      });
      const response = await fetch(`/api/admin/analytics?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load more jobs');
      }

      const payload = (await response.json()) as AdminAnalyticsPayload;
      setAnalytics((current) => ({
        ...payload,
        jobs: [...current.jobs, ...payload.jobs],
      }));
    } catch {
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleClearOldJobs() {
    setCleanupMessage(null);

    const response = await fetch('/api/admin/jobs/cleanup', {
      method: 'POST',
    });

    const payload = (await response.json()) as { deletedCount?: number; error?: string };
    if (!response.ok) {
      setCleanupMessage(payload.error || 'Could not clear old jobs.');
      return;
    }

    setCleanupMessage(`Cleared ${payload.deletedCount ?? 0} old jobs.`);
    const refreshResponse = await fetch('/api/admin/analytics?limit=10&offset=0', {
      cache: 'no-store',
    });
    if (refreshResponse.ok) {
      const refreshedPayload = (await refreshResponse.json()) as AdminAnalyticsPayload;
      setAnalytics(refreshedPayload);
    }
  }

  const statCards = useMemo(
    () => [
      {
        label: 'Active jobs now',
        value: `${analytics.stats.activeJobsNow}`,
        helper: `${analytics.stats.queueSize} queued`,
        icon: Activity,
      },
      {
        label: 'Images processed today',
        value: `${analytics.stats.imagesProcessedToday}`,
        helper: `${analytics.stats.processedImagesLast24h} in last 24h`,
        icon: ImageIcon,
      },
      {
        label: 'Average processing time',
        value: formatDuration(analytics.stats.averageProcessingTimeMs),
        helper: 'Successful jobs today',
        icon: Clock3,
      },
      {
        label: 'Failed jobs today',
        value: `${analytics.stats.failedJobsToday}`,
        helper: 'Errors needing attention',
        icon: ServerCrash,
      },
      {
        label: 'CPU usage',
        value: formatPercent(analytics.system.cpuPercent),
        helper: `Uptime ${formatUptime(analytics.system.uptime)}`,
        icon: Cpu,
      },
      {
        label: 'RAM usage',
        value: formatPercent(analytics.system.ramPercent),
        helper: `Disk ${formatPercent(analytics.system.diskPercent)}`,
        icon: HardDrive,
      },
    ],
    [analytics]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="panel rounded-[28px] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[color:var(--text-muted)]">{card.label}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-[color:var(--text-primary)]">{card.value}</p>
                  <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{card.helper}</p>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] p-3 text-[color:var(--accent-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Processing activity</p>
            <h2 className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">Recent jobs</h2>
            <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
              Monitor current load, recent jobs, and failures without leaving admin.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
            <button
              type="button"
              onClick={() => void handleClearOldJobs()}
              className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
            >
              Clear old jobs
            </button>
            <TimerReset className="h-4 w-4" />
            {loading ? 'Refreshing…' : 'Refreshes every 15s'}
          </div>
        </div>
        {cleanupMessage ? <p className="mt-3 text-sm text-[color:var(--text-secondary)]">{cleanupMessage}</p> : null}

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by user email"
              className="w-full rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] py-2 pl-10 pr-4 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
          >
            <option value="all">All statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
          </select>

          <select
            value={modeFilter}
            onChange={(event) => setModeFilter(event.target.value as typeof modeFilter)}
            className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--accent-primary)]"
          >
            <option value="all">All modes</option>
            <option value="remove-background">Remove background</option>
            <option value="optimize-only">Optimize only</option>
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-[color:var(--border-color)]">
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-color)]">
              <thead className="sticky top-0 z-10 bg-[color:var(--surface-muted)]/95 backdrop-blur-xl">
                <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                  <th className="px-5 py-4 font-medium">User</th>
                  <th className="px-5 py-4 font-medium">Mode</th>
                  <th className="px-5 py-4 font-medium">Images</th>
                  <th className="px-5 py-4 font-medium">Credits used</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Duration</th>
                  <th className="px-5 py-4 font-medium">Created at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-color)] bg-[color:var(--panel-bg)]">
                {analytics.jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-sm text-[color:var(--text-secondary)]">
                      No processing jobs found for the current filters.
                    </td>
                  </tr>
                ) : (
                  analytics.jobs.map((job: AdminRecentJob) => (
                    <tr key={job.id} className="align-top">
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[color:var(--text-primary)]">{job.userEmail}</p>
                          {job.errorMessage ? <p className="text-xs text-[color:var(--status-error-text)]">{job.errorMessage}</p> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-[color:var(--text-secondary)]">{modeLabel(job.mode)}</td>
                      <td className="px-5 py-4 text-sm text-[color:var(--text-primary)]">{job.imagesCount}</td>
                      <td className="px-5 py-4 text-sm text-[color:var(--text-primary)]">{formatCreditsUsed(job.creditsUsed)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${statusClasses(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-[color:var(--text-secondary)]">{formatDuration(job.durationMs)}</td>
                      <td className="px-5 py-4 text-sm text-[color:var(--text-secondary)]">{formatDateTime(job.startedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {analytics.pagination.hasMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => void handleLoadMore()}
              disabled={isLoadingMore}
              className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
