"use client"

import React, { useRef } from "react"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { CalendarIcon, NetworkTree, BarChart, CheckSquare, MessageSquare, Target, Bot, TrendingUp } from "@/app/components/ui/icons"


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

export function CmsFeatures() {
  return (
    <>
      {/* Distribution & Scheduling Section Header */}
      <section className="relative w-full pt-24 pb-12 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                Publishing & <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-400">Distribution</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                Plan, collaborate, and publish thumb-stopping content that drives meaningful engagement and growth across every channel.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Feature 1: Visual Content Calendar */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-orange-500/5 flex items-center justify-center text-orange-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <CalendarIcon size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Visual Content Calendar
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Get a bird's-eye view of your entire strategy. Drag and drop posts, schedule weeks in advance, and maintain a consistent cadence.
              </p>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_20px,rgba(249,115,22,0.02)_20px,rgba(249,115,22,0.02)_40px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-[scan_3s_ease-in-out_infinite] pointer-events-none z-20"></div>
                  
                  {/* Calendar UI */}
                  <div className="flex justify-between items-center mb-6 border-b dark:border-white/5 border-black/5 pb-4 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md dark:neu-panel neu-panel-light flex items-center justify-center text-orange-400">
                        <CalendarIcon size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <div className="dark:text-white text-slate-900 font-semibold text-sm">October 2026</div>
                        <div className="dark:text-white/40 text-slate-500 text-xs">Content Schedule</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-20 h-7 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center text-orange-400 text-[10px] font-bold">
                        Month View
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 relative z-10">
                    <div className="w-1/4 flex flex-col gap-3">
                       <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Filters</div>
                       {['LinkedIn', 'Twitter', 'Blog', 'Newsletter'].map((filter, i) => (
                         <div key={i} className={`text-xs px-3 py-1.5 rounded-md border ${i===0 || i===1 ? 'bg-orange-500/10 border-orange-500/20 text-orange-400 font-bold' : 'dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5 text-slate-500'}`}>
                           {filter}
                         </div>
                       ))}
                    </div>
                    <div className="w-3/4">
                      <div className="grid grid-cols-7 gap-1.5">
                        {['S','M','T','W','T','F','S'].map((d, index) => (
                          <div key={index} className="text-center text-[10px] font-bold dark:text-white/50 text-slate-500 mb-1">{d}</div>
                        ))}
                        {Array.from({length: 28}).map((_, i) => (
                          <div key={i} className={`aspect-square rounded-md border p-1 flex flex-col gap-1 relative overflow-hidden group/day transition-colors hover:dark:bg-white/10 hover:bg-black/10 cursor-pointer ${i===14 ? 'bg-orange-500/10 border-orange-500/30' : 'dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5'}`}>
                            <span className={`text-[8px] font-bold ${i===14 ? 'text-orange-400' : 'dark:text-white/40 text-slate-500'}`}>{i + 1}</span>
                            {i % 3 === 0 && <div className="w-full h-1 bg-blue-500/50 rounded-full"></div>}
                            {i % 5 === 0 && <div className="w-full h-1 bg-emerald-500/50 rounded-full"></div>}
                            {i === 14 && <div className="w-full h-1 bg-orange-500 rounded-full shadow-[0_0_5px_rgba(249,115,22,0.8)] animate-pulse"></div>}
                            {i === 14 && <div className="absolute inset-0 border border-orange-500/50 rounded-md"></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating element */}
                  <div className="absolute -right-6 bottom-1/4 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30 shadow-xl border border-orange-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <CheckSquare size={14} />
                      </div>
                      <div>
                        <div className="dark:text-white text-slate-900 text-xs font-bold">Auto-Published</div>
                        <div className="dark:text-white/50 text-slate-500 text-[10px]">Just now to Twitter</div>
                      </div>
                    </div>
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 2: Multi-channel Scheduling */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_16px,rgba(59,130,246,0.02)_16px,rgba(59,130,246,0.02)_32px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_3s_ease-in-out_infinite_reverse] pointer-events-none z-20"></div>

                  {/* Network Graph Mockup */}
                  <div className="relative w-64 h-64 z-10">
                    {/* Central Node */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)] flex items-center justify-center text-white z-20 hover:scale-110 transition-transform cursor-pointer">
                      <Bot size={32} />
                      <div className="absolute inset-0 rounded-2xl border-2 border-white/20 animate-ping"></div>
                    </div>
                    
                    {/* Lines & Orbit Nodes */}
                    {[
                      { deg: -18, label: "LinkedIn" },
                      { deg: 54, label: "Twitter" },
                      { deg: 126, label: "Instagram" },
                      { deg: 198, label: "TikTok" },
                      { deg: 270, label: "Facebook" }
                    ].map((orbit, i) => (
                      <div key={i} className="absolute top-1/2 left-1/2 w-[65%] h-[1px] bg-gradient-to-r from-blue-500/10 to-blue-500/50 origin-left" style={{ transform: `rotate(${orbit.deg}deg)` }}>
                        <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/2 group/node cursor-pointer">
                          <div className="w-10 h-10 rounded-full dark:bg-[#09090b] bg-white flex items-center justify-center text-blue-400 border-2 dark:border-white/10 border-black/10 shadow-lg group-hover/node:border-blue-500 group-hover/node:text-blue-500 group-hover/node:shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all" style={{ transform: `rotate(${-orbit.deg}deg)` }}>
                             <NetworkTree size={16} />
                          </div>
                          <div className="absolute top-[130%] left-1/2 -translate-x-1/2 text-[10px] font-bold dark:text-white/60 text-slate-500 opacity-0 group-hover/node:opacity-100 transition-opacity whitespace-nowrap pointer-events-none" style={{ transform: `rotate(${-orbit.deg}deg)` }}>
                            {orbit.label}
                          </div>
                        </div>
                        {/* Data packet animation */}
                        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.8)] opacity-0 animate-[travel_2s_linear_infinite]" style={{ animationDelay: `${i * 0.7}s` }}></div>
                      </div>
                    ))}
                    
                    {/* Circular orbits */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] rounded-full border border-dashed dark:border-white/5 border-black/5 animate-[spin_20s_linear_infinite] pointer-events-none"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full border border-dashed dark:border-white/10 border-black/10 animate-[spin_15s_linear_infinite_reverse] pointer-events-none"></div>
                  </div>
                  
                  {/* Floating card */}
                  <div className="absolute top-8 left-8 w-48 rounded-md dark:neu-panel neu-panel-light p-4 z-30 shadow-xl border border-blue-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0 animate-pulse">
                         <NetworkTree size={14} />
                       </div>
                       <div>
                         <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-0.5">Sync Active</div>
                         <div className="text-xs font-bold dark:text-white text-slate-900">5 Platforms Live</div>
                       </div>
                    </div>
                  </div>

                  {/* Right panel mockup */}
                  <div className="absolute right-6 top-6 bottom-6 w-32 dark:neu-panel neu-panel-light rounded-lg border dark:border-white/5 border-black/5 p-3 flex flex-col gap-3 z-30 opacity-80 hover:opacity-100 transition-opacity">
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b dark:border-white/5 border-black/5 pb-2">Upcoming</div>
                     {[1,2,3,4].map(i => (
                       <div key={i} className="w-full h-12 rounded bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-2 flex flex-col gap-1.5 cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${i===1 ? 'bg-blue-400' : 'bg-slate-400 dark:bg-slate-600'}`}></div>
                            <div className="h-1.5 w-12 dark:bg-white/20 bg-black/20 rounded-full"></div>
                          </div>
                          <div className="h-1 w-full dark:bg-white/10 bg-black/10 rounded-full"></div>
                       </div>
                     ))}
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-blue-500/5 flex items-center justify-center text-blue-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <NetworkTree size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Multi-channel Scheduling
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Tailor and schedule posts for LinkedIn, Twitter, Instagram, Facebook, and TikTok from a single, unified dashboard.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 3: Analytics & Insights */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center text-emerald-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <BarChart size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Analytics & Insights
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Measure what works with deep analytics. Track engagement, reach, and click-through rates to optimize your future content.
              </p>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_20px,rgba(16,185,129,0.02)_20px,rgba(16,185,129,0.02)_40px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-emerald-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-[scan_vertical_3s_ease-in-out_infinite] pointer-events-none z-20"></div>

                  <div className="flex gap-4 h-full flex-col relative z-10">
                    <div className="flex justify-between items-center mb-2 border-b dark:border-white/5 border-black/5 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md dark:neu-panel neu-panel-light flex items-center justify-center text-emerald-400">
                          <BarChart size={20} className="animate-pulse" />
                        </div>
                        <div>
                          <div className="dark:text-white text-slate-900 font-bold">Audience Growth</div>
                          <div className="dark:text-white/40 text-slate-500 text-xs">Last 30 Days</div>
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        +24.5% TREND
                      </div>
                    </div>
                    
                    {/* Bar Chart Mockup with Line overlay */}
                    <div className="flex-1 flex items-end justify-between gap-2 mt-4 relative">
                      {/* Trend Line (SVG mockup) */}
                      <svg width="100%" height="100%" className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-70 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                         <path d="M0,80 Q10,70 20,60 T40,50 T60,30 T80,20 T100,5" fill="none" stroke="rgba(16,185,129,0.8)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="animate-[dash_5s_linear_infinite]" strokeDasharray="5,5" />
                      </svg>
                      
                      {[30, 45, 25, 60, 40, 75, 50, 85, 65, 95].map((h, i) => (
                        <div key={i} className="w-full relative group/bar rounded-t-sm dark:bg-white/5 bg-black/5 border-b-2 border-emerald-500/20 cursor-crosshair hover:dark:bg-white/10 hover:bg-black/10 transition-colors" style={{ height: '100%' }}>
                          <div className={`absolute bottom-0 w-full rounded-t-sm transition-all duration-700 ease-bounce ${i === 9 ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] border-t border-emerald-300' : 'bg-emerald-500/30 group-hover/bar:bg-emerald-500/50'}`} style={{ height: `${h}%`, transitionDelay: `${i * 50}ms` }}>
                             {/* Tooltip on hover */}
                             <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-[#09090b] text-emerald-400 text-[8px] font-bold px-2 py-1 rounded border border-emerald-500/30 shadow-xl whitespace-nowrap z-30">
                               {h}K Views
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="dark:neu-panel neu-panel-light rounded-lg p-4 border border-emerald-500/10 hover:border-emerald-500/30 transition-colors group/stat cursor-default">
                        <div className="text-[10px] font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-1">Total Reach</div>
                        <div className="text-xl font-bold dark:text-white text-slate-900 group-hover/stat:text-emerald-400 transition-colors">142.5K</div>
                      </div>
                      <div className="dark:neu-panel neu-panel-light rounded-lg p-4 border border-emerald-500/10 hover:border-emerald-500/30 transition-colors group/stat cursor-default relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-500/10 rounded-full blur-[15px]"></div>
                        <div className="text-[10px] font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-1">Eng. Rate</div>
                        <div className="text-xl font-bold dark:text-white text-slate-900 group-hover/stat:text-emerald-400 transition-colors">4.8%</div>
                      </div>
                      <div className="dark:neu-panel neu-panel-light rounded-lg p-4 border border-emerald-500/10 hover:border-emerald-500/30 transition-colors group/stat cursor-default">
                        <div className="text-[10px] font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-1">Conversions</div>
                        <div className="text-xl font-bold dark:text-white text-slate-900 group-hover/stat:text-emerald-400 transition-colors">1.2K</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Floating badge */}
                  <div className="absolute top-1/4 -right-4 w-40 rounded-md dark:neu-panel neu-panel-light p-3 animate-float-slow transition-transform group-hover:scale-105 z-30 shadow-2xl border border-emerald-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-[#09090b] shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        <CheckSquare size={10} />
                      </div>
                      <div className="text-[10px] font-bold dark:text-white text-slate-900">Goal Reached</div>
                    </div>
                    <div className="text-[8px] dark:text-white/50 text-slate-500 ml-7">Q3 Traffic target exceeded</div>
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 4: Approval Workflows */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans flex flex-col justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top_right,transparent,transparent_16px,rgba(139,92,246,0.02)_16px,rgba(139,92,246,0.02)_32px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-transparent via-violet-500 to-transparent opacity-30 shadow-[0_0_20px_rgba(139,92,246,0.8)] animate-[scan_vertical_4s_ease-in-out_infinite_reverse] pointer-events-none z-20"></div>
                  
                  {/* Pipeline Steps */}
                  <div className="space-y-4 relative z-10 w-full max-w-sm mx-auto">
                    {[
                      { title: "Drafting", status: "Done", color: "bg-emerald-500", meta: "By AI Assistant", icon: <CheckSquare size={12} /> },
                      { title: "Review", status: "In Progress", color: "bg-violet-500", meta: "Waiting on you", icon: <CalendarIcon size={12} /> },
                      { title: "Client Approval", status: "Locked", color: "dark:bg-white/10 bg-black/10 text-slate-400", meta: "Requires Sign-off", icon: <CheckSquare size={12} /> },
                      { title: "Scheduled", status: "Pending", color: "dark:bg-white/10 bg-black/10 text-slate-400", meta: "Oct 24, 9:00 AM", icon: <NetworkTree size={12} /> }
                    ].map((step, i) => (
                      <div key={i} className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-300 hover:scale-[1.02] cursor-pointer ${i === 1 ? 'border-violet-500/50 bg-violet-500/10 shadow-[0_0_30px_rgba(139,92,246,0.15)] -translate-y-1' : 'dark:border-white/5 border-black/5 dark:bg-white/[0.03] bg-black/5 hover:dark:bg-white/5 hover:bg-black/10'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner ${i === 1 ? 'bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.6)]' : step.color}`}>
                          {i === 0 ? <CheckSquare size={14} className="text-white" /> : step.icon}
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-bold ${i===1 ? 'text-violet-400' : 'dark:text-white text-slate-900'}`}>{step.title}</div>
                          <div className="text-[10px] dark:text-white/40 text-slate-500">{step.meta}</div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1.5">
                          {i === 1 && <div className="text-[8px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded border border-violet-500/30 flex items-center gap-1"><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse"></div> Action Needed</div>}
                          <div className="text-[10px] font-bold dark:text-white/60 text-slate-400 uppercase tracking-wider">{step.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Floating Action Button */}
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30 shadow-2xl border border-violet-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
                    <div className="text-[10px] uppercase font-bold text-violet-400 mb-3 tracking-wider">Review Required</div>
                    <div className="text-xs dark:text-white/80 text-slate-600 mb-4 line-clamp-2">"Here is the final draft for the Q3 feature launch blog..."</div>
                    <div className="flex gap-2">
                       <button className="flex-1 bg-violet-500 hover:bg-violet-600 text-white text-[10px] font-bold py-1.5 rounded transition-colors shadow-[0_0_10px_rgba(139,92,246,0.3)]">Approve</button>
                       <button className="flex-1 dark:bg-white/10 bg-black/10 hover:dark:bg-white/20 hover:bg-black/20 dark:text-white text-slate-900 text-[10px] font-bold py-1.5 rounded transition-colors">Edit</button>
                    </div>
                  </div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-violet-500/5 flex items-center justify-center text-violet-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <CheckSquare size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Approval Workflows
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Collaborate seamlessly with your team. Set up draft, review, and approval stages to ensure quality before anything goes live.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 5: Unified Engagement */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-rose-500/5 flex items-center justify-center text-rose-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <MessageSquare size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Unified Engagement
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Respond to comments, mentions, and direct messages across all your social channels without ever leaving the platform.
              </p>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans flex gap-4">
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(243,64,121,0.02)_10px,rgba(243,64,121,0.02)_20px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(243,64,121,0.8)] animate-[scan_3s_ease-in-out_infinite] pointer-events-none z-20"></div>

                  {/* Chat List */}
                  <div className="w-1/3 border-r dark:border-white/5 border-black/5 pr-4 flex flex-col gap-3 relative z-10">
                    <div className="text-xs dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-2 flex items-center justify-between">
                       Messages <div className="bg-rose-500/20 text-rose-500 px-1.5 py-0.5 rounded text-[8px] border border-rose-500/30">3 UNREAD</div>
                    </div>
                    {[
                      { source: 'Twitter', icon: <MessageSquare size={10} />, unread: true },
                      { source: 'LinkedIn', icon: <NetworkTree size={10} />, unread: false },
                      { source: 'Instagram', icon: <Target size={10} />, unread: false }
                    ].map((chat, i) => (
                      <div key={i} className={`p-3 rounded-lg border flex gap-3 transition-colors cursor-pointer hover:border-rose-500/30 hover:bg-rose-500/5 ${i===0 ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(243,64,121,0.15)] -translate-x-1' : 'dark:bg-white/[0.03] bg-black/5 dark:border-white/5 border-black/5'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${i===0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'dark:bg-white/10 bg-black/10 text-slate-400'}`}>
                           {chat.icon}
                        </div>
                        <div className="flex-1">
                          <div className={`text-[10px] font-bold mb-1 uppercase tracking-wider ${i===0 ? 'text-rose-400' : 'dark:text-white/60 text-slate-500'}`}>{chat.source}</div>
                          <div className={`h-1.5 rounded-full mb-1 ${i===0 ? 'bg-rose-400 w-full' : 'dark:bg-white/20 bg-black/20 w-3/4'}`}></div>
                          <div className="h-1 dark:bg-white/10 bg-black/10 rounded-full w-1/2"></div>
                        </div>
                        {chat.unread && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 self-center animate-pulse shadow-[0_0_8px_rgba(243,64,121,0.8)]"></div>}
                      </div>
                    ))}
                  </div>
                  
                  {/* Chat Area */}
                  <div className="w-2/3 flex flex-col relative z-10 bg-black/5 dark:bg-white/[0.02] rounded-xl border border-black/5 dark:border-white/5 p-4 overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-[40px] rounded-full"></div>
                     <div className="flex justify-between items-center border-b dark:border-white/5 border-black/5 pb-4 mb-4">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center border border-rose-500/30 shadow-[0_0_15px_rgba(243,64,121,0.2)]">
                           <MessageSquare size={18} />
                         </div>
                         <div>
                           <div className="text-sm font-bold dark:text-white text-slate-900">Twitter Mention</div>
                           <div className="text-[10px] text-rose-400 font-mono tracking-wider">@AcmeCorp</div>
                         </div>
                       </div>
                       <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                         Positive Sentiment
                       </div>
                     </div>
                     <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                       <div className="bg-rose-500/10 rounded-lg rounded-tl-sm p-4 w-[85%] border border-rose-500/20 text-xs dark:text-white/90 text-slate-700 shadow-sm relative group/msg">
                         Love the new CMS update! Great job team, it's making our workflow so much faster! 🎉🚀
                         <div className="absolute -bottom-2 -right-2 bg-[#09090b] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-rose-500/50 shadow-md">❤️ 12</div>
                       </div>
                       
                       <div className="self-end w-[85%] flex flex-col gap-2 relative mt-4">
                         <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider self-end mb-1 flex items-center gap-1.5"><Bot size={10} /> AI Suggestion</div>
                         <div className="dark:bg-[#1a1a1c] bg-white rounded-lg rounded-tr-sm p-4 border border-rose-500/30 shadow-[0_0_20px_rgba(243,64,121,0.1)] flex flex-col gap-3 group/reply cursor-pointer hover:border-rose-500 transition-colors">
                           <div className="text-xs dark:text-white/80 text-slate-600 font-medium">
                             Thanks so much! We're thrilled to hear it's speeding up your workflow. Let us know if you need any help with the new features!
                           </div>
                           <div className="flex gap-2 border-t dark:border-white/5 border-black/5 pt-3">
                              <button className="flex-1 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold py-1.5 rounded transition-colors shadow-[0_0_10px_rgba(243,64,121,0.3)] flex items-center justify-center gap-1">Send Reply</button>
                              <button className="px-3 dark:bg-white/10 bg-black/10 hover:dark:bg-white/20 hover:bg-black/20 dark:text-white text-slate-900 text-[10px] font-bold py-1.5 rounded transition-colors">Edit</button>
                           </div>
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

      {/* Feature 6: Campaign Management */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-sans flex flex-col gap-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_bottom_left,transparent,transparent_20px,rgba(6,182,212,0.02)_20px,rgba(6,182,212,0.02)_40px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-transparent via-cyan-500 to-transparent opacity-40 shadow-[0_0_20px_rgba(6,182,212,0.8)] animate-[scan_vertical_5s_ease-in-out_infinite_reverse] pointer-events-none z-20"></div>

                  <div className="flex justify-between items-center relative z-10 border-b dark:border-white/5 border-black/5 pb-4 mb-2">
                    <div className="text-sm font-bold dark:text-white text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Target size={16} className="text-cyan-500" /> Active Campaigns
                    </div>
                    <div className="bg-cyan-500/10 text-cyan-400 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-500/30">
                       <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                       AI Optimizing
                    </div>
                  </div>
                  
                  <div className="space-y-4 relative z-10">
                    {[
                      { name: "Q4 Product Launch", progress: 75, roas: "3.2x", spend: "$12.4K", platform: "LinkedIn" },
                      { name: "Brand Awareness", progress: 40, roas: "1.8x", spend: "$5.2K", platform: "Twitter" },
                      { name: "Holiday Special", progress: 10, roas: "0.0x", spend: "$0.8K", platform: "Meta" }
                    ].map((camp, i) => (
                      <div key={i} className={`p-5 rounded-lg border transition-all duration-300 hover:scale-[1.01] cursor-pointer relative overflow-hidden ${i===0 ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.15)]' : 'dark:border-white/5 border-black/5 dark:bg-white/[0.03] bg-black/5 hover:dark:bg-white/5 hover:bg-black/10'}`}>
                        {i===0 && <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-sm font-bold dark:text-white text-slate-900 mb-1">{camp.name}</div>
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{camp.platform}</div>
                          </div>
                          <div className="text-right">
                             <div className="text-xs text-cyan-500 font-bold mb-1">ROAS {camp.roas}</div>
                             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{camp.spend} Spent</div>
                          </div>
                        </div>
                        <div className="w-full h-2.5 dark:bg-[#09090b] bg-white rounded-full overflow-hidden border dark:border-white/10 border-black/10">
                          <div className={`h-full relative ${i===0 ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-600'}`} style={{ width: `${camp.progress}%` }}>
                             {i===0 && <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:10px_10px] animate-[slide_1s_linear_infinite]"></div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Floating Action Badge */}
                  <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-slow transition-transform group-hover:scale-105 z-30 shadow-2xl border border-cyan-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                        <TrendingUp size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-0.5">Budget Shifted</div>
                        <div className="text-xs font-bold dark:text-white text-slate-900">+$2K to Q4 Launch</div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-cyan-500/5 flex items-center justify-center text-cyan-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Target size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Campaign Management
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Group posts into campaigns, generate custom tracking links, and measure ROI across coordinated marketing efforts.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
