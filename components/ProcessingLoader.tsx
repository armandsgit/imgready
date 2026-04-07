'use client';

import { Loader2 } from 'lucide-react';

interface ProcessingLoaderProps {
  stage: 'uploading' | 'processing';
  detail?: string;
}

export default function ProcessingLoader({ stage, detail }: ProcessingLoaderProps) {
  return (
    <div className="panel rounded-[28px] p-4 text-[color:var(--text-primary)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--border-color)] bg-[color:var(--surface-muted)]">
        <Loader2 className="h-4.5 w-4.5 animate-spin text-accent" />
        </div>
        <div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">{stage === 'uploading' ? 'Preparing uploads' : 'Removing backgrounds'}</p>
          {detail && <p className="text-sm text-[color:var(--text-secondary)]">{detail}</p>}
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
        <div className="theme-accent-fill progress-bar h-full w-2/3 rounded-full" />
      </div>
    </div>
  );
}
