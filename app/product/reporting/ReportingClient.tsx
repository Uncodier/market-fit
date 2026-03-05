"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Users, Bot, PieChart, NetworkTree, Zap, TrendingUp, BarChart, ArrowUpRight, Star, ShieldCheck, MessageSquare, LayoutGrid, Settings, Target, Filter, Search, ChevronDown, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OpenClawCard } from "@/app/components/auth/sections/OpenClawCard"


// Hook for scroll animations
function useIntersectionObserver(options: IntersectionObserverInit = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }) {
  const [isIntersecting, setIsIntersecting] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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
        filter: isVisible ? "blur(0px)" : "blur(12px)",
        transform: isVisible ? "translate(0)" : getTransform(),
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, filter 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}

function MockupScrollWrapper({ 
  children, 
  className = "",
  direction = "left"
}: { 
  children: React.ReactNode, 
  className?: string,
  direction?: "left" | "right"
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  
  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 50,
    damping: 20,
    restDelta: 0.001
  });

  const y = useTransform(smoothScroll, [0, 1], [80, -80]);
  const rotateX = useTransform(smoothScroll, [0, 0.5, 1], [15, 2, -10]);
  const rotateY = useTransform(smoothScroll, [0, 0.5, 1], direction === "left" ? [-25, -5, 5] : [25, 5, -5]);
  const scale = useTransform(smoothScroll, [0, 0.5, 1], [0.85, 1, 0.9]);
  const opacity = useTransform(smoothScroll, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const mouseRotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);
  const mouseRotateY = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);

  const springMouseRotateX = useSpring(mouseRotateX, { stiffness: 150, damping: 20 });
  const springMouseRotateY = useSpring(mouseRotateY, { stiffness: 150, damping: 20 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <motion.div 
      ref={ref} 
      style={{ 
        y, 
        rotateX, 
        rotateY, 
        scale, 
        opacity,
        perspective: 1200,
        transformStyle: "preserve-3d" 
      }} 
      className={`w-full ${className}`}
    >
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX: springMouseRotateX,
          rotateY: springMouseRotateY,
          transformStyle: "preserve-3d"
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function ReportingClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-indigo-500/30 flex flex-col  overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-indigo-500/30 bg-indigo-500/5 text-indigo-500">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
              {t('reporting.hero.chip') || 'Reporting & Analytics'}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              {t('reporting.hero.title_start') || 'Answers for '} <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-500">{t('reporting.hero.title_highlight') || 'everyone'}</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              {t('reporting.hero.description') || 'Interactive reports let you query your data with a few clicks, then see visualizations in seconds. Understand how users behave and what drives growth.'}
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 group">
                {t('reporting.hero.cta_start') || 'Start with Makinari'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
                {t('reporting.hero.cta_explore') || 'Explore all features'}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Main Feature Highlight - Dashboard Mockup */}
      <section className="relative w-full py-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center gap-16">
          <div className="text-center max-w-3xl mb-8">
            <Reveal delay={0}>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight">{t('reporting.features.slice_title') || 'Slice and dice your data'}</h2>
            </Reveal>
            <Reveal delay={100}>
              <p className="text-lg dark:text-white/50 text-slate-500 font-light">
                {t('reporting.features.slice_desc') || 'Break down any metric by user segments, campaigns, features, or behaviors. Find out what truly matters.'}
              </p>
            </Reveal>
          </div>

          <div className="w-full perspective-[1200px]">
            <Reveal delay={200} direction="up">
              <MockupScrollWrapper direction="right">
              <div className="relative w-full max-w-5xl mx-auto h-[550px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group flex flex-col font-sans">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_12px,rgba(99,102,241,0.02)_12px,rgba(99,102,241,0.02)_24px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                {/* Mockup Topbar */}
                <div className="flex justify-between items-center mb-6 relative z-10 border-b dark:border-white/10 border-black/10 pb-4">
                  <div className="flex gap-4">
                    <div className="px-3 py-1.5 dark:bg-white/10 bg-black/5 rounded-md text-sm font-medium dark:text-white text-slate-900 flex items-center gap-2">
                      <BarChart size={14} /> {t('reporting.mockup.insights') || 'Insights'}
                    </div>
                    <div className="px-3 py-1.5 text-sm font-medium dark:text-white/50 text-slate-500 flex items-center gap-2 hover:dark:text-white hover:text-slate-900 cursor-pointer">
                      <Filter size={14} /> {t('reporting.mockup.funnels') || 'Funnels'}
                    </div>
                    <div className="px-3 py-1.5 text-sm font-medium dark:text-white/50 text-slate-500 flex items-center gap-2 hover:dark:text-white hover:text-slate-900 cursor-pointer">
                      <Users size={14} /> {t('reporting.mockup.retention') || 'Retention'}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="text-xs dark:bg-black bg-white border dark:border-white/10 border-black/10 px-3 py-1.5 rounded-md flex items-center gap-2">
                      {t('reporting.mockup.last_30_days') || 'Last 30 days'} <ChevronDown size={12} />
                    </div>
                    <div className="text-xs bg-indigo-500 text-white px-3 py-1.5 rounded-md font-medium">
                      {t('reporting.mockup.save_report') || 'Save Report'}
                    </div>
                  </div>
                </div>
                
                {/* Mockup Content */}
                <div className="flex-1 flex gap-6 relative z-10">
                  {/* Left Sidebar */}
                  <div className="w-64 flex flex-col gap-4">
                    <div className="dark:bg-[#111113] bg-white rounded-lg p-4 border dark:border-white/5 border-black/5">
                      <div className="text-xs font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-3">{t('reporting.mockup.events') || 'Events'}</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm p-1.5 rounded hover:dark:bg-white/5 hover:bg-black/5 cursor-pointer">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> {t('reporting.mockup.event.sign_up') || 'Sign Up'}</div>
                        </div>
                        <div className="flex items-center justify-between text-sm p-1.5 rounded hover:dark:bg-white/5 hover:bg-black/5 cursor-pointer">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-cyan-500"></div> {t('reporting.mockup.event.complete_profile') || 'Complete Profile'}</div>
                        </div>
                        <div className="flex items-center justify-between text-sm p-1.5 rounded hover:dark:bg-white/5 hover:bg-black/5 cursor-pointer">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> {t('reporting.mockup.event.subscribe') || 'Subscribe'}</div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t dark:border-white/5 border-black/5">
                        <div className="text-xs font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-3">{t('reporting.mockup.breakdown_by') || 'Breakdown by'}</div>
                        <div className="flex items-center gap-2 text-sm p-1.5 border dark:border-white/10 border-black/10 rounded-md bg-transparent">
                          <Target size={14} className="dark:text-white/50 text-slate-500" />
                          {t('reporting.mockup.plan_type') || 'Plan Type'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Main Chart Area */}
                  <div className="flex-1 flex flex-col gap-6">
                    <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-5 flex flex-col relative overflow-hidden transition-colors duration-500">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-lg font-bold">{t('reporting.mockup.chart_title') || 'Conversion Over Time'}</h3>
                          <div className="text-sm dark:text-white/50 text-slate-500">{t('reporting.mockup.chart_subtitle') || 'Sign up to Subscription'}</div>
                        </div>
                        <div className="text-2xl font-bold text-indigo-400">
                          18.4%
                        </div>
                      </div>
                      
                      {/* Fake Chart Lines */}
                      <div className="flex-1 relative flex items-end">
                        <div className="absolute inset-0 flex flex-col justify-between">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="w-full h-px dark:bg-white/5 bg-black/5"></div>
                          ))}
                        </div>
                        
                        {/* SVG Line Chart Representation */}
                        <div className="absolute inset-0 z-10 overflow-hidden rounded-b-lg">
                          <svg 
                            viewBox="0 0 1000 300" 
                            preserveAspectRatio="none" 
                            style={{ display: 'block', width: '100%', height: '100%' }}
                          >
                            <defs>
                              <linearGradient id="gradient1_cms" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.4)" />
                                <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
                              </linearGradient>
                            </defs>
                            <path d="M0,240 L100,225 L200,255 L300,180 L400,210 L500,120 L600,150 L700,90 L800,135 L900,60 L1000,75" fill="none" stroke="rgba(99, 102, 241, 1)" strokeWidth="6" vectorEffect="non-scaling-stroke" />
                            <path d="M0,240 L100,225 L200,255 L300,180 L400,210 L500,120 L600,150 L700,90 L800,135 L900,60 L1000,75 L1000,300 L0,300 Z" fill="url(#gradient1_cms)" />
                            
                            <path d="M0,270 L100,255 L200,285 L300,240 L400,255 L500,210 L600,225 L700,165 L800,195 L900,135 L1000,150" fill="none" stroke="rgba(34, 211, 238, 1)" strokeWidth="6" strokeDasharray="12 12" vectorEffect="non-scaling-stroke" />
                          </svg>
                        </div>
                        
                        {/* X-axis labels */}
                        <div className="w-full flex justify-between absolute -bottom-6 text-[10px] dark:text-white/40 text-slate-400">
                          <span>{t('reporting.mockup.date.jan_1') || 'Jan 1'}</span>
                          <span>{t('reporting.mockup.date.jan_8') || 'Jan 8'}</span>
                          <span>{t('reporting.mockup.date.jan_15') || 'Jan 15'}</span>
                          <span>{t('reporting.mockup.date.jan_22') || 'Jan 22'}</span>
                          <span>{t('reporting.mockup.date.jan_29') || 'Jan 29'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bottom metrics */}
                    <div className="h-24 flex gap-4">
                      <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-4 flex flex-col justify-center">
                        <div className="text-xs dark:text-white/50 text-slate-500 mb-1">{t('reporting.mockup.metric.total_events') || 'Total Events'}</div>
                        <div className="text-xl font-bold">124,592</div>
                      </div>
                      <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-4 flex flex-col justify-center">
                        <div className="text-xs dark:text-white/50 text-slate-500 mb-1">{t('reporting.mockup.metric.active_users') || 'Active Users'}</div>
                        <div className="text-xl font-bold text-cyan-400">8,391</div>
                      </div>
                      <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-4 flex flex-col justify-center">
                        <div className="text-xs dark:text-white/50 text-slate-500 mb-1">{t('reporting.mockup.metric.avg_time_to_convert') || 'Avg Time to Convert'}</div>
                        <div className="text-xl font-bold">3d 4h</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Grid Features */}
      <section className="relative w-full py-24 border-b dark:border-white/[0.04] border-black/5 bg-transparent overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">{t('reporting.grid.title_start') || 'Everything you need to analyze '}<br className="hidden md:block" />{t('reporting.grid.title_end') || 'your product and business.'}</h2>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Reveal delay={100} className="col-span-1">
              <div className="h-full rounded-2xl dark:neu-base neu-base-light overflow-hidden relative group p-8 border dark:border-white/5 border-black/5 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(99,102,241,0.1)_8px,rgba(99,102,241,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(99,102,241,0.05)_8px,rgba(99,102,241,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-indigo-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <BarChart className="text-indigo-500" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{t('reporting.grid.dashboards.title') || 'Interactive Dashboards'}</h3>
                  <p className="dark:text-white/60 text-slate-500 leading-relaxed font-light">
                    {t('reporting.grid.dashboards.desc') || 'Build custom dashboards in seconds. Mix and match funnels, retention charts, and metric trends in one unified view.'}
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={200} className="col-span-1">
              <div className="h-full rounded-2xl dark:neu-base neu-base-light overflow-hidden relative group p-8 border dark:border-white/5 border-black/5 hover:border-cyan-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(6,182,212,0.1)_10px,rgba(6,182,212,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-cyan-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Filter className="text-cyan-500" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{t('reporting.grid.funnels.title') || 'Conversion Funnels'}</h3>
                  <p className="dark:text-white/60 text-slate-500 leading-relaxed font-light">
                    {t('reporting.grid.funnels.desc') || 'See where users drop off. Compare segments instantly to find out which demographics convert best.'}
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={300} className="col-span-1">
              <div className="h-full rounded-2xl dark:neu-base neu-base-light overflow-hidden relative group p-8 border dark:border-white/5 border-black/5 hover:border-emerald-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.03] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Users className="text-emerald-500" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{t('reporting.grid.retention.title') || 'Retention Cohorts'}</h3>
                  <p className="dark:text-white/60 text-slate-500 leading-relaxed font-light">
                    {t('reporting.grid.retention.desc') || 'Measure true product-market fit. Understand if users come back after their first day, week, or month.'}
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={400} className="col-span-1 md:col-span-2">
              <div className="h-full rounded-2xl dark:neu-base neu-base-light overflow-hidden relative group p-8 border dark:border-white/5 border-black/5 hover:border-fuchsia-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(217,70,239,0.1)_8px,rgba(217,70,239,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
                <div className="absolute right-0 top-0 w-64 h-64 bg-fuchsia-500/5 blur-[50px] rounded-full pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-fuchsia-500/5 flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform">
                    <Zap className="text-fuchsia-500" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-3 relative z-10">{t('reporting.grid.realtime.title') || 'Real-time Data Streams'}</h3>
                  <p className="dark:text-white/60 text-slate-500 leading-relaxed font-light max-w-md relative z-10">
                    {t('reporting.grid.realtime.desc') || 'Don\'t wait 24 hours for your data pipeline. Our streaming architecture ensures you see events in seconds, allowing you to react to launches and campaigns immediately.'}
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={500} className="col-span-1">
              <div className="h-full rounded-2xl dark:neu-base neu-base-light overflow-hidden relative group p-8 border dark:border-white/5 border-black/5 hover:border-violet-500/30 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.1)_8px,rgba(139,92,246,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.05)_8px,rgba(139,92,246,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-violet-500/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Bot className="text-violet-500" size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{t('reporting.grid.insights.title') || 'AI Insights'}</h3>
                  <p className="dark:text-white/60 text-slate-500 leading-relaxed font-light">
                    {t('reporting.grid.insights.desc') || 'Let AI spot anomalies for you. Get notified when conversion drops unexpectedly or usage spikes.'}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Comprehensive Report Library */}
      <section className="relative w-full py-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">{t('reporting.reports.title') || 'Out-of-the-box Reports'}</h2>
              <p className="text-lg dark:text-white/50 text-slate-500 font-light max-w-2xl mx-auto">
                {t('reporting.reports.desc') || "No SQL required. We've built dozens of industry-standard reports that connect directly to your product and marketing data."}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Group 1: Financial & Sales */}
            <Reveal delay={100}>
              <div className="dark:neu-panel neu-panel-light p-6 rounded-xl h-full flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_50%)] transition-colors"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(16,185,129,0.1)_8px,rgba(16,185,129,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-8 h-8 rounded-lg dark:neu-pressed neu-pressed-light bg-emerald-500/10 flex items-center justify-center border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                    <TrendingUp className="text-emerald-500" size={16} />
                  </div>
                  <h3 className="font-bold text-lg">{t('reporting.reports.financial.title') || 'Financial & Sales'}</h3>
                </div>
                <ul className="space-y-2.5 flex-1 mt-2 relative z-10">
                  {[
                    t('reporting.reports.financial.items.1') || "Revenue Projections",
                    t('reporting.reports.financial.items.2') || "Customer Lifetime Value (LTV)",
                    t('reporting.reports.financial.items.3') || "Customer Acquisition Cost (CAC)",
                    t('reporting.reports.financial.items.4') || "Return on Investment (ROI)",
                    t('reporting.reports.financial.items.5') || "Cost Breakdown & Distribution",
                    t('reporting.reports.financial.items.6') || "Sales Breakdown by Category",
                    t('reporting.reports.financial.items.7') || "Monthly Sales & Cost Evolution"
                  ].map((report, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm dark:text-white/70 text-slate-600">
                      <ShieldCheck size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{report}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Group 2: User & Traffic */}
            <Reveal delay={200}>
              <div className="dark:neu-panel neu-panel-light p-6 rounded-xl h-full flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_50%)] transition-colors"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(99,102,241,0.1)_10px,rgba(99,102,241,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-8 h-8 rounded-lg dark:neu-pressed neu-pressed-light bg-indigo-500/10 flex items-center justify-center border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                    <Users className="text-indigo-500" size={16} />
                  </div>
                  <h3 className="font-bold text-lg">{t('reporting.reports.user.title') || 'User & Traffic'}</h3>
                </div>
                <ul className="space-y-2.5 flex-1 mt-2 relative z-10">
                  {[
                    t('reporting.reports.user.items.1') || "Active Users & Segments",
                    t('reporting.reports.user.items.2') || "Retention Cohort Tables",
                    t('reporting.reports.user.items.3') || "Leads & Visitors Cohorts",
                    t('reporting.reports.user.items.4') || "Traffic Analytics",
                    t('reporting.reports.user.items.5') || "Segment Distribution (Donut)",
                    t('reporting.reports.user.items.6') || "Base KPI Metrics"
                  ].map((report, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm dark:text-white/70 text-slate-600">
                      <ShieldCheck size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                      <span>{report}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Group 3: Marketing & Campaigns */}
            <Reveal delay={300}>
              <div className="dark:neu-panel neu-panel-light p-6 rounded-xl h-full flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.1),transparent_50%)] transition-colors"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(6,182,212,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(6,182,212,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.03] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-8 h-8 rounded-lg dark:neu-pressed neu-pressed-light bg-cyan-500/10 flex items-center justify-center border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                    <Target className="text-cyan-500" size={16} />
                  </div>
                  <h3 className="font-bold text-lg">{t('reporting.reports.marketing.title') || 'Marketing & Leads'}</h3>
                </div>
                <ul className="space-y-2.5 flex-1 mt-2 relative z-10">
                  {[
                    t('reporting.reports.marketing.items.1') || "Active Campaigns Performance",
                    t('reporting.reports.marketing.items.2') || "Campaign Revenue Donut",
                    t('reporting.reports.marketing.items.3') || "Cost Per Lead (CPL)",
                    t('reporting.reports.marketing.items.4') || "Leads Contacted vs Active",
                    t('reporting.reports.marketing.items.5') || "Leads in Conversation",
                    t('reporting.reports.marketing.items.6') || "Meetings Scheduled",
                    t('reporting.reports.marketing.items.7') || "Leads Task Distribution"
                  ].map((report, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm dark:text-white/70 text-slate-600">
                      <ShieldCheck size={14} className="text-cyan-500 shrink-0 mt-0.5" />
                      <span>{report}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            {/* Group 4: Productivity & AI */}
            <Reveal delay={400}>
              <div className="dark:neu-panel neu-panel-light p-6 rounded-xl h-full flex flex-col relative overflow-hidden group hover:-translate-y-1 transition-all duration-500">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.1),transparent_50%)] transition-colors"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(217,70,239,0.1)_8px,rgba(217,70,239,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-8 h-8 rounded-lg dark:neu-pressed neu-pressed-light bg-fuchsia-500/10 flex items-center justify-center border dark:border-white/5 border-black/5 group-hover:scale-110 transition-transform">
                    <Zap className="text-fuchsia-500" size={16} />
                  </div>
                  <h3 className="font-bold text-lg">{t('reporting.reports.productivity.title') || 'Productivity & AI'}</h3>
                </div>
                <ul className="space-y-2.5 flex-1 mt-2 relative z-10">
                  {[
                    t('reporting.reports.productivity.items.1') || "AI Token Usage (Input/Output)",
                    t('reporting.reports.productivity.items.2') || "Images Generated Stats",
                    t('reporting.reports.productivity.items.3') || "Video Generation Minutes",
                    t('reporting.reports.productivity.items.4') || "Active AI Experiments",
                    t('reporting.reports.productivity.items.5') || "Requirements Completed",
                    t('reporting.reports.productivity.items.6') || "Contents Approved",
                    t('reporting.reports.productivity.items.7') || "Task Completion Tracking"
                  ].map((report, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm dark:text-white/70 text-slate-600">
                      <ShieldCheck size={14} className="text-fuchsia-500 shrink-0 mt-0.5" />
                      <span>{report}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Missing ChevronDown icon implementation - add inline component */}
      <div className="hidden">
        <ChevronDown size={24} />
      </div>

      <div className="mt-12 px-6 lg:px-12 pb-24 max-w-7xl mx-auto w-full">
        <Reveal delay={200}>
          <OpenClawCard />
        </Reveal>
      </div>

      <SiteFooter />
    </div>
  )
}