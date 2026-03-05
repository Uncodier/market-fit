"use client";

import * as React from "react";
import Image from "next/image";
import { useLocalization } from "@/app/context/LocalizationContext";

export function SupportCarousel() {
  const { t } = useLocalization();
  const logos = [
    { src: "/images/aws_for_startups.avif", alt: "AWS for Startups", style: 'brightness-0 dark:invert opacity-40 group-hover:opacity-100 group-hover:filter-none' },
    { src: "/images/google_for_startups.avif", alt: "Google for Startups", style: 'brightness-0 dark:invert opacity-40 group-hover:opacity-100 group-hover:filter-none' },
    { src: "/images/nvida_inception.svg", alt: "Nvidia Inception", style: 'opacity-60 group-hover:opacity-100 grayscale group-hover:grayscale-0' },
    { src: "/images/microsfot_for_startups.avif", alt: "Microsoft for Startups", style: 'brightness-0 dark:invert opacity-40 group-hover:opacity-100 group-hover:filter-none' },
    { src: "/images/500logo.svg", alt: "500 Global", style: 'brightness-0 dark:invert opacity-40 group-hover:opacity-100 group-hover:filter-none' },
  ];

  // We duplicate the logos array a few times to ensure seamless infinite scrolling
  const duplicatedLogos = [...logos, ...logos, ...logos, ...logos];

  return (
    <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scroll-logos {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(calc(-100% / 4), 0, 0); }
        }
        .animate-scroll-logos { 
          animation: scroll-logos 30s linear infinite; 
          will-change: transform;
        }
      `}} />
      <div className="max-w-7xl mx-auto px-6 lg:px-12 mb-12 flex flex-col items-center text-center">
        <h3 className="text-xl md:text-2xl font-semibold dark:text-white/80 text-slate-700 tracking-tight">
          {t('support.title') || 'Backed by Top Accelerators & Tech Giants'}
        </h3>
        <p className="mt-4 text-base md:text-lg dark:text-white/50 text-slate-500 max-w-2xl font-light">
          {t('support.subtitle') || "We've been recognized by leading startup programs globally"}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="relative w-full overflow-hidden flex items-center py-4 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] group">
          <div className="flex w-max animate-scroll-logos items-center gap-16 md:gap-24 pr-16 md:pr-24 group-hover:[animation-play-state:paused]">
            {duplicatedLogos.map((logo, idx) => (
              <div
                key={idx}
                className="flex items-center justify-center w-[150px] md:w-[180px] h-20 transition-all duration-300 group"
              >
                <Image
                  src={logo.src}
                  alt={logo.alt}
                  width={200}
                  height={80}
                  className={`object-contain max-h-[60px] max-w-full transition-all duration-300 ${logo.style}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
