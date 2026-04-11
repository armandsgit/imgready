'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc?: string | null;
  processing?: boolean;
  transparentAfter?: boolean;
}

const transparentPreviewBackground = {
  backgroundColor: '#141416',
  backgroundImage:
    'linear-gradient(45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.08) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.08) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.08) 75%)',
  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
  backgroundSize: '20px 20px',
};

export default function BeforeAfterSlider({ beforeSrc, afterSrc, processing = false, transparentAfter = false }: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasAfter = Boolean(afterSrc);

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  function updatePosition(clientX: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const percent = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(clamp(percent, 0, 100));
  }

  function handleDragStart(clientX: number) {
    setIsDragging(true);
    updatePosition(clientX);
  }

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      updatePosition(event.clientX);
    }

    function handleTouchMove(event: TouchEvent) {
      updatePosition(event.touches[0].clientX);
    }

    function stopDragging() {
      setIsDragging(false);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopDragging);
    };
  }, [isDragging]);

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--surface-contrast)] shadow-[0_10px_40px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border-color)] px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">Before / After</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
          {hasAfter ? 'Drag slider' : processing ? 'Processing' : 'Queued'}
        </span>
      </div>

      <div
        ref={containerRef}
        className="theme-slider-stage relative aspect-[4/3] overflow-hidden rounded-b-2xl"
      >
        <div className="absolute inset-0 p-6">
          <div className="relative h-full w-full">
            <img
              src={beforeSrc}
              alt="Before"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
        </div>

        {hasAfter && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)`, willChange: 'clip-path' }}
          >
            <div
              className="theme-slider-after absolute inset-0 p-6"
              style={transparentAfter ? transparentPreviewBackground : undefined}
            >
              <div className="relative h-full w-full">
                <img
                  src={afterSrc ?? ''}
                  alt="After"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
        )}

        {hasAfter && (
          <div className="absolute inset-y-0 z-20" style={{ left: `calc(${sliderPosition}% - 1px)` }}>
            <div className="theme-slider-divider relative h-full w-0.5">
              <button
                type="button"
                onMouseDown={(event) => handleDragStart(event.clientX)}
                onTouchStart={(event) => handleDragStart(event.touches[0].clientX)}
                className="theme-slider-handle absolute left-1/2 top-1/2 z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border text-[10px] font-semibold transition hover:brightness-105"
                aria-label="Drag comparison handle"
              >
                ↔
              </button>
            </div>
          </div>
        )}

        <div className="theme-slider-label absolute left-2 top-2 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
          Before
        </div>
        <div className="theme-slider-label absolute right-2 top-2 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em]">
          {hasAfter ? 'After' : processing ? 'Processing' : 'Queued'}
        </div>

        {!hasAfter && (
          <div className="absolute inset-0 bg-[rgba(11,11,13,0.52)] backdrop-blur-[6px]">
            <div className="absolute inset-0 flex items-center justify-center p-5">
              <div className="w-full max-w-[240px] rounded-[24px] border border-[color:var(--border-color)] bg-[color:var(--panel-bg)] p-5">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border-color)] bg-[color:var(--surface-muted)]">
                    <Loader2 className={`h-5 w-5 ${processing ? 'animate-spin text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}`} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-[color:var(--text-primary)]">
                    {processing ? 'Removing background...' : 'Awaiting result'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {processing ? 'Processing your image' : 'The processed preview will appear here'}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--surface-muted)]">
                    <div className="theme-accent-fill progress-bar h-full w-2/3 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
