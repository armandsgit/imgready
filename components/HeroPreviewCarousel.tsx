'use client';

import Image from 'next/image';

interface HeroPreviewCarouselProps {
  heroImage: string;
  heroImageAlt: string;
  isLoggedIn: boolean;
}

export default function HeroPreviewCarousel({ heroImage, heroImageAlt }: HeroPreviewCarouselProps) {
  return (
    <div className="relative mx-auto w-full max-w-[540px]">
      <div className="pointer-events-none absolute inset-[-12%] rounded-[36px] bg-[radial-gradient(circle_at_35%_42%,rgba(124,58,237,0.28),transparent_38%),radial-gradient(circle_at_72%_60%,rgba(236,72,153,0.2),transparent_34%)] blur-[56px]" />
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] shadow-[0_40px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(124,58,237,0.25),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="relative aspect-[1.08/1] w-full overflow-hidden rounded-[24px] bg-[rgba(20,20,24,0.72)]">
          <Image
            src={heroImage}
            alt={heroImageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 1279px) 100vw, 540px"
            priority
          />
        </div>
      </div>
    </div>
  );
}
