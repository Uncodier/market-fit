"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Search, Bot, Building, CheckSquare, FileText, ArrowUpRight, Zap, Target, CalendarIcon, NetworkTree, BarChart, MessageSquare, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OpenClawCard } from "@/app/components/auth/sections/OpenClawCard"
import { ContentCarousel } from "@/app/components/auth/sections/ContentCarousel"

import { CmsFeatures } from "./CmsFeatures"


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

export function CmsClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-orange-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-orange-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-orange-500/30 bg-orange-500/5 text-orange-500">
              <span className="flex h-2 w-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
              {t('cms.hero.chip') || 'Content Management System'}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              {t('cms.hero.title_start') || 'Automate your '} <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-500">{t('cms.hero.title_highlight') || 'content engine'}</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              {t('cms.hero.description') || 'Build your brand with SEO-optimized, auto-generated content. A complete CMS designed for high scale, performance, and inbound traffic generation.'}
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2 group">
                {t('cms.hero.cta_start') || 'Start with Makinari'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
                {t('cms.hero.cta_explore') || 'Explore all features'}
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
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans">
                <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_bottom_right,transparent,transparent_8px,rgba(249,115,22,0.02)_8px,rgba(249,115,22,0.02)_16px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-[scan_3s_ease-in-out_infinite] pointer-events-none z-20"></div>
                
                {/* Mockup UI */}
                <div className="flex justify-between items-center mb-6 border-b dark:border-white/5 border-black/5 pb-4 relative z-10">
                  <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md dark:neu-panel neu-panel-light flex items-center justify-center text-orange-400">
                      <FileText size={20} className="animate-pulse" />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 font-semibold text-sm">{t('cms.mockup.pipeline') || 'Content Pipeline'}</div>
                      <div className="dark:text-white/40 text-slate-500 text-xs">{t('cms.mockup.generating') || 'Generating articles...'}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-24 h-8 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center text-orange-400 text-xs font-medium">
                      <Bot size={14} className="mr-2" /> {t('cms.mockup.auto_publish') || 'Auto-publish'}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4 relative z-10">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-md border transition-all duration-500 ${i === 1 ? 'bg-orange-500/10 border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.1)] -translate-y-1' : 'dark:bg-white/[0.03] bg-black/5 dark:border-white/5 border-black/5 hover:dark:bg-white/[0.08] bg-black/10'}`}>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i === 1 ? 'bg-orange-500/20 text-orange-400' : 'dark:bg-white/10 bg-black/10 dark:text-white/40 text-slate-500'}`}>
                            <FileText size={18} />
                          </div>
                          {i === 1 && <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#09090b] shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>}
                        </div>
                        <div>
                          <div className="w-40 h-3 dark:neu-skeleton neu-skeleton-light rounded-md mb-2"></div>
                          <div className="flex gap-2">
                            <div className="w-16 h-2 dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                            <div className="w-12 h-2 dark:neu-skeleton neu-skeleton-light opacity-70 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${i === 1 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'dark:text-white/40 text-slate-500 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10'}`}>
                        {i === 1 ? (t('cms.mockup.status.published') || 'Published') : (t('cms.mockup.status.drafting') || 'Drafting')}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Floating elements */}
                <div className="absolute -left-8 top-1/4 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-slow transition-transform group-hover:scale-105 z-30 shadow-xl border border-orange-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <CheckSquare size={14} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-xs font-bold">{t('cms.mockup.seo_score') || 'SEO Score 98/100'}</div>
                      <div className="dark:text-white/50 text-slate-500 text-[10px]">{t('cms.mockup.optimized_for') || 'Optimized for "B2B Sales"'}</div>
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
                {t('cms.features.scale_title') || 'Scale traffic systematically'}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('cms.features.scale_desc') || 'Go from a few posts a month to an entire media arm. Generate landing pages, blogs, and resources that rank quickly and convert organically.'}
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'seo-content', name: t('cms.features.list.seo.name') || "SEO Optimization", icon: <Search size={18} className="text-orange-400" />, desc: t('cms.features.list.seo.desc') || "Find semantic gaps and create clusters that rank on page one." },
                  { id: 'ai-copilot', name: t('cms.features.list.ai.name') || "AI Drafting", icon: <FileText size={18} className="text-orange-400" />, desc: t('cms.features.list.ai.desc') || "Produce thousands of hyper-targeted pages with authentic tone." },
                  { id: 'workflows', name: t('cms.features.list.workflows.name') || "Omnichannel Distribution", icon: <Zap size={18} className="text-orange-400" />, desc: t('cms.features.list.workflows.desc') || "Automatically sync to socials, newsletters, and ad creatives." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-orange-500/5 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-orange-500/30 transition-colors">
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

      {/* Bento Grid Layout for CMS features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                {t('cms.bento.title_start') || 'The ultimate '} <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400">{t('cms.bento.title_highlight') || 'Content Machine'}</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                {t('cms.bento.description') || 'Turn your ideas into multi-format content architectures published across every channel automatically.'}
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 1: Programmatic SEO */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(249,115,22,0.1)_8px,rgba(249,115,22,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(249,115,22,0.05)_8px,rgba(249,115,22,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-orange-500 mb-6 bg-orange-500/5">
                    <Search size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('cms.bento.generation.title') || 'AI Content Generation'}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('cms.bento.generation.desc') || 'Generate thousands of localized, use-case specific landing pages, blog posts, and articles automatically using our advanced AI engine.'}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNmOTczMTYiIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

            {/* Bento 2: Deep Research */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(225,29,72,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(225,29,72,0.1)_10px,rgba(225,29,72,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-rose-500 mb-6 bg-rose-500/5">
                    <Bot size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('cms.bento.research.title') || 'Deep Research'}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('cms.bento.research.desc') || 'Our AI agents conduct deep web research on any topic to ensure the content generated is factually accurate, up-to-date, and highly relevant.'}
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: Video Generation */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(225,29,72,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(225,29,72,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(225,29,72,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.03] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-rose-500 mb-6 bg-rose-500/5">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('cms.bento.video.title') || 'AI Video Creator'}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('cms.bento.video.desc') || 'Turn blog posts into engaging short-form videos with AI avatars, voiceovers, and dynamic captions automatically.'}
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: Brand Voice */}
            <Reveal delay={400} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(249,115,22,0.1)_8px,rgba(249,115,22,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-orange-500 mb-6 bg-orange-500/5">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">{t('cms.bento.brand.title') || 'Trained on Your Brand'}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    {t('cms.bento.brand.desc') || 'Upload your past content, style guides, and documentation. Our RAG (Retrieval-Augmented Generation) system ensures every piece of content sounds exactly like your best writer.'}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#f97316_10px,#f97316_20px)] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      <CmsFeatures />

      {/* Agents Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <OpenClawCard />
      </section>

      <ContentCarousel showLearnMore={false} />

      <SiteFooter />
    </div>
  )
}
