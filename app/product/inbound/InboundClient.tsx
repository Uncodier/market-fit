"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Target, TrendingUp, Clock, Zap, PieChart, CheckSquare, ArrowUpRight, Store, Users, RotateCw, BarChart, Globe, NetworkTree, ArrowRight } from "@/app/components/ui/icons"
import { SiMeta, SiLinkedin, SiGoogleads, SiTiktok, SiX } from "react-icons/si"
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

export function InboundClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-emerald-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-emerald-500/30 bg-emerald-500/5 text-emerald-500">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              {t('inbound.hero.badge') || "Inbound Generation"}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              {t('inbound.hero.title1') || "Turn your traffic into "} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">{t('inbound.hero.title2') || "qualified pipeline"}</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              {t('inbound.hero.description') || "Capture high-intent leads on autopilot. Use natively built AI tools to optimize ad campaigns, manage budgets, and keep your inbound pipeline consistently full."}
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-inter font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 group">
                {t('inbound.hero.cta.start') || "Start with Makinari"}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
                {t('inbound.hero.cta.explore') || "Explore all features"}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Main Feature Highlight */}
      <section className="relative w-full py-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group flex flex-col gap-4 font-inter">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top_left,transparent,transparent_8px,rgba(16,185,129,0.02)_8px,rgba(16,185,129,0.02)_16px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex gap-4 relative z-10">
                  <div className="flex-1 rounded-md bg-black/40 border dark:border-white/5 border-black/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-md">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-[20px] rounded-full"></div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1">{t('inbound.mockup.adSpend') || "Ad Spend"}</div>
                    <div className="text-xl font-bold dark:text-white text-slate-900">$12,450</div>
                    <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> +5.2%</div>
                  </div>
                  <div className="flex-1 rounded-md bg-black/40 border dark:border-white/5 border-black/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-md">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-[20px] rounded-full"></div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1">{t('inbound.mockup.roas') || "ROAS"}</div>
                    <div className="text-xl font-bold dark:text-white text-slate-900">4.2x</div>
                    <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> +1.1x</div>
                  </div>
                  <div className="flex-1 rounded-md bg-black/40 border dark:border-white/5 border-black/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-md">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-[20px] rounded-full"></div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1">{t('inbound.mockup.costPerLead') || "Cost / Lead"}</div>
                    <div className="text-xl font-bold dark:text-white text-slate-900">$42.50</div>
                    <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> -12%</div>
                  </div>
                </div>

                {/* Campaigns List */}
                <div className="flex-1 rounded-lg bg-black/40 border dark:border-white/5 border-black/5 p-5 relative overflow-hidden flex flex-col gap-3 z-10 dark:neu-panel neu-panel-light shadow-md">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs dark:text-white/80 text-slate-500 font-bold tracking-wider uppercase flex items-center gap-2">
                      <Target size={14} className="text-emerald-400" /> {t('inbound.mockup.activeCampaigns') || "Active Campaigns"}
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                      {t('inbound.mockup.aiOptimizing') || "AI Optimizing"}
                    </div>
                  </div>

                  {/* Campaign Items */}
                  {[
                    { name: t('inbound.mockup.campaigns.q4Retargeting') || "Q4 Retargeting", status: t('inbound.mockup.status.active') || "Active", budget: "$150/d", leads: "142" },
                    { name: t('inbound.mockup.campaigns.lookalikeTopTier') || "Lookalike Top Tier", status: t('inbound.mockup.status.active') || "Active", budget: "$200/d", leads: "215" },
                    { name: t('inbound.mockup.campaigns.coldOutboundSearch') || "Cold Outbound Search", status: t('inbound.mockup.status.learning') || "Learning", budget: "$80/d", leads: "24" }
                  ].map((camp, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-md border dark:border-white/5 border-black/5 dark:bg-white/[0.02] bg-black/5 hover:dark:bg-white/[0.05] bg-black/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${i === 2 ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {i === 2 ? <Clock size={14} /> : <Zap size={14} />}
                        </div>
                        <div>
                          <div className="text-sm font-semibold dark:text-white/90 text-slate-500">{camp.name}</div>
                          <div className="text-[10px] dark:text-white/40 text-slate-500 flex items-center gap-2">
                            <span className={i === 2 ? 'text-orange-400' : 'text-emerald-400'}>{camp.status}</span>
                            <span>•</span>
                            <span>{camp.budget}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold dark:text-white text-slate-900">{camp.leads}</div>
                        <div className="text-[10px] dark:text-white/40 text-slate-500">{t('inbound.mockup.leads') || "Leads"}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating Element */}
                <div className="absolute -right-6 top-1/2 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30 shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl border border-emerald-500/30">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                      <Target size={16} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-xs font-bold">{t('inbound.mockup.newLead') || "New Lead"}</div>
                      <div className="text-emerald-400 text-[10px]">{t('inbound.mockup.viaLookalikeTier') || "via Lookalike Tier"}</div>
                    </div>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('inbound.feature1.title') || "AI managed ad spend"}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('inbound.feature1.description') || "Optimize your entire demand generation strategy from one place. Allocate budgets smartly and score incoming leads immediately before they cool off."}
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'inbound-automation', name: t('inbound.feature1.list.automation.title') || "Inbound Automation", icon: <Zap size={18} className="text-emerald-400" />, desc: t('inbound.feature1.list.automation.desc') || "Instantly ingest leads, assign them to reps, and start sequences." },
                  { id: 'ad-management', name: t('inbound.feature1.list.adManagement.title') || "Ad Management", icon: <Target size={18} className="text-emerald-400" />, desc: t('inbound.feature1.list.adManagement.desc') || "Connect Meta, LinkedIn, and Google Ads to manage ROI directly." },
                  { id: 'smart-logging', name: t('inbound.feature1.list.leadScoring.title') || "Lead Scoring", icon: <CheckSquare size={18} className="text-emerald-400" />, desc: t('inbound.feature1.list.leadScoring.desc') || "Rank incoming leads by buying intent and route them properly." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-emerald-500/30 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 dark:text-white text-slate-900 font-semibold mb-1">
                        {item.name}
                      </div>
                      <p className="text-sm dark:text-white/60 text-slate-600 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Ad Allocation Management Section */}
      <section className="relative w-full py-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-6 border border-emerald-500/30 bg-emerald-500/5 text-emerald-500">
                <PieChart size={14} className="mr-2" />
                {t('inbound.adAllocation.badge') || "Budget Optimization"}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('inbound.adAllocation.title') || "Ad allocation management"}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('inbound.adAllocation.description') || "Stop wasting money on underperforming channels. Makinari automatically shifts your budget toward the platforms driving the highest quality pipeline, in real-time."}
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { name: 'Meta Ads', icon: <SiMeta size={24} className="text-[#0668E1]" /> },
                  { name: 'Google Ads', icon: <SiGoogleads size={24} className="text-[#EA4335]" /> },
                  { name: 'LinkedIn Ads', icon: <SiLinkedin size={24} className="text-[#0A66C2]" /> },
                  { name: 'TikTok Ads', icon: <SiTiktok size={24} className="dark:text-white text-black" /> },
                  { name: 'X Ads', icon: <SiX size={24} className="dark:text-white text-black" /> },
                  { name: t('inbound.adAllocation.channels.more') || 'And more...', icon: <Target size={24} className="text-slate-400" /> }
                ].map((channel, i) => (
                  <div key={i} className="flex flex-col items-center justify-center gap-3 p-4 rounded-xl border dark:border-white/5 border-black/5 dark:bg-[#0a0a0c] bg-slate-50 hover:dark:bg-white/[0.05] hover:bg-black/5 transition-all group">
                    <div className="w-12 h-12 rounded-lg bg-white dark:bg-[#1a1a1a] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      {channel.icon}
                    </div>
                    <span className="font-semibold dark:text-white/90 text-slate-700 text-xs text-center">{channel.name}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
          
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <div className="relative w-full aspect-square max-h-[500px] rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col items-center justify-center overflow-hidden border dark:border-white/10 border-black/5 shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08),transparent_70%)]"></div>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(16,185,129,0.1)_8px,rgba(16,185,129,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(16,185,129,0.05)_8px,rgba(16,185,129,0.05)_16px)] opacity-40 pointer-events-none animate-pan-diagonal-fast"></div>
                
                {/* Visualization of budget moving */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  
                  {/* Surrounding Nodes */}
                  <div className="relative w-64 h-64 border border-dashed dark:border-white/20 border-black/20 rounded-full flex items-center justify-center animate-[spin_40s_linear_infinite]">
                    
                    {/* Node 1: Google */}
                    <div className="absolute top-0 -translate-y-1/2 w-16 h-16 rounded-xl dark:bg-[#1A1A1A] bg-white border dark:border-white/10 border-black/10 flex flex-col items-center justify-center shadow-lg transform -rotate-0 animate-[spin_40s_linear_infinite_reverse]">
                      <SiGoogleads size={24} className="text-[#EA4335] mb-1" />
                      <div className="text-[10px] font-bold text-emerald-500">45%</div>
                      <div className="absolute -bottom-2 right-[-5px] w-3 h-3 bg-emerald-500 rounded-full animate-ping"></div>
                      <div className="absolute -bottom-2 right-[-5px] w-3 h-3 bg-emerald-500 rounded-full"></div>
                    </div>
                    
                    {/* Node 2: LinkedIn */}
                    <div className="absolute top-[25%] right-[-1.5rem] w-14 h-14 rounded-xl dark:bg-[#1A1A1A] bg-white border dark:border-white/10 border-black/10 flex flex-col items-center justify-center shadow-lg transform -rotate-0 animate-[spin_40s_linear_infinite_reverse]">
                      <SiLinkedin size={20} className="text-[#0A66C2] mb-1" />
                      <div className="text-[10px] font-bold text-emerald-500">30%</div>
                    </div>
                    
                    {/* Node 3: Meta */}
                    <div className="absolute bottom-0 translate-y-1/2 w-14 h-14 rounded-xl dark:bg-[#1A1A1A] bg-white border dark:border-white/10 border-black/10 flex flex-col items-center justify-center shadow-lg transform -rotate-0 animate-[spin_40s_linear_infinite_reverse]">
                      <SiMeta size={20} className="text-[#0668E1] mb-1" />
                      <div className="text-[10px] font-bold text-emerald-500">15%</div>
                    </div>
                    
                    {/* Node 4: TikTok */}
                    <div className="absolute top-[25%] left-[-1.5rem] w-12 h-12 rounded-xl dark:bg-[#1A1A1A] bg-white border dark:border-white/10 border-black/10 flex flex-col items-center justify-center shadow-lg transform -rotate-0 animate-[spin_40s_linear_infinite_reverse]">
                      <SiTiktok size={16} className="dark:text-white text-black mb-1" />
                      <div className="text-[10px] font-bold dark:text-white/60 text-slate-500">10%</div>
                    </div>
                  </div>

                  {/* Center node */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center z-20 shadow-[0_0_30px_rgba(16,185,129,0.2)] backdrop-blur-md">
                    <div className="text-center">
                      <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1">{t('inbound.adAllocation.chart.totalBudget') || "Total Budget"}</div>
                      <div className="text-2xl font-bold dark:text-white text-slate-900">$50k</div>
                      <div className="text-[10px] dark:text-white/50 text-slate-500 mt-1">{t('inbound.adAllocation.chart.aiAllocated') || "AI Allocated"}</div>
                    </div>
                  </div>

                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Retargeting & Audience Builder Section */}
      <section className="relative w-full py-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-6 border border-emerald-500/30 bg-emerald-500/5 text-emerald-500">
                <Users size={14} className="mr-2" />
                {t('inbound.retargeting.badge') || "Audience & Retargeting"}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('inbound.retargeting.title') || "Never lose a high-intent visitor"}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('inbound.retargeting.description') || "Build hyper-targeted audiences based on website behavior, CRM data, and firmographics. Launch cross-channel retargeting campaigns that follow your best prospects across the web, social media, and their inbox."}
              </p>
              
              <ul className="space-y-4">
                {[
                  { name: t('inbound.retargeting.list.dynamic.title') || "Dynamic Retargeting", icon: <RotateCw size={18} className="text-emerald-400" />, desc: t('inbound.retargeting.list.dynamic.desc') || "Show personalized ads based on the exact pages or products a prospect viewed." },
                  { name: t('inbound.retargeting.list.lookalike.title') || "Lookalike Audiences", icon: <Users size={18} className="text-emerald-400" />, desc: t('inbound.retargeting.list.lookalike.desc') || "Automatically find new prospects that match your best closed-won customers." },
                  { name: t('inbound.retargeting.list.attribution.title') || "Multi-touch Attribution", icon: <BarChart size={18} className="text-emerald-400" />, desc: t('inbound.retargeting.list.attribution.desc') || "Track the entire customer journey and see exactly which channels drive revenue." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-emerald-500/30 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 dark:text-white text-slate-900 font-semibold mb-1">
                        {item.name}
                      </div>
                      <p className="text-sm dark:text-white/60 text-slate-600 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full aspect-[4/3] rounded-2xl dark:neu-mockup-screen neu-mockup-screen-light p-6 flex flex-col overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-100 pointer-events-none rounded-2xl"></div>
                  
                  <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-white/10 border-black/10 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-bold dark:text-white text-slate-900 tracking-tight">{t('inbound.retargeting.mockup.title') || "High Intent Audience"}</div>
                        <div className="text-[10px] font-medium dark:text-emerald-400/80 text-emerald-600 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                          {t('inbound.retargeting.mockup.syncing') || "Syncing to 4 platforms"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold dark:text-white text-slate-900">12,450</div>
                      <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase tracking-wider font-bold">{t('inbound.retargeting.mockup.matchedUsers') || "Matched Users"}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 relative z-10 flex-1 flex flex-col justify-center">
                    <div className="p-4 rounded-xl border dark:border-white/10 border-black/10 dark:bg-[#121212] bg-white shadow-sm hover:-translate-y-1 transition-transform cursor-pointer">
                      <div className="text-sm font-semibold dark:text-white/90 text-slate-700 mb-1.5 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-500/10 text-blue-500 border border-blue-500/20"><Globe size={14}/></span>
                        {t('inbound.retargeting.mockup.filters.visited.title') || "Visited High-Value Pages"}
                      </div>
                      <div className="pl-8 text-xs dark:text-white/50 text-slate-500">{t('inbound.retargeting.mockup.filters.visited.desc') || "Pricing or Checkout in the last 7 days"}</div>
                    </div>

                    <div className="flex items-center justify-center -my-3 relative z-20">
                      <div className="px-3 py-1 rounded-full text-[10px] font-bold dark:bg-[#1a1a1a] bg-slate-100 border dark:border-white/10 border-black/10 text-emerald-500 shadow-sm">{t('inbound.retargeting.mockup.filters.and') || "AND"}</div>
                    </div>

                    <div className="p-4 rounded-xl border dark:border-white/10 border-black/10 dark:bg-[#121212] bg-white shadow-sm hover:-translate-y-1 transition-transform cursor-pointer">
                      <div className="text-sm font-semibold dark:text-white/90 text-slate-700 mb-1.5 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-500/10 text-purple-500 border border-purple-500/20"><NetworkTree size={14}/></span>
                        {t('inbound.retargeting.mockup.filters.icp.title') || "Ideal Customer Profile"}
                      </div>
                      <div className="pl-8 text-xs dark:text-white/50 text-slate-500">{t('inbound.retargeting.mockup.filters.icp.desc') || "Company Size: 50-500 • Industry: SaaS"}</div>
                    </div>

                    <div className="flex items-center justify-center -my-3 relative z-20">
                      <div className="px-3 py-1 rounded-full text-[10px] font-bold dark:bg-[#1a1a1a] bg-slate-100 border dark:border-white/10 border-black/10 text-rose-500 shadow-sm">{t('inbound.retargeting.mockup.filters.exclude') || "EXCLUDE"}</div>
                    </div>

                    <div className="p-4 rounded-xl border dark:border-rose-500/20 border-rose-500/20 dark:bg-rose-500/5 bg-rose-50 shadow-sm hover:-translate-y-1 transition-transform cursor-pointer">
                      <div className="text-sm font-semibold dark:text-rose-500 text-rose-600 mb-1.5 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-500/10 text-rose-600 border border-rose-500/20"><Store size={14}/></span>
                        {t('inbound.retargeting.mockup.filters.existing.title') || "Existing Customers"}
                      </div>
                      <div className="pl-8 text-xs dark:text-rose-400/70 text-rose-500/70">{t('inbound.retargeting.mockup.filters.existing.desc') || "Exclude active CRM accounts & subscriptions"}</div>
                    </div>
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Bento Grid Layout for Inbound features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                {t('inbound.bento.title1') || "Predictable "} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">{t('inbound.bento.title2') || "Demand Generation"}</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                {t('inbound.bento.description') || "Align your marketing spend with actual closed-won revenue, not just vanity metrics."}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 1: Auto Lead Routing */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(16,185,129,0.1)_10px,rgba(16,185,129,0.1)_20px)] opacity-40 pointer-events-none animate-expand-waves"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-emerald-500 mb-6 bg-emerald-500/5">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('inbound.bento.speedToLead.title') || "Speed to Lead Automation"}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('inbound.bento.speedToLead.desc') || "When a high-intent lead fills a form, Makinari instantly enriches the data, scores it, routes it to the right rep, and can even trigger an immediate AI phone call or SMS."}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMxMGI5ODEiIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

            {/* Bento 2: Full Funnel Ads */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(20,184,166,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(20,184,166,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(20,184,166,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-40 [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-teal-500 mb-6 bg-teal-500/5">
                    <Target size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('inbound.bento.paidAds.title') || "Paid Ads Management"}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('inbound.bento.paidAds.desc') || "Connect Google Ads, Meta, and LinkedIn Ads. Optimize campaigns dynamically based on which keywords and audiences actually convert into pipeline."}
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: AI Scoring */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(59,130,246,0.1)_8px,rgba(59,130,246,0.1)_16px)] opacity-40 pointer-events-none animate-pan-lines"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-blue-500 mb-6 bg-blue-500/5">
                    <CheckSquare size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('inbound.bento.intentScoring.title') || "Intent Scoring"}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('inbound.bento.intentScoring.desc') || "AI analyzes website visits, email opens, and product usage to bubble up the accounts most likely to buy right now."}
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: Forms & Landing Pages */}
            <Reveal delay={400} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(16,185,129,0.1)_8px,rgba(16,185,129,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(16,185,129,0.05)_8px,rgba(16,185,129,0.05)_16px)] opacity-40 pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-emerald-500 mb-6 bg-emerald-500/5">
                    <PieChart size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('inbound.bento.forms.title') || "High-Converting Forms"}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('inbound.bento.forms.desc') || "Drop our smart forms onto any site. They dynamically shorten for known visitors and use clearbit/zoominfo data to keep fields to a minimum, boosting conversion rates."}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-full h-full opacity-10 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#10b981_10px,#10b981_20px)] [mask-image:radial-gradient(circle_at_bottom_right,black,transparent_70%)]"></div>
              </div>
            </Reveal>

            {/* Bento 5: Physical Ad Management */}
            <Reveal delay={500} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(249,115,22,0.1)_10px,rgba(249,115,22,0.1)_20px)] opacity-40 pointer-events-none animate-expand-waves"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(249,115,22,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(249,115,22,0.05)_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_70%,transparent_100%)] opacity-20 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-orange-500 mb-6 bg-orange-500/5">
                    <Store size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('inbound.bento.physicalAds.title') || "Physical Ad Management"}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('inbound.bento.physicalAds.desc') || "Bridge the gap between offline ads and digital revenue. Track billboards, mailers, and events with unique identifiers to measure true offline ROI."}
                  </p>
                </div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <OpenClawCard />
      </section>

      <SiteFooter />
    </div>
  )
}
