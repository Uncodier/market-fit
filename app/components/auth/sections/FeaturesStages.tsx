"use client"

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useLocalization } from "@/app/context/LocalizationContext";
import Link from "next/link";
import { 
  Search, Users, Building, Target, Megaphone, Mail, Phone, TrendingUp, Bot, NetworkTree, CheckSquare, Zap, Clock, ShieldCheck, User, Star, CreditCard, DollarSign, PieChart, BarChart, ArrowUpRight, Video
} from "@/app/components/ui/icons";


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

  // Mouse hover 3D effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const mouseRotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);
  const mouseRotateY = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);

  const springMouseRotateX = useSpring(mouseRotateX, { stiffness: 150, damping: 20 });
  const springMouseRotateY = useSpring(mouseRotateY, { stiffness: 150, damping: 20 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5
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

function ParallaxBackground({ scrollYProgress }: { scrollYProgress: any }) {
  const y1 = useTransform(scrollYProgress, [0, 1], ["-20%", "20%"]);
  const y2 = useTransform(scrollYProgress, [0, 1], ["20%", "-20%"]);
  const y3 = useTransform(scrollYProgress, [0, 1], ["-10%", "10%"]);
  const opacity1 = useTransform(scrollYProgress, [0, 0.5, 1], [0.3, 0.8, 0.3]);
  const opacity2 = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 0.3, 0.8]);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Glows */}
      <motion.div style={{ y: y1 }} className="absolute top-[5%] -left-[20%] w-[70%] h-[30%] bg-orange-500/10 rounded-full font-sans blur-[120px]" />
      <motion.div style={{ y: y2 }} className="absolute top-[35%] -right-[20%] w-[70%] h-[30%] bg-blue-500/10 rounded-full font-sans blur-[120px]" />
      <motion.div style={{ y: y3 }} className="absolute top-[65%] -left-[20%] w-[70%] h-[30%] bg-emerald-500/10 rounded-full font-sans blur-[120px]" />
      <motion.div style={{ y: y1 }} className="absolute bottom-[5%] -right-[20%] w-[70%] h-[30%] bg-violet-500/10 rounded-full font-sans blur-[120px]" />

      {/* Retro-futuristic Waves Top */}
      <motion.div 
        style={{ y: y1, opacity: opacity1 }}
        className="absolute top-[10%] left-0 w-full h-[500px] flex items-center justify-center [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]"
      >
        <div className="w-[150%] h-[150%] bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_40px,rgba(255,255,255,0.03)_40px,rgba(255,255,255,0.03)_42px)] scale-y-[0.3]" />
      </motion.div>

      {/* Diagonal Grid Middle */}
      <motion.div 
        style={{ y: y2, opacity: opacity2 }}
        className="absolute top-[40%] left-0 w-full h-[600px] flex items-center justify-center [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      >
        <div className="w-[200%] h-[200%] bg-[linear-gradient(45deg,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(-45deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </motion.div>

      {/* Retro-futuristic Waves Bottom */}
      <motion.div 
        style={{ y: y3, opacity: opacity1 }}
        className="absolute bottom-[10%] left-0 w-full h-[500px] flex items-center justify-center [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]"
      >
        <div className="w-[150%] h-[150%] bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_40px,rgba(255,255,255,0.03)_40px,rgba(255,255,255,0.03)_42px)] scale-y-[0.3]" />
      </motion.div>
    </div>
  );
}

const getStages = (t: (key: string) => string) => [
  {
    title: t('features.stages.find.title') || "Find",
    color: "from-orange-400 to-rose-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    text: "text-orange-400",
    hoverClass: "hover:border-orange-500 hover:shadow-[8px_8px_0px_rgba(249,115,22,1)]",
    patternColor: "rgba(249,115,22,0.1)",
    icon: <Target size={28} className="text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />,
    features: [
      { id: 'icp-generation', name: t('features.stages.find.f6') || "ICP generation", isSoon: false, icon: <Users size={20} className="text-orange-400/70" /> },
      { id: 'tam-sourcing', name: t('features.stages.find.f1') || "TAM sourcing", isSoon: false, icon: <Search size={20} className="text-orange-400/70" /> },
      { id: 'intent-signals', name: t('features.stages.find.f4') || "Intent signals", isSoon: false, icon: <Zap size={20} className="text-orange-400/70" /> },
      { id: 'company-enrichment', name: t('features.stages.find.f3') || "Company enrichment", isSoon: false, icon: <Building size={20} className="text-orange-400/70" /> },
      { id: 'contact-enrichment', name: t('features.stages.find.f2') || "Contact enrichment", isSoon: false, icon: <User size={20} className="text-orange-400/70" /> },
      { id: 'lead-scoring', name: t('features.stages.find.f5') || "Lead scoring", isSoon: false, icon: <Star size={20} className="text-orange-400/70" /> },
    ]
  },
  {
    title: t('features.stages.contact.title') || "Contact",
    color: "from-blue-400 to-cyan-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
    hoverClass: "hover:border-blue-500 hover:shadow-[8px_8px_0px_rgba(59,130,246,1)]",
    patternColor: "rgba(59,130,246,0.1)",
    icon: <Mail size={28} className="text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.8)]" />,
    features: [
      { id: 'domain-inbox', name: t('features.stages.contact.f1') || "Domain & inbox purchase", isSoon: false, icon: <CreditCard size={20} className="text-blue-400/70" /> },
      { id: 'inbox-warming', name: t('features.stages.contact.f2') || "Inbox warming", isSoon: false, icon: <CheckSquare size={20} className="text-blue-400/70" /> },
      { id: 'sequencing', name: t('features.stages.contact.f3') || "Sequencing", isSoon: false, icon: <NetworkTree size={20} className="text-blue-400/70" /> },
      { id: 'automatic-follow-up', name: t('features.stages.contact.f6') || "Automatic follow-up", isSoon: false, icon: <TrendingUp size={20} className="text-blue-400/70" /> },
      { id: 'dialer', name: t('features.stages.contact.f4') || "Dialer", isSoon: true, icon: <Phone size={20} className="text-blue-400/70" /> },
      { id: 'scheduler', name: t('features.stages.contact.f5') || "Scheduler", isSoon: false, icon: <Clock size={20} className="text-blue-400/70" /> },
    ]
  },
  {
    title: t('features.stages.sell.title') || "Sell",
    color: "from-emerald-400 to-teal-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    hoverClass: "hover:border-emerald-500 hover:shadow-[8px_8px_0px_rgba(16,185,129,1)]",
    patternColor: "rgba(16,185,129,0.1)",
    icon: <TrendingUp size={28} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />,
    features: [
      { id: 'seo-content', name: t('features.stages.sell.f3') || "SEO & Content automation", isSoon: false, icon: <PieChart size={20} className="text-emerald-400/70" /> },
      { id: 'ad-management', name: t('features.stages.sell.f1') || "Ad management", isSoon: false, icon: <Megaphone size={20} className="text-emerald-400/70" /> },
      { id: 'inbound-automation', name: t('features.stages.sell.f2') || "Inbound Automation", isSoon: false, icon: <Zap size={20} className="text-emerald-400/70" /> },
      { id: 'smart-composer', name: t('features.stages.sell.f4') || "Smart email composer", isSoon: false, icon: <Mail size={20} className="text-emerald-400/70" /> },
      { id: 'meet-recording', name: t('features.stages.sell.f6') || "Meet Recording", isSoon: true, icon: <Video size={20} className="text-emerald-400/70" /> },
      { id: 'smart-logging', name: t('features.stages.sell.f5') || "Smart task logging", isSoon: false, icon: <CheckSquare size={20} className="text-emerald-400/70" /> },
    ]
  },
  {
    title: t('features.stages.manage.title') || "Manage",
    color: "from-violet-400 to-fuchsia-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    text: "text-violet-400",
    hoverClass: "hover:border-violet-500 hover:shadow-[8px_8px_0px_rgba(139,92,246,1)]",
    patternColor: "rgba(139,92,246,0.1)",
    icon: <BarChart size={28} className="text-violet-400 drop-shadow-[0_0_15px_rgba(167,139,250,0.8)]" />,
    features: [
      { id: 'crm', name: t('features.stages.manage.f1') || "CRM", isSoon: false, icon: <Users size={20} className="text-violet-400/70" /> },
      { id: 'workflows', name: t('features.stages.manage.f4') || "Workflows", isSoon: false, icon: <NetworkTree size={20} className="text-violet-400/70" /> },
      { id: 'integrations', name: t('features.stages.manage.f5') || "Integrations", isSoon: false, icon: <Zap size={20} className="text-violet-400/70" /> },
      { id: 'ai-copilot', name: t('features.stages.manage.f2') || "Ask AI Copilot", isSoon: false, icon: <Bot size={20} className="text-violet-400/70" /> },
      { id: 'ticket-control', name: t('features.stages.manage.f6') || "Ticket control", isSoon: false, icon: <ShieldCheck size={20} className="text-violet-400/70" /> },
      { id: 'reporting', name: t('features.stages.manage.f3') || "Reporting", isSoon: false, icon: <PieChart size={20} className="text-violet-400/70" /> },
    ]
  }
];

export function FeaturesStages() {
  const { t } = useLocalization();
  const stages = getStages(t);
  return (
    <div className="relative">
      {/* Features Table */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                {t('features.title.start') || 'Everything you need,'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">{t('features.title.highlight') || 'stage by stage'}</span>
              </h2>
              <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                {t('features.subtitle') || 'A complete suite of tools integrated into one seamless platform from first touch to closed won.'}
              </p>
            </div>
          </Reveal>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stages.map((stage, idx) => (
              <Reveal key={stage.title} delay={idx * 100}>
                <div className={`h-full rounded-xl dark:neu-base neu-base-light p-8 group relative overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2 ${stage.hoverClass}`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stage.color} opacity-5 blur-[50px] group-hover:opacity-10 transition-opacity duration-500`}></div>
                  {/* Op-art geometric lines accent on hover */}
                  <div 
                    className="absolute inset-0 opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"
                    style={{ backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 6px, ${stage.patternColor} 6px, ${stage.patternColor} 12px)` }}
                  ></div>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-lg dark:neu-pressed neu-pressed-light flex items-center justify-center flex-shrink-0 border dark:border-white/5 border-black/5">
                      {stage.icon}
                    </div>
                    <h3 className={`text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${stage.color}`}>
                      {stage.title}
                    </h3>
                  </div>
                  
                  <ul className="space-y-4">
                    {stage.features.map((feature, i) => (
                      <li key={i} className="flex items-center text-sm font-medium dark:text-white/80 text-slate-500 group-hover:dark:text-white text-slate-900 transition-colors duration-300 relative group/item">
                        <Link href={`/product/features/${feature.id}`} className="flex items-center w-full">
                          <div className="w-8 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-3 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover/item:border-current transition-colors">
                            {React.cloneElement(feature.icon as React.ReactElement, { size: 16 })}
                          </div>
                          <span className="flex-1 mt-0.5 leading-tight group-hover/item:text-current transition-colors flex items-center gap-1.5">
                            {feature.name}
                            <ArrowUpRight size={12} className="opacity-0 -ml-2 transition-all group-hover/item:opacity-100 group-hover/item:ml-0" />
                            {feature.isSoon && (
                              <span className="ml-2 text-[8px] font-bold uppercase tracking-wider dark:bg-white/10 bg-black/10 dark:text-white/50 text-slate-500 px-1.5 py-[1px] rounded-full font-sans border dark:border-white/10 border-black/10 align-middle">
                                {t('common.soon') || 'Soon'}
                              </span>
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Find Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="inline-flex items-center rounded-full font-sans dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6">
                {t('features.sections.find.badge') || 'Find'}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('features.sections.find.title') || 'Zero in on the buyers who matter'}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('features.sections.find.subtitle') || 'Build, refine, and activate your ideal lead list directly within the platform. We automatically dedupe and map new contacts to accounts so your data is always clean and actionable.'}
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'icp-generation', name: t('features.stages.find.f6') || "ICP generation", icon: <Users size={14} className="text-orange-400" /> },
                  { id: 'tam-sourcing', name: t('features.stages.find.f1') || "TAM sourcing", icon: <Search size={14} className="text-orange-400" /> },
                  { id: 'company-enrichment', name: t('features.stages.find.f3') || "Company enrichment", icon: <Building size={14} className="text-orange-400" /> }
                ].map((item, i) => (
                  <li key={i} className="flex items-center dark:text-white/80 text-slate-500 font-medium group">
                    <Link href={`/product/features/${item.id}`} className="flex items-center hover:text-orange-400 transition-colors w-full">
                      <div className="w-8 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-orange-500/30 transition-colors">
                        {item.icon}
                      </div>
                      <span className="flex items-center gap-1.5">{item.name} <ArrowUpRight size={12} className="opacity-0 -ml-2 transition-all group-hover:opacity-100 group-hover:ml-0" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/product/features?stage=Find" className="inline-flex items-center text-sm font-bold text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300 transition-colors group">
                  {t('common.learnMore') || 'Learn more'} 
                  <ArrowUpRight size={14} className="ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </Link>
              </div>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                {/* Retro-futuristic pattern */}
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_bottom_right,transparent,transparent_8px,rgba(249,115,22,0.02)_8px,rgba(249,115,22,0.02)_16px)] opacity-100 pointer-events-none rounded-xl"></div>
                {/* Scanner effect */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-[scan_3s_ease-in-out_infinite] pointer-events-none z-20"></div>
                
                {/* Mockup UI */}
                <div className="flex justify-between items-center mb-6 border-b dark:border-white/5 border-black/5 pb-4 relative z-10">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md dark:neu-panel neu-panel-light flex items-center justify-center text-orange-400">
                      <Search size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 font-semibold text-sm">{t('features.sections.find.mockup.title') || 'Target Accounts'}</div>
                      <div className="dark:text-white/40 text-slate-500 text-xs">{t('features.sections.find.mockup.subtitle') || 'Finding matches...'}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-24 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center text-orange-400 text-xs font-medium">
                      <Bot size={14} className="mr-2" /> {t('features.sections.find.mockup.auto') || 'Auto-find'}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 relative z-10">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-md border transition-all duration-500 ${i === 1 ? 'bg-orange-500/10 border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.1)] -translate-y-1' : 'dark:bg-white/[0.03] bg-black/5 dark:border-white/5 border-black/5 hover:dark:bg-white/[0.08] bg-black/10'}`}>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full font-sans flex items-center justify-center ${i === 1 ? 'bg-orange-500/20 text-orange-400' : 'dark:bg-white/10 bg-black/10 dark:text-white/40 text-slate-500'}`}>
                            <Building size={18} />
                          </div>
                          {i === 1 && <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full font-sans font-bold bg-emerald-500 border-2 border-[#09090b] shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>}
                        </div>
                        <div>
                          <div className="w-32 h-3 dark:neu-skeleton neu-skeleton-light rounded-md mb-2"></div>
                          <div className="flex gap-2">
                            <div className="w-16 h-2 dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                            <div className="w-12 h-2 dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${i === 1 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'dark:text-white/40 text-slate-500 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10'}`}>
                        {i === 1 ? (t('features.sections.find.mockup.enriched') || 'Enriched') : (t('features.sections.find.mockup.pending') || 'Pending')}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Floating elements */}
                <div className="absolute -right-8 top-1/4 w-40 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-slow transition-transform group-hover:scale-105 z-30">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full font-sans font-bold bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <CheckSquare size={14} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-xs font-bold">{t('features.sections.find.mockup.dataFound') || 'Data Found'}</div>
                      <div className="dark:text-white/50 text-slate-500 text-[10px]">1,432 {t('features.sections.find.mockup.leads') || 'Leads'}</div>
                    </div>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                {/* Retro-futuristic pattern */}
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_10px,rgba(59,130,246,0.02)_10px,rgba(59,130,246,0.02)_20px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex gap-4 h-full relative z-10">
                  <div className="w-1/3 border-r dark:border-white/5 border-black/5 pr-4 flex flex-col gap-3">
                    <div className="text-xs dark:text-white/50 text-slate-500 mb-4 uppercase font-bold tracking-wider flex items-center">
                      <NetworkTree size={12} className="mr-2" /> {t('features.sections.contact.mockup.sequences') || 'Sequences'}
                    </div>
                    {[1,2,3,4].map((i) => (
                      <div key={i} className={`p-4 rounded-md border transition-all duration-300 cursor-pointer ${i===1 ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] translate-x-1' : 'dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5 hover:dark:bg-white/10 bg-black/10'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className={`w-16 h-2 rounded-full font-sans ${i===1 ? 'bg-blue-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]' : 'dark:neu-skeleton neu-skeleton-light opacity-70'}`}></div>
                          {i===1 && <div className="w-2 h-2 rounded-full font-sans font-bold bg-blue-400 animate-pulse"></div>}
                        </div>
                        <div className="w-full h-1.5 dark:neu-skeleton neu-skeleton-light opacity-50 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="w-2/3 flex flex-col gap-4">
                    <div className="flex gap-3 items-center border-b dark:border-white/5 border-black/5 pb-4">
                      <div className="w-10 h-10 rounded-full font-sans dark:neu-panel neu-panel-light flex items-center justify-center text-blue-400">
                        <Bot size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="dark:text-white text-slate-900 text-sm font-semibold">{t('features.sections.contact.mockup.assistant') || 'AI Assistant'}</div>
                        <div className="text-blue-400 text-xs">{t('features.sections.contact.mockup.drafting') || 'Drafting response...'}</div>
                      </div>
                    </div>
                    
                    <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden transition-colors duration-500">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full"></div>
                      
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full font-sans dark:neu-skeleton neu-skeleton-light flex-shrink-0"></div>
                        <div className="dark:bg-white/5 bg-black/5 rounded-lg rounded-tl-sm p-3 w-[80%] border dark:border-white/5 border-black/5 shadow-inner">
                          <div className="w-full h-2 dark:neu-skeleton neu-skeleton-light rounded-full font-sans mb-2"></div>
                          <div className="w-5/6 h-2 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 flex-row-reverse mt-2">
                        <div className="w-8 h-8 rounded-full font-sans font-bold bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                          <Bot size={14} />
                        </div>
                        <div className="bg-blue-500/10 rounded-lg rounded-tr-sm p-4 w-[85%] border border-blue-500/20 relative">
                          <div className="w-full h-2 bg-blue-400/50 rounded-full font-sans mb-3"></div>
                          <div className="w-5/6 h-2 bg-blue-400/50 rounded-full font-sans mb-3"></div>
                          <div className="w-4/6 h-2 bg-blue-400/50 rounded-full"></div>
                          <div className="absolute -left-2 top-1/2 w-1 h-1 bg-blue-400 rounded-full font-sans animate-bounce"></div>
                        </div>
                      </div>
                    </div>
                    <div className="w-32 h-10 dark:neu-button neu-button-light rounded-md self-end flex items-center justify-center dark:text-white text-slate-900 text-xs font-bold cursor-pointer">
                      {t('features.sections.contact.mockup.send') || 'Send Sequence'}
                    </div>
                  </div>
                </div>
                
                {/* Floating element */}
                <div className="absolute -left-8 top-1/3 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full font-sans font-bold bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 flex-shrink-0">
                      <Mail size={16} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-xs font-bold">{t('features.sections.contact.mockup.opened') || 'Email Opened'}</div>
                      <div className="dark:text-white/50 text-slate-500 text-[10px]">{t('features.sections.contact.mockup.openedBy') || 'Just now by John Doe'}</div>
                    </div>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="inline-flex items-center rounded-full font-sans dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6">
                {t('features.sections.contact.badge') || 'Contact'}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('features.sections.contact.title') || 'Build pipeline without the patchwork'}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('features.sections.contact.subtitle') || 'Scheduler and sequences built directly into your CRM. Manage your entire outreach without ever switching tabs.'}
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'sequencing', name: t('features.stages.contact.f3') || "Sequencing", icon: <NetworkTree size={14} className="text-blue-400" /> },
                  { id: 'scheduler', name: t('features.stages.contact.f5') || "Scheduler", icon: <Clock size={14} className="text-blue-400" /> },
                  { id: 'inbox-warming', name: t('features.stages.contact.f2') || "Inbox warming", icon: <CheckSquare size={14} className="text-blue-400" /> }
                ].map((item, i) => (
                  <li key={i} className="flex items-center dark:text-white/80 text-slate-500 font-medium group">
                    <Link href={`/product/features/${item.id}`} className="flex items-center hover:text-blue-400 transition-colors w-full">
                      <div className="w-8 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-blue-500/30 transition-colors">
                        {item.icon}
                      </div>
                      <span className="flex items-center gap-1.5">{item.name} <ArrowUpRight size={12} className="opacity-0 -ml-2 transition-all group-hover:opacity-100 group-hover:ml-0" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/product/features?stage=Contact" className="inline-flex items-center text-sm font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors group">
                  {t('common.learnMore') || 'Learn more'} 
                  <ArrowUpRight size={14} className="ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Sell Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="inline-flex items-center rounded-full font-sans dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6">
                {t('features.sections.sell.badge') || 'Sell'}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('features.sections.sell.title') || 'Turn traffic into conversions'}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('features.sections.sell.subtitle') || 'Use natively built AI tools to optimize ad campaigns, manage budgets, and capture high-intent leads on autopilot, keeping your inbound pipeline full.'}
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'seo-content', name: t('features.stages.sell.f3') || "SEO & Content automation", icon: <PieChart size={14} className="text-emerald-400" /> },
                  { id: 'inbound-automation', name: t('features.stages.sell.f2') || "Inbound Automation", icon: <Zap size={14} className="text-emerald-400" /> },
                  { id: 'smart-logging', name: t('features.stages.sell.f5') || "Smart task logging", icon: <CheckSquare size={14} className="text-emerald-400" /> }
                ].map((item, i) => (
                  <li key={i} className="flex items-center dark:text-white/80 text-slate-500 font-medium group">
                    <Link href={`/product/features/${item.id}`} className="flex items-center hover:text-emerald-400 transition-colors w-full">
                      <div className="w-8 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-emerald-500/30 transition-colors">
                        {item.icon}
                      </div>
                      <span className="flex items-center gap-1.5">{item.name} <ArrowUpRight size={12} className="opacity-0 -ml-2 transition-all group-hover:opacity-100 group-hover:ml-0" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/product/features?stage=Sell" className="inline-flex items-center text-sm font-bold text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors group">
                  {t('common.learnMore') || 'Learn more'} 
                  <ArrowUpRight size={14} className="ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </Link>
              </div>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group flex flex-col gap-4 font-sans">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                {/* Retro-futuristic pattern */}
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top_left,transparent,transparent_8px,rgba(16,185,129,0.02)_8px,rgba(16,185,129,0.02)_16px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex gap-4 relative z-10">
                  <div className="flex-1 rounded-md border dark:border-white/5 border-black/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-[20px] rounded-full"></div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1">{t('features.sections.sell.mockup.adSpend') || 'Ad Spend'}</div>
                    <div className="text-xl font-bold dark:text-white text-slate-900">$12,450</div>
                    <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> +5.2%</div>
                  </div>
                  <div className="flex-1 rounded-md border dark:border-white/5 border-black/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-[20px] rounded-full"></div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1">ROAS</div>
                    <div className="text-xl font-bold dark:text-white text-slate-900">4.2x</div>
                    <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> +1.1x</div>
                  </div>
                  <div className="flex-1 rounded-md border dark:border-white/5 border-black/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-[20px] rounded-full"></div>
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1">{t('features.sections.sell.mockup.costPerLead') || 'Cost / Lead'}</div>
                    <div className="text-xl font-bold dark:text-white text-slate-900">$42.50</div>
                    <div className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1"><TrendingUp size={10} /> -12%</div>
                  </div>
                </div>

                {/* Campaigns List */}
                <div className="flex-1 rounded-lg border dark:border-white/5 border-black/5 p-5 relative overflow-hidden flex flex-col gap-3 z-10 dark:neu-panel neu-panel-light">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs dark:text-white/80 text-slate-500 font-bold tracking-wider uppercase flex items-center gap-2">
                      <Target size={14} className="text-emerald-400" /> {t('features.sections.sell.mockup.activeCampaigns') || 'Active Campaigns'}
                    </div>
                    <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                      <div className="w-1.5 h-1.5 rounded-full font-sans font-bold bg-emerald-400 animate-pulse"></div>
                      {t('features.sections.sell.mockup.aiOptimizing') || 'AI Optimizing'}
                    </div>
                  </div>

                  {/* Campaign Items */}
                  {[
                    { name: t('features.sections.sell.mockup.c1') || "Q4 Retargeting", status: t('features.sections.sell.mockup.active') || "Active", budget: "$150/d", leads: "142" },
                    { name: t('features.sections.sell.mockup.c2') || "Lookalike Top Tier", status: t('features.sections.sell.mockup.active') || "Active", budget: "$200/d", leads: "215" },
                    { name: t('features.sections.sell.mockup.c3') || "Cold Outbound Search", status: t('features.sections.sell.mockup.learning') || "Learning", budget: "$80/d", leads: "24" }
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
                        <div className="text-[10px] dark:text-white/40 text-slate-500">{t('features.sections.find.mockup.leads') || 'Leads'}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating Element */}
                <div className="absolute -right-6 top-1/2 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30 dark:bg-[#09090b] bg-white/90 backdrop-blur-xl border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full font-sans font-bold bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                      <Target size={16} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-xs font-bold">{t('features.sections.sell.mockup.newLead') || 'New Lead'}</div>
                      <div className="text-emerald-400 text-[10px]">{t('features.sections.sell.mockup.viaLookalike') || 'via Lookalike Tier'}</div>
                    </div>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Manage Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group flex flex-col font-sans">
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                {/* Retro-futuristic pattern */}
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_12px,rgba(139,92,246,0.02)_12px,rgba(139,92,246,0.02)_24px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="space-y-2">
                    <div className="text-xs dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                      <TrendingUp size={12} /> {t('features.sections.manage.mockup.pipelineValue') || 'Pipeline Value'}
                    </div>
                    <div className="text-4xl font-bold dark:text-white text-slate-900 flex items-center gap-3">
                      $2.4M
                    </div>
                  </div>
                  
                  {/* Floating Chart Element */}
                  <div className="absolute right-[-1rem] top-[-1.5rem] w-[260px] rounded-xl dark:neu-panel neu-panel-light p-4 animate-float-slow transition-transform group-hover:scale-105 group-hover:-translate-y-2 z-30 shadow-2xl border dark:border-white/10 border-black/10 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md hidden sm:block">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
                    <div className="absolute right-0 top-0 w-32 h-32 bg-violet-500/5 blur-[30px] rounded-full font-sans pointer-events-none"></div>
                    <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold dark:text-white/80 text-slate-500 uppercase tracking-wider min-w-0">
                        <BarChart size={12} className="text-violet-500 shrink-0" /> 
                        <span className="truncate">{t('features.sections.manage.mockup.projected') || 'Projected Revenue'}</span>
                      </div>
                      <div className="text-[10px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <TrendingUp size={10} /> +14%
                      </div>
                    </div>
                    <div className="flex gap-1.5 items-end h-16 w-full relative z-10">
                        {[30, 45, 25, 60, 40, 75, 50].map((h, i) => (
                          <div key={i} className={`flex-1 rounded-t-sm relative group/bar cursor-pointer ${i === 5 ? 'bg-violet-500/20' : 'dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 transition-colors'}`} style={{ height: '100%' }}>
                            <div className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-500 ${i === 5 ? 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]' : 'dark:bg-white/20 bg-black/20 group-hover/bar:dark:bg-white/40 group-hover/bar:bg-black/40'}`} style={{ height: `${h}%` }}></div>
                          </div>
                        ))}
                      </div>
                    </div>
                </div>
                
                <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-5 flex flex-col relative overflow-hidden transition-colors duration-500">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-violet-500/10 blur-[40px] rounded-full"></div>
                  
                  {/* Copilot insight */}
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-md p-4 flex gap-4 items-start backdrop-blur-md relative overflow-hidden mb-auto">
                    <div className="absolute right-0 top-0 w-16 h-full bg-gradient-to-l from-violet-500/10 to-transparent"></div>
                    <div className="w-8 h-8 rounded-full font-sans font-bold bg-violet-500/20 flex items-center justify-center shrink-0 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                      <Bot size={16} className="text-violet-400" />
                    </div>
                    <div>
                      <div className="text-xs text-violet-300 font-bold tracking-wider mb-2 uppercase flex items-center gap-2">
                        <Star size={12} /> {t('features.sections.manage.mockup.insight') || 'Copilot Insight'}
                      </div>
                      <div className="dark:text-white/80 text-slate-500 text-sm leading-relaxed">
                        {t('features.sections.manage.mockup.insightText') || 'Acme Corp deal is stalling. Consider sending the ROI calculator to the CFO. I can draft this email for you.'}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <div className="bg-violet-500 dark:text-white text-slate-900 text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer hover:bg-violet-600 transition-colors">
                          {t('features.sections.manage.mockup.draftEmail') || 'Draft Email'}
                        </div>
                        <div className="dark:bg-white/10 bg-black/10 dark:text-white/70 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer hover:dark:bg-white/20 bg-black/20 transition-colors">
                          {t('features.sections.manage.mockup.dismiss') || 'Dismiss'}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pipeline stages */}
                  <div className="w-full flex justify-between mt-6 px-2 relative z-10 gap-2">
                    {[
                      { name: t('features.sections.manage.mockup.stage1') || "Lead", color: "bg-blue-400" },
                      { name: t('features.sections.manage.mockup.stage2') || "Meeting", color: "bg-orange-400" },
                      { name: t('features.sections.manage.mockup.stage3') || "Proposal", color: "bg-violet-400" },
                      { name: t('features.sections.manage.mockup.stage4') || "Negotiation", color: "bg-pink-400" },
                      { name: t('features.sections.manage.mockup.stage5') || "Closed", color: "bg-emerald-400" }
                    ].map((stage, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1">
                        <div className="text-[9px] dark:text-white/50 text-slate-500 uppercase font-semibold tracking-wider">{stage.name}</div>
                        <div className={`w-full h-1.5 rounded-full font-sans ${i <= 2 ? stage.color : 'dark:bg-white/10 bg-black/10'} ${i === 2 ? 'shadow-[0_0_10px_rgba(139,92,246,0.5)]' : ''}`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="inline-flex items-center rounded-full font-sans dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6">
                {t('features.sections.manage.badge') || 'Manage'}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('features.sections.manage.title') || 'Operate from a single source of truth'}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('features.sections.manage.subtitle') || 'Your pipeline manages itself with automated activity logging and stage gating. You can trust your forecast because it\'s based on real activity, not manual updates.'}
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'crm', name: t('features.stages.manage.f1') || "CRM", icon: <Users size={14} className="text-violet-400" /> },
                  { id: 'ai-copilot', name: t('features.stages.manage.f2') || "Ask AI Copilot", icon: <Bot size={14} className="text-violet-400" /> },
                  { id: 'reporting', name: t('features.stages.manage.f3') || "Reporting", icon: <PieChart size={14} className="text-violet-400" /> }
                ].map((item, i) => (
                  <li key={i} className="flex items-center dark:text-white/80 text-slate-500 font-medium group">
                    <Link href={`/product/features/${item.id}`} className="flex items-center hover:text-violet-400 transition-colors w-full">
                      <div className="w-8 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-violet-500/30 transition-colors">
                        {item.icon}
                      </div>
                      <span className="flex items-center gap-1.5">{item.name} <ArrowUpRight size={12} className="opacity-0 -ml-2 transition-all group-hover:opacity-100 group-hover:ml-0" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/product/features?stage=Manage" className="inline-flex items-center text-sm font-bold text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 transition-colors group">
                  {t('common.learnMore') || 'Learn more'} 
                  <ArrowUpRight size={14} className="ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
