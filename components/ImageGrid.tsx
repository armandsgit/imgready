'use client';

import ImageCard from './ImageCard';
import type { ImageTask } from '@/types';

interface ImageGridProps {
  items: ImageTask[];
  onRetry?: (item: ImageTask) => void;
  onRefine?: (item: ImageTask) => void;
}

export default function ImageGrid({ items, onRetry, onRefine }: ImageGridProps) {
  if (items.length === 0) {
    return (
      <div className="panel flex min-h-[320px] items-center justify-center rounded-[28px] px-8 py-16 text-center">
        <div className="mx-auto max-w-md">
          <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">No images yet</h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
            Upload your first image to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-stretch grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ImageCard key={item.id} item={item} onRetry={onRetry} onRefine={onRefine} />
      ))}
    </div>
  );
}
