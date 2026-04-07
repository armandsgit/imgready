'use client';

interface ImagePreviewProps {
  src: string;
  title: string;
}

export default function ImagePreview({ src, title }: ImagePreviewProps) {
  return (
    <div className="glass-card rounded-xl p-3">
      <p className="mb-2 text-sm text-[color:var(--text-secondary)]">{title}</p>
      <img src={src} alt={title} className="h-56 w-full rounded-lg object-contain" />
    </div>
  );
}
