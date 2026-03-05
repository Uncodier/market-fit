"use client";

import * as React from "react";
import { useRef } from "react";
import { useLocalization } from "@/app/context/LocalizationContext";
import Link from "next/link";

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const yPct = (e.clientY - rect.top) / rect.height;
    const rotateX = (0.5 - yPct) * 30;
    const rotateY = (xPct - 0.5) * 30;
    ref.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    ref.current.style.transition = "transform 0.1s ease-out";
    ref.current.style.zIndex = "50";
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
    ref.current.style.transition = "transform 0.5s ease";
    ref.current.style.zIndex = "1";
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
        transition: "transform 0.5s ease",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

export function OpenClawCard() {
  const { t } = useLocalization();

  return (
    <Link href="/product/openclaw" className="block w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2 cursor-pointer">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scroll-x-right {
          0% { transform: translate3d(calc(-100% / 4), 0, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
        .animate-scroll-x-right { 
          animation: scroll-x-right 40s linear infinite;
          will-change: transform;
        }
        @keyframes pan-diagonal-hover-claw {
          0% { background-position: 0px 0px; }
          100% { background-position: 22.627417px 22.627417px; }
        }
      `}} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.08),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_50%)] transition-all duration-500"></div>
      <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.12)_8px,rgba(139,92,246,0.12)_16px)] opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none" style={{ backgroundSize: '22.6274px 22.6274px', animation: 'pan-diagonal-hover-claw 2s linear infinite' }}></div>

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center rounded-full font-inter dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6 transition-transform hover:scale-105 duration-300">
          <span className="w-1.5 h-1.5 rounded-full font-inter font-bold bg-violet-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
          Open Claw
        </div>
        <h2 className="text-2xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight drop-shadow-lg">
          {t('openclaw.title.start') || 'Your team of'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">
            {t('openclaw.title.highlight') || 'virtual employees'}
          </span>
        </h2>
        <p className="dark:text-white/50 text-slate-500 text-sm md:text-base max-w-2xl leading-relaxed mb-8">
          {t('openclaw.subtitle') || 'Deploy specialized AI agents to handle complex tasks across strategy, campaigns, SEO, and operations. Like having an entire department working 24/7.'}
        </p>
      </div>

      <div className="relative z-10 w-full flex-1 min-h-0 overflow-hidden flex items-center [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] md:[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)] transition-transform duration-500 group-hover:scale-[1.02] origin-center group">
        <div className="flex w-max animate-scroll-x-right gap-6 pr-6 group-hover:[animation-play-state:paused] py-5">
          {[1, 2, 3, 4].map((set) => (
            <React.Fragment key={set}>
              <TiltCard className="w-[320px] h-[290px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light flex flex-col group/card transition-colors cursor-pointer overflow-hidden relative">
                <div className="dark:neu-pressed neu-pressed-light p-3 border-b dark:border-white/5 border-black/5 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500">{t('openclaw.agent.strategy.name') || 'Strategy Agent'}</div>
                    <div className="text-xs font-semibold dark:text-white/90 text-slate-500">{t('openclaw.agent.strategy.status') || 'Analyze market fit'}</div>
                  </div>
                </div>
                <div className="flex-1 p-3 relative overflow-hidden bg-gradient-to-b from-transparent to-blue-500/5 rounded-b-2xl">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_60%)]"></div>
                  <div className="relative z-10 flex flex-col h-full gap-2">
                    <div className="text-[10px] dark:text-white/70 text-slate-500 dark:neu-pressed neu-pressed-light p-2 rounded-md border dark:border-white/5 border-black/5 shadow-inner">
                      &quot;{t('openclaw.agent.strategy.prompt') || 'Analyze our current product-market fit and identify the biggest gaps we should address.'}&quot;
                    </div>
                    <div className="flex-1 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 p-2 flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                        <div className="h-1.5 w-12 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                        <div className="h-1.5 w-6 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                      </div>
                      <div className="flex-1 flex items-end gap-1">
                        {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-blue-500/20 rounded-t-sm relative group-hover/card:bg-blue-500/40 transition-colors"
                            style={{ height: `${h}%` }}
                          >
                            <div
                              className="absolute top-0 left-0 w-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
                              style={{ height: "2px" }}
                            ></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TiltCard>

              <TiltCard className="w-[280px] h-[290px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light p-3 flex flex-col group/card transition-colors cursor-pointer relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full font-inter font-bold bg-gradient-to-tr from-green-500 to-emerald-600 p-[2px]">
                    <div className="w-full h-full dark:bg-[#121214] bg-[#ffffff] rounded-full font-inter border dark:border-white/10 border-black/10 flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold dark:text-white/90 text-slate-500">{t('openclaw.agent.growth.name') || 'Growth Agent'}</div>
                    <div className="text-[10px] dark:text-white/40 text-slate-500">{t('openclaw.agent.growth.status') || 'Generating Document...'}</div>
                  </div>
                </div>
                <div className="text-[10px] dark:text-white/80 text-slate-500 font-medium mb-2">{t('openclaw.agent.growth.task') || 'Go-to-market strategy'}</div>
                <div className="w-full flex-1 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 p-2 relative transition-colors overflow-hidden flex flex-col gap-2">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.05),transparent_70%)]"></div>
                  <div className="h-2 w-3/4 dark:neu-skeleton neu-skeleton-light rounded-full font-inter font-bold bg-green-500/20"></div>
                  <div className="space-y-1 mt-1">
                    <div className="h-1 w-full dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                    <div className="h-1 w-[85%] dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1 w-6 dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                    <div className="h-2 w-0.5 bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></div>
                  </div>
                </div>
              </TiltCard>

              <TiltCard className="w-[340px] h-[290px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light flex flex-col group/card transition-colors cursor-pointer overflow-hidden relative">
                <div className="dark:neu-pressed neu-pressed-light p-3 border-b dark:border-white/5 border-black/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center text-purple-400">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-[10px] dark:text-white/50 text-slate-500">{t('openclaw.agent.data.name') || 'Data Agent'}</div>
                      <div className="text-xs font-semibold dark:text-white/90 text-slate-500">{t('openclaw.agent.data.task') || 'Define ICP & Enrich Leads'}</div>
                    </div>
                  </div>
                  <div className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full font-inter font-bold bg-purple-500 animate-pulse"></div>
                    {t('openclaw.agent.data.status') || 'Processing'}
                  </div>
                </div>
                <div className="flex-1 p-0 relative overflow-hidden rounded-md dark:neu-pressed neu-pressed-light m-2 mt-0">
                  <div className="w-full h-full flex flex-col">
                    <div className="grid grid-cols-4 gap-1 px-2 py-1.5 border-b dark:border-white/5 border-black/5 dark:bg-black/40 bg-slate-100">
                      <div className="h-1.5 w-8 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                      <div className="h-1.5 w-10 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                      <div className="h-1.5 w-12 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                      <div className="h-1.5 w-10 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                    </div>
                    {[1, 2].map((row, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-4 gap-1 px-2 py-2 border-b dark:border-white/5 border-black/5 items-center hover:dark:bg-white/[0.02] bg-black/5 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded-full font-inter dark:neu-skeleton neu-skeleton-light shrink-0"></div>
                          <div className="h-1 w-10 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                        </div>
                        <div className="h-1 w-14 dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                        <div className="h-1 w-full dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                        <div className="flex justify-end">
                          {i === 1 ? (
                            <div className="h-3 w-10 bg-purple-500/20 rounded border border-purple-500/30"></div>
                          ) : (
                            <div className="h-3 w-10 bg-emerald-500/20 rounded border border-emerald-500/30"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                    style={{ animation: "scan 3s linear infinite" }}
                  ></div>
                </div>
              </TiltCard>

              <TiltCard className="w-[280px] h-[290px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light p-3 flex flex-col group/card transition-colors cursor-pointer relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05),transparent_70%)]"></div>
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-semibold dark:text-white/90 text-slate-500">{t('openclaw.agent.scraping.name') || 'Scraping Agent'}</div>
                      <div className="text-[10px] dark:text-white/40 text-slate-500">{t('openclaw.agent.scraping.status') || 'Gathering Intelligence...'}</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] dark:text-white/80 text-slate-500 font-medium mb-2 relative z-10">{t('openclaw.agent.scraping.task') || 'SEO strategy & Competitors'}</div>
                <div className="w-full flex-1 rounded-md dark:bg-black/40 bg-slate-50 border dark:border-white/5 border-black/5 flex flex-col overflow-hidden relative z-10">
                  <div className="h-5 dark:bg-white/[0.05] bg-black/10 border-b dark:border-white/5 border-black/5 flex items-center px-2 gap-1">
                    <div className="w-1.5 h-1.5 rounded-full font-inter dark:bg-white/20 bg-black/20"></div>
                    <div className="w-1.5 h-1.5 rounded-full font-inter dark:bg-white/20 bg-black/20"></div>
                    <div className="w-1.5 h-1.5 rounded-full font-inter dark:bg-white/20 bg-black/20"></div>
                    <div className="ml-1.5 h-2 w-1/2 dark:bg-white/5 bg-black/5 rounded-sm"></div>
                  </div>
                  <div className="flex-1 p-2 space-y-2">
                    <div className="flex gap-1.5 items-start">
                      <div className="w-6 h-6 rounded dark:bg-white/5 bg-black/5 shrink-0"></div>
                      <div className="flex-1 space-y-1 mt-0.5">
                        <div className="h-1 w-3/4 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                        <div className="h-1 w-1/2 dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 items-start">
                      <div className="w-6 h-6 rounded dark:bg-white/5 bg-black/5 shrink-0"></div>
                      <div className="flex-1 space-y-1 mt-0.5">
                        <div className="h-1 w-full dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                        <div className="h-1 w-2/3 dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 items-start opacity-50">
                      <div className="w-6 h-6 rounded dark:bg-white/5 bg-black/5 shrink-0"></div>
                      <div className="flex-1 mt-0.5">
                        <div className="h-1 w-4/5 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  <div
                    className="absolute w-full h-8 border-2 border-orange-500/50 bg-orange-500/10 rounded z-20 shadow-[0_0_15px_rgba(249,115,22,0.3)] pointer-events-none"
                    style={{ animation: "float-medium 4s ease-in-out infinite" }}
                  >
                    <div className="absolute -top-2 -right-1.5 text-[8px] bg-orange-500 dark:text-white text-slate-900 px-1 rounded shadow-lg">
                      {t('openclaw.agent.scraping.badge') || 'Extracted'}
                    </div>
                  </div>
                </div>
              </TiltCard>

              <TiltCard className="w-[260px] h-[290px] flex-shrink-0 self-center rounded-lg dark:neu-panel neu-panel-light p-2 flex flex-col group/card transition-colors cursor-pointer relative overflow-hidden">
                <div className="absolute top-2 right-2 z-20 flex items-center gap-1 dark:neu-pressed neu-pressed-light px-2 py-0.5 rounded-full">
                  <div className="w-1 h-1 rounded-full font-sans font-bold bg-pink-500 animate-pulse"></div>
                  <span className="text-[10px] font-semibold dark:text-white/90 text-slate-500">{t('openclaw.agent.marketing.name') || 'Marketing Agent'}</span>
                </div>
                <div className="w-full h-20 rounded-md bg-gradient-to-br from-pink-500/20 to-rose-600/20 border dark:border-white/5 border-black/5 mb-2 relative overflow-hidden flex items-center justify-center">
                  <svg className="w-8 h-8 text-pink-400 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  <div className="absolute bottom-1 left-2 right-2 flex gap-1">
                    <div className="h-0.5 flex-1 dark:bg-white/20 bg-black/20 rounded-full font-inter overflow-hidden">
                      <div className="w-1/3 h-full bg-pink-400"></div>
                    </div>
                    <div className="h-0.5 flex-1 dark:bg-white/20 bg-black/20 rounded-full"></div>
                    <div className="h-0.5 flex-1 dark:bg-white/20 bg-black/20 rounded-full"></div>
                  </div>
                </div>
                <div className="px-2 pb-2 flex-1 flex flex-col">
                  <div className="text-[10px] font-semibold dark:text-white/90 text-slate-500 mb-0.5">{t('openclaw.agent.marketing.task') || 'Ad copy variants'}</div>
                  <div className="text-[10px] dark:text-white/50 text-slate-500 mb-2 line-clamp-2">
                    &quot;{t('openclaw.agent.marketing.prompt') || 'Write 5 ad copy variants for a Facebook ad...'}&quot;
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="p-1.5 rounded dark:bg-white/[0.02] bg-black/5 border dark:border-white/5 border-black/5">
                      <div className="h-1 w-3/4 dark:neu-skeleton neu-skeleton-light rounded-full font-inter mb-1"></div>
                      <div className="h-1 w-full dark:neu-skeleton neu-skeleton-light rounded-full font-inter opacity-70"></div>
                    </div>
                    <div className="p-1.5 rounded dark:neu-pressed neu-pressed-light border border-pink-500/30 relative">
                      <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-pink-500 rounded-full"></div>
                      <div className="h-1 w-2/3 bg-pink-400/50 rounded-full font-sans mb-1"></div>
                      <div className="h-1 w-4/5 dark:bg-white/20 bg-black/20 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </React.Fragment>
          ))}
        </div>
      </div>
    </Link>
  );
}
