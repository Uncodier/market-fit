"use client"

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { OpenClawCard } from "./sections/OpenClawCard";
import { FeaturesStages } from "./sections/FeaturesStages";
import { MockupSlider } from "./sections/MockupSlider";
import { PricingSection } from "./sections/PricingSection";
import { SupportCarousel } from "./sections/SupportCarousel";
import { ContentCarousel } from "./sections/ContentCarousel";
import { SiteFooter } from "./sections/SiteFooter";
import { useLocalization } from "../../context/LocalizationContext";

// Hook for scroll animations
function useIntersectionObserver(options: IntersectionObserverInit = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        if (ref.current) observer.unobserve(ref.current);
      }
    }, options);

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting] as const;
}

function Reveal({ 
  children, 
  delay = 0, 
  direction = "up", 
  className = ""
}: { 
  children: React.ReactNode, 
  delay?: number, 
  direction?: "up" | "down" | "left" | "right" | "none", 
  className?: string
}) {
  const [ref, isVisible] = useIntersectionObserver();
  
  const getTransform = () => {
    if (direction === "up") return "translateY(40px)";
    if (direction === "down") return "translateY(-40px)";
    if (direction === "left") return "translateX(40px)";
    if (direction === "right") return "translateX(-40px)";
    return "translate(0)";
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translate(0)" : getTransform(),
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

function TiltCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate rotation (-15 to 15 degrees)
    const xPct = x / rect.width;
    const yPct = y / rect.height;
    const rotateX = (0.5 - yPct) * 30; // max 15 deg
    const rotateY = (xPct - 0.5) * 30; // max 15 deg

    ref.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    ref.current.style.transition = 'transform 0.1s ease-out';
    ref.current.style.zIndex = '50';
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    ref.current.style.transition = 'transform 0.5s ease';
    ref.current.style.zIndex = '1';
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)', transition: 'transform 0.5s ease' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
}

export function LandingSections() {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState("npm");
  const [particles, setParticles] = useState<{top: string, left: string, delay: string, opacity: number}[]>([]);

  useEffect(() => {
    setParticles(
      [...Array(30)].map(() => ({
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        opacity: Math.random() * 0.4 + 0.1
      }))
    );
  }, []);

  const initCommands: Record<string, string> = {
    npm: "npx @makinari/cli init",
    yarn: "yarn dlx @makinari/cli init",
    pnpm: "pnpm dlx @makinari/cli init",
    bun: "bunx @makinari/cli init",
    docker: "docker run -p 3000:3000 makinari/server:latest"
  };

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden">
      {/* 1. Full-width Main Feature (Revenue Operations Platform) */}
      <section className="relative w-full pt-32 pb-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        {/* Ambient Glows & Retro-futuristic Op-art Accents - Removed to avoid page change effect */}
        {/* <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] md:w-[1000px] md:h-[1000px] bg-violet-600/10 rounded-full blur-[100px] md:blur-[120px] opacity-60 mix-blend-screen pointer-events-none animate-pulse-slow"></div> */}
        
        {/* Glow behind title text for readability */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] md:w-[1000px] md:h-[500px] bg-white dark:bg-transparent rounded-full blur-[100px] md:blur-[120px] opacity-100 pointer-events-none"></div>
        
        {/* Concentric lines pattern (Mexico 68 inspired) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] opacity-[0.05] pointer-events-none [mask-image:radial-gradient(circle_at_center,black_20%,transparent_70%)] flex items-center justify-center">
          <div className="absolute w-[200%] h-[200%] dark:bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_8px,white_8px,white_16px)] bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_8px,black_8px,black_16px)] animate-wave-outward"></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 transition-transform hover:scale-105 duration-300">
              <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
              {t('virtual.badge') || 'RevOps'}
            </div>
          </Reveal>
          
          <Reveal delay={100}>
            <h2 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-8 leading-[1.05] drop-shadow-2xl">
              <span className="text-black dark:text-white">
                {t('virtual.title.start') || 'Revenue '}
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-violet-600 via-fuchsia-500 to-indigo-600 dark:from-violet-400 dark:via-fuchsia-300 dark:to-indigo-500">
                {t('virtual.title.highlight') || 'Operations Platform'}
              </span>
            </h2>
          </Reveal>
          
          <Reveal delay={200}>
            <p className="text-lg md:text-2xl dark:text-white/50 text-slate-500 max-w-3xl font-light leading-relaxed mb-16 tracking-wide drop-shadow-sm">
              {t('virtual.subtitle') || 'Automate your entire sales process with AI agents that work 24/7. From lead generation to closing deals, our virtual employees handle it all.'}
            </p>
          </Reveal>

          {/* Mockup Slider */}
          <Reveal delay={300} className="w-full">
            <MockupSlider />
          </Reveal>
        </div>
      </section>

      {/* Feature Stages Table & Individual Sections */}
      <FeaturesStages />

      {/* Full Width: Automatic Content Generation */}
      <Reveal delay={0} className="w-full">
        <ContentCarousel showBuilders={false} />
      </Reveal>

      {/* Bento Grid Layout for remaining features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                {t('landing.scale.title.start') || 'Everything you need to'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">{t('landing.scale.title.highlight') || 'scale'}</span>
              </h2>
              <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                {t('landing.scale.subtitle') || 'A complete suite of tools integrated into one seamless platform. No more duct-taping disjointed software.'}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:[grid-template-rows:700px] auto-rows-[minmax(450px,auto)]">

            {/* Open Claw: Virtual Employees (Full width, 700px on desktop = 200px less) */}
            <Reveal delay={50} className="md:col-span-2 lg:col-span-3 h-full min-h-[650px] lg:min-h-0">
              <OpenClawCard />
            </Reveal>

            {/* Bento 1: Outbound (Span 2) */}
            <Reveal delay={100} className="lg:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_50%)]"></div>
                {/* Retro-futuristic diagonal lines */}
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(249,115,22,0.1)_8px,rgba(249,115,22,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(249,115,22,0.05)_8px,rgba(249,115,22,0.05)_16px)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pan-diagonal-fast"></div>
                
                {/* Radar and shooting lines */}
                <div className="absolute right-[-100px] bottom-[-100px] w-[500px] h-[500px] pointer-events-none opacity-40 dark:mix-blend-screen mix-blend-multiply transition-opacity duration-500 group-hover:opacity-60 [mask-image:radial-gradient(circle_at_center,black_30%,transparent_70%)]">
                  <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] animate-spin-super-slow" viewBox="0 0 1000 1000">
                    <defs>
                      <linearGradient id="outbound-line-bento" x1="50%" y1="50%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <g className="opacity-80">
                      {[...Array(12)].map((_, i) => (
                        <line 
                          key={i}
                          x1="500" y1="500" 
                          x2={(500 + Math.cos(i * 30 * Math.PI / 180) * 400).toFixed(4)} 
                          y2={(500 + Math.sin(i * 30 * Math.PI / 180) * 400).toFixed(4)}
                          stroke="url(#outbound-line-bento)" 
                          strokeWidth="2.5"
                          strokeDasharray="4 16"
                          className="animate-pulse"
                          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '2s' }}
                        />
                      ))}
                    </g>
                  </svg>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-orange-500/30 rounded-full animate-radar-ping"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border dark:border-white/[0.05] border-black/10 rounded-full"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border dark:border-white/[0.03] border-black/5 rounded-full"></div>
                </div>

                <div className="relative z-10 max-w-sm">
                  <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-2 shadow-[0_0_8px_rgba(249,115,22,0.8)]"></span>
                    {t('landing.outbound.badge') || 'Massive Scale'}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('landing.outbound.title') || 'Outbound ready system'}</h3>
                  <p className="dark:text-white/50 text-slate-500 leading-relaxed text-sm md:text-base">
                    {t('landing.outbound.subtitle') || 'Launch campaigns in minutes. Reach thousands of prospects across multiple channels with personalized messages at scale, without hitting spam limits.'}
                  </p>
                </div>

                {/* Floating Card 1: Active Campaigns */}
                <div className="absolute hidden md:block right-[5%] top-[15%] w-56 rounded-lg border dark:border-white/[0.08] border-black/10 dark:bg-[#121214]/90 bg-white/90 backdrop-blur-2xl p-5 shadow-2xl animate-float-medium transition-transform group-hover:scale-105 group-hover:-translate-y-2 group-hover:rotate-1 font-inter z-20">
                  <div className="flex justify-between items-center mb-4">
                    <div className="dark:text-white/40 text-slate-500 text-[10px] uppercase tracking-wider font-semibold">Active Campaigns</div>
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { color: 'bg-orange-500/20 text-orange-400', width: 'w-full', icon: <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
                      { color: 'bg-green-500/20 text-green-400', width: 'w-4/5', icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> },
                      { color: 'bg-[#0077b5]/20 text-[#0077b5]', width: 'w-[85%]', icon: <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg> }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${item.color}`}>
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <div className={`h-1.5 ${item.width} dark:neu-skeleton neu-skeleton-light rounded mb-1`}></div>
                          <div className="h-1 w-1/2 dark:neu-skeleton neu-skeleton-light opacity-70 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="absolute right-0 bottom-0 w-full h-[300px] pointer-events-none">
                  <div className="relative w-full h-full">

                    <div className="absolute right-[5%] bottom-[10%] w-60 rounded-lg border dark:border-white/[0.08] border-black/10 dark:bg-[#121214]/90 bg-white/90 backdrop-blur-2xl p-6 shadow-2xl animate-float-slow transition-transform group-hover:scale-105 group-hover:-translate-y-2 group-hover:-rotate-2 font-inter z-30">
                      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                      <div className="dark:text-white/40 text-slate-500 text-xs uppercase tracking-wider mb-2 font-semibold">{t('landing.outbound.deliveryRate') || 'Delivery Rate'}</div>
                      <div className="text-4xl font-bold dark:text-white text-slate-900 mb-3 tracking-tight">99.8%</div>
                      <div className="h-1.5 w-full dark:bg-white/5 bg-black/5 rounded-full overflow-hidden relative">
                        <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-rose-500 w-[99.8%] rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Bento 2: Omnichannel (Span 1) */}
            <Reveal delay={200} className="lg:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col items-center text-center justify-between transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_50%)]"></div>
                {/* Retro-futuristic concentric lines */}
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(59,130,246,0.1)_10px,rgba(59,130,246,0.1)_20px)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-expand-waves"></div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6">
                    {t('landing.omnichannel.badge') || 'Omnichannel'}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('landing.omnichannel.title') || 'Channel automation'}</h3>
                  <p className="dark:text-white/50 text-slate-500 text-sm">
                    {t('landing.omnichannel.subtitle') || 'Connect Email, WhatsApp, LinkedIn, and more. Orchestrate all communications in one place.'}
                  </p>
                </div>

                <div className="relative w-full h-48 mt-8 flex items-center justify-center pointer-events-none">
                  <div className="relative z-30 w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-[2px] shadow-[0_0_30px_rgba(99,102,241,0.5)] group-hover:scale-110 transition-transform duration-500">
                    <div className="w-full h-full bg-[#0a0a0c] rounded-[14px] flex items-center justify-center">
                      <img src="/images/logo.png" alt="Makinari" className="w-8 h-8 object-contain" />
                    </div>
                  </div>
                  {/* Orbiting Channel Nodes Container */}
                  <div className="absolute inset-0 animate-spin-super-slow flex items-center justify-center pointer-events-none">
                    <div className="absolute w-[160px] h-[160px] rounded-full border dark:border-white/[0.05] border-black/10"></div>
                    <div className="absolute w-[240px] h-[240px] rounded-full border dark:border-white/[0.03] border-black/5"></div>
                    
                    {/* Node: Email */}
                    <div className="absolute -top-3 w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    {/* Node: WhatsApp */}
                    <div className="absolute top-[15%] -right-2 w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                      <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    </div>
                    {/* Node: LinkedIn */}
                    <div className="absolute -bottom-1 right-[25%] w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(0,119,181,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                      <svg className="w-5 h-5 text-[#0077b5]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </div>
                    {/* Node: SMS */}
                    <div className="absolute bottom-[20%] -left-1 w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                      <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: MCP Server (Span 1) */}
            <Reveal delay={300} className="lg:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d4_2px,transparent_2px),linear-gradient(to_bottom,#06b6d4_2px,transparent_2px)] bg-[size:2rem_2rem] opacity-[0.05] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] group-hover:opacity-[0.15] transition-opacity duration-500 animate-pan-diagonal-fast"></div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-mono font-bold mb-6">
                    ~/developer-first
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('landing.developer.title') || 'Open source MCP'}</h3>
                  <p className="dark:text-white/50 text-slate-500 text-sm">
                    {t('landing.developer.subtitle') || 'Built for builders. Host on your own infrastructure with open-source capabilities.'}
                  </p>
                </div>

                <div className="relative z-10 mt-8 rounded-md border dark:border-white/10 border-black/10 dark:bg-[#09090b] bg-white shadow-2xl overflow-hidden group-hover:-translate-y-2 transition-transform duration-500">
                  <div className="flex items-center px-4 py-2 border-b dark:border-white/5 border-black/5 bg-black/40">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                    </div>
                  </div>
                  <div className="p-4 font-mono text-xs dark:text-white/80 text-slate-500 overflow-hidden text-left dark:bg-[#09090b] bg-white">
                    <span className="text-pink-400">import</span> { '{' } <span className="text-cyan-300">MCPServer</span> { '}' } <span className="text-pink-400">from</span> <span className="text-emerald-300">'@makinari/mcp'</span>;<br/><br/>
                    <span className="text-pink-400">export default</span> <span className="text-blue-400">new</span> <span className="text-cyan-300">MCPServer</span>({ '{' }<br/>
                    &nbsp;&nbsp;<span className="text-indigo-300">port</span>: <span className="text-orange-300">3000</span><br/>
                    { '}' });
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: SEO & Sites (Span 2) */}
            <Reveal delay={400} className="lg:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col md:flex-row gap-8 justify-between transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.1),transparent_50%)]"></div>
                {/* Vertical animated retro lines */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(16,185,129,0.1)_8px,rgba(16,185,129,0.1)_16px)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-pan-lines"></div>
                
                <div className="relative z-10 max-w-sm flex flex-col justify-center">
                  <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6 self-start">
                    {t('landing.seo.badge') || 'Growth Engine'}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('landing.seo.title') || 'SEO & sites specialist'}</h3>
                  <p className="dark:text-white/50 text-slate-500 leading-relaxed text-sm md:text-base">
                    {t('landing.seo.subtitle') || 'Optimize your web presence automatically. Generate SEO-perfected content, track rankings in real-time, and improve site performance continuously.'}
                  </p>
                </div>

                <div className="relative flex-1 min-w-[250px] flex flex-col justify-center items-end group-hover:scale-105 transition-transform duration-500 origin-right pointer-events-none font-inter">
                  <div className="w-full max-w-sm rounded-lg border dark:border-white/[0.08] border-black/10 dark:bg-[#09090b]/80 bg-white/80 backdrop-blur-md p-6 shadow-2xl">
                    <div className="dark:text-white/50 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">Organic Traffic</div>
                    <div className="text-3xl font-bold dark:text-white text-slate-900 mb-2 flex items-baseline gap-2">
                      24,592 <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md">+342%</span>
                    </div>
                    <div className="h-32 w-full mt-4 relative">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="chart-grad-bento" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4"/>
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <path d="M0,100 L0,80 C20,80 30,50 50,60 C70,70 80,20 100,10 L100,100 Z" fill="url(#chart-grad-bento)" />
                        <path d="M0,80 C20,80 30,50 50,60 C70,70 80,20 100,10" fill="none" stroke="#34d399" strokeWidth="3" className="animate-pulse-slow" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* Pricing - Bottom */}
      <PricingSection showFullPricingButton={true} />

      {/* Support Carousel */}
      <SupportCarousel />

      {/* Footer */}
      <SiteFooter />

      {/* Global Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        .perspective-\\[1000px\\] { perspective: 1000px; }
        .perspective-\\[1200px\\] { perspective: 1200px; }
        
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 4)); }
        }
        .animate-scroll-x { animation: scroll-x 40s linear infinite; }
        .animate-scroll-x-right { animation: scroll-x 40s linear infinite reverse; }

        @keyframes spin-super-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-super-slow { animation: spin-super-slow 40s linear infinite; }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: translateY(0); }
          50% { opacity: 0.8; transform: translateY(2%); }
        }
        .animate-pulse-slow { animation: pulse-slow 6s ease-in-out infinite; }

        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }

        @keyframes float-medium {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-float-medium { animation: float-medium 3s ease-in-out infinite; }

        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 0.5; }
          90% { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }

        @keyframes wave-outward {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        .animate-wave-outward { animation: wave-outward 15s ease-in-out infinite; }

        @keyframes pan-diagonal-fast {
          0% { background-position: 0 0; }
          100% { background-position: 32px 32px; }
        }
        .animate-pan-diagonal-fast { animation: pan-diagonal-fast 3s linear infinite; }
        
        @keyframes pan-lines {
          0% { background-position: 0 0; }
          100% { background-position: 40px 0; }
        }
        .animate-pan-lines { animation: pan-lines 4s linear infinite; }
        
        @keyframes expand-waves {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .animate-expand-waves { animation: expand-waves 4s ease-out infinite; }

        @keyframes radar-ping {
          0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0; border-width: 4px; }
          50% { opacity: 1; border-width: 1px; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; border-width: 0px; }
        }
        .animate-radar-ping { animation: radar-ping 4s cubic-bezier(0, 0.2, 0.8, 1) infinite; }
      `}} />
    </div>
  )
}
