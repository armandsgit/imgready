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
      <div className="pointer-events-none absolute inset-[-8%] rounded-[28px] bg-[radial-gradient(circle_at_35%_42%,rgba(124,58,237,0.28),transparent_38%),radial-gradient(circle_at_72%_60%,rgba(236,72,153,0.2),transparent_34%)] blur-[40px] sm:inset-[-12%] sm:rounded-[36px] sm:blur-[56px]" />
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.48),0_0_36px_rgba(124,58,237,0.2),0_0_0_1px_rgba(255,255,255,0.05)] sm:rounded-[24px] sm:shadow-[0_40px_80px_rgba(0,0,0,0.6),0_0_60px_rgba(124,58,237,0.25),0_0_0_1px_rgba(255,255,255,0.05)]">
        <div className="relative aspect-[1.02/1] w-full overflow-hidden rounded-[20px] bg-[rgba(20,20,24,0.72)] sm:aspect-[1.08/1] sm:rounded-[24px]">
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
