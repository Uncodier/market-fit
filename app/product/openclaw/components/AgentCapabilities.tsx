"use client"

import * as React from "react"
import { useRef } from "react"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Globe, Code, Zap, Plug, Target, Database, Bot, Search, FileText, CheckSquare, MessageSquare } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"


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

export function AgentCapabilities() {
  const { t } = useLocalization()

  return (
    <div className="w-full mt-24">
      <div className="text-center mb-16 relative z-20 max-w-7xl mx-auto px-6 lg:px-12">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
          {t('openclaw.capabilities.title.start')}<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">{t('openclaw.capabilities.title.highlight')}</span>
        </h2>
        <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-3xl mx-auto font-light">
          {t('openclaw.capabilities.subtitle')}
        </p>
      </div>

      {/* Feature 1: Web Navigation */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-orange-500/5 flex items-center justify-center text-orange-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Globe size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('openclaw.capabilities.c1.title')}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('openclaw.capabilities.c1.desc')}
              </p>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_20px,rgba(249,115,22,0.02)_20px,rgba(249,115,22,0.02)_40px)] opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(249,115,22,0.8)] animate-[scan_3s_ease-in-out_infinite] pointer-events-none z-20"></div>
                  
                  {/* Browser Mockup */}
                  <div className="w-full h-full rounded-lg dark:bg-[#09090b] bg-white border dark:border-white/10 border-black/10 overflow-hidden shadow-2xl relative z-10 flex flex-col">
                     {/* Browser Header */}
                     <div className="h-10 border-b dark:border-white/10 border-black/10 flex items-center px-4 gap-4 dark:bg-black/40 bg-slate-50">
                        <div className="flex gap-1.5">
                           <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                           <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                           <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                        </div>
                        <div className="flex-1 max-w-sm mx-auto h-6 dark:bg-white/5 bg-black/5 rounded-md flex items-center px-3 gap-2">
                           <Globe size={12} className="dark:text-white/40 text-slate-400" />
                           <div className="text-[10px] dark:text-white/60 text-slate-500 font-mono">https://target-company.com/about</div>
                        </div>
                     </div>
                     
                     {/* Web Content & Agent Overlay */}
                     <div className="flex-1 relative overflow-hidden bg-white dark:bg-[#121214] p-4">
                        <div className="w-full h-1/2 dark:bg-white/5 bg-slate-100 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                           {/* Simulated webpage content */}
                           <div className="absolute inset-0 opacity-20">
                              <div className="w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.1)_25%,rgba(0,0,0,0.1)_50%,transparent_50%,transparent_75%,rgba(0,0,0,0.1)_75%,rgba(0,0,0,0.1)_100%)] bg-[length:20px_20px]"></div>
                           </div>
                           <div className="text-2xl font-bold dark:text-white/20 text-slate-300">Target Company Inc.</div>
                        </div>
                        <div className="space-y-2">
                           <div className="w-3/4 h-3 dark:bg-white/5 bg-slate-100 rounded-full"></div>
                           <div className="w-1/2 h-3 dark:bg-white/5 bg-slate-100 rounded-full"></div>
                           <div className="w-5/6 h-3 dark:bg-white/5 bg-slate-100 rounded-full"></div>
                        </div>
                        
                        {/* Agent Selection Overlay */}
                        <div className="absolute top-1/4 left-1/4 w-40 h-24 border-2 border-orange-500 bg-orange-500/10 rounded-lg animate-[pulse_2s_ease-in-out_infinite] z-20 flex items-end p-2">
                           <div className="bg-orange-500 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-lg uppercase tracking-wider flex items-center gap-1">
                              <Bot size={10} /> Extracting Data
                           </div>
                        </div>
                        
                        {/* Cursor Graphic */}
                        <div className="absolute top-1/3 left-1/3 z-30 animate-[slide_3s_ease-in-out_infinite_alternate]">
                           <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                              <path d="M1 1L5.5 15L8 9.5L13.5 11L1 1Z" fill="#f97316" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                           </svg>
                        </div>
                     </div>
                  </div>
                  
                  {/* Floating Action */}
                  <div className="absolute -right-6 bottom-1/4 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30 shadow-xl border border-orange-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                        <CheckSquare size={14} />
                      </div>
                      <div>
                        <div className="dark:text-white text-slate-900 text-xs font-bold">Data Scraped</div>
                        <div className="dark:text-white/50 text-slate-500 text-[10px]">Saved to CRM</div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 2: Code Execution */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  
                  {/* Terminal IDE Mockup */}
                  <div className="w-full h-full rounded-lg dark:bg-[#1e1e1e] bg-[#2d2d2d] border dark:border-white/10 border-black/20 overflow-hidden shadow-2xl relative z-10 flex flex-col">
                     <div className="h-10 border-b border-white/10 flex items-center px-4 gap-4 bg-black/40">
                        <div className="flex gap-1.5">
                           <div className="w-3 h-3 rounded-full bg-white/20"></div>
                           <div className="w-3 h-3 rounded-full bg-white/20"></div>
                        </div>
                        <div className="flex-1 flex gap-2">
                           <div className="text-[10px] text-purple-400 bg-white/5 px-3 py-1 rounded flex items-center gap-1.5">
                              <Code size={12} /> script.py
                           </div>
                        </div>
                     </div>
                     <div className="flex-1 p-4 font-mono text-[10px] leading-relaxed text-slate-300 overflow-hidden flex flex-col">
                        <div className="flex gap-4 opacity-50 mb-2">
                           <span className="w-4 text-right">1</span>
                           <span className="text-purple-300">import</span> <span>requests</span>
                        </div>
                        <div className="flex gap-4 opacity-50 mb-2">
                           <span className="w-4 text-right">2</span>
                           <span className="text-purple-300">import</span> <span>pandas</span> <span className="text-purple-300">as</span> <span>pd</span>
                        </div>
                        <div className="flex gap-4 mb-2">
                           <span className="w-4 text-right opacity-50">3</span>
                           <span></span>
                        </div>
                        <div className="flex gap-4 mb-2">
                           <span className="w-4 text-right opacity-50">4</span>
                           <span className="text-blue-300">def</span> <span className="text-yellow-200">process_data</span><span>(url):</span>
                        </div>
                        <div className="flex gap-4 mb-2 relative">
                           <span className="w-4 text-right opacity-50">5</span>
                           <span className="pl-4">response = requests.get(url)</span>
                           {/* Typing indicator overlay */}
                           <div className="absolute top-0 left-48 w-2 h-3 bg-slate-300 animate-pulse"></div>
                        </div>
                        
                        {/* Terminal Panel */}
                        <div className="mt-auto h-1/3 bg-black/60 rounded-md border border-white/5 p-3 flex flex-col gap-2">
                           <div className="text-[9px] text-white/40 uppercase tracking-widest border-b border-white/10 pb-1 mb-1">Execution Log</div>
                           <div className="flex gap-2 text-emerald-400">
                              <span>&gt;</span> <span>Running script.py...</span>
                           </div>
                           <div className="flex gap-2 text-slate-400">
                              <span>&gt;</span> <span>Data fetched successfully (245kb)</span>
                           </div>
                           <div className="flex gap-2 text-purple-400">
                              <span>&gt;</span> <span>Processing complete. Exit 0.</span>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  {/* Floating card */}
                  <div className="absolute top-8 -left-6 w-40 rounded-md dark:neu-panel neu-panel-light p-3 z-30 shadow-xl border border-purple-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                    <div className="flex items-center gap-2 mb-1">
                      <Bot size={14} className="text-purple-500" />
                      <div className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">Agent Logic</div>
                    </div>
                    <div className="text-xs dark:text-white text-slate-900 font-medium">Auto-generated script</div>
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-purple-500/5 flex items-center justify-center text-purple-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Code size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('openclaw.capabilities.c2.title')}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('openclaw.capabilities.c2.desc')}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 3: Action Execution */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center text-emerald-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Zap size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('openclaw.capabilities.c3.title')}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('openclaw.capabilities.c3.desc')}
              </p>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col gap-4">
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top_right,transparent,transparent_20px,rgba(16,185,129,0.02)_20px,rgba(16,185,129,0.02)_40px)] opacity-100 pointer-events-none rounded-xl"></div>
                  
                  {/* Task Sequence UI */}
                  <div className="flex justify-between items-center relative z-10 border-b dark:border-white/5 border-black/5 pb-4 mb-2">
                    <div className="text-sm font-bold dark:text-white text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Target size={16} className="text-emerald-500" /> Action Sequence
                    </div>
                  </div>
                  
                  <div className="space-y-4 relative z-10">
                    {[
                      { name: "Click 'Export CSV'", status: "Completed", icon: <Globe size={14}/>, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30", active: false },
                      { name: "Fill form 'Lead Details'", status: "In Progress", icon: <Code size={14}/>, color: "text-blue-500 bg-blue-500/10 border-blue-500/30", active: true },
                      { name: "Submit application", status: "Pending", icon: <Zap size={14}/>, color: "dark:text-white/40 text-slate-500 dark:bg-white/5 bg-black/5 dark:border-white/10 border-black/10", active: false }
                    ].map((task, i) => (
                      <div key={i} className={`p-4 rounded-lg border transition-all duration-300 flex items-center gap-4 ${task.active ? 'scale-[1.02] shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-white/50 dark:bg-[#121214]/50 backdrop-blur-md' : 'dark:bg-white/[0.02] bg-black/5'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${task.color}`}>
                           {task.active ? <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div> : (i === 0 ? <CheckSquare size={14} className="text-emerald-500" /> : task.icon)}
                        </div>
                        <div className="flex-1">
                          <div className={`text-sm font-bold ${task.active ? 'text-blue-500 dark:text-blue-400' : 'dark:text-white text-slate-900'}`}>{task.name}</div>
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{task.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Flow connection lines */}
                  <div className="absolute left-[3.25rem] top-28 bottom-28 w-px border-l-2 border-dashed dark:border-white/10 border-black/10 z-0"></div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 4: Integration */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  
                  {/* API Connection Mockup */}
                  <div className="flex flex-col items-center gap-6 relative z-10 w-full max-w-sm">
                     <div className="flex justify-between w-full items-center">
                        <div className="w-16 h-16 rounded-2xl dark:bg-[#1a1a1c] bg-white border border-black/10 dark:border-white/10 shadow-lg flex items-center justify-center text-orange-500">
                           <Bot size={28} />
                        </div>
                        
                        {/* Animated Connection */}
                        <div className="flex-1 h-2 relative flex items-center justify-center">
                           <div className="absolute w-full border-t-2 border-dashed border-blue-500/30"></div>
                           <div className="w-16 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center gap-1 z-10">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-[bounce_1s_infinite]"></div>
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-[bounce_1s_infinite_0.2s]"></div>
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-[bounce_1s_infinite_0.4s]"></div>
                           </div>
                        </div>

                        <div className="w-16 h-16 rounded-2xl dark:bg-[#1a1a1c] bg-white border border-black/10 dark:border-white/10 shadow-lg flex items-center justify-center text-blue-500">
                           <Database size={28} />
                        </div>
                     </div>

                     <div className="w-full dark:neu-panel neu-panel-light rounded-lg p-4 font-mono text-[10px] text-slate-400 space-y-2 border border-blue-500/10 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-[20px] rounded-full"></div>
                        <div className="flex justify-between text-blue-400 mb-2 border-b border-blue-500/20 pb-2">
                           <span>POST /api/v1/sync</span>
                           <span>200 OK</span>
                        </div>
                        <div>{`{`}</div>
                        <div className="pl-4"><span className="text-purple-400">"status"</span>: <span className="text-emerald-400">"success"</span>,</div>
                        <div className="pl-4"><span className="text-purple-400">"data_points"</span>: <span className="text-orange-400">1452</span>,</div>
                        <div className="pl-4"><span className="text-purple-400">"target"</span>: <span className="text-emerald-400">"crm_database"</span></div>
                        <div>{`}`}</div>
                     </div>
                  </div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-blue-500/5 flex items-center justify-center text-blue-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Plug size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('openclaw.capabilities.c4.title')}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('openclaw.capabilities.c4.desc')}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 5: Goal Orientation */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-rose-500/5 flex items-center justify-center text-rose-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Target size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('openclaw.capabilities.c5.title')}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('openclaw.capabilities.c5.desc')}
              </p>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col gap-4">
                  <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  
                  {/* Goal Prompt UI */}
                  <div className="bg-white/50 dark:bg-black/50 backdrop-blur-md rounded-xl border border-black/10 dark:border-white/10 p-5 shadow-lg relative z-10 mb-auto">
                     <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <MessageSquare size={14} /> Natural Language Goal
                     </div>
                     <div className="text-lg font-medium dark:text-white text-slate-800 leading-relaxed">
                        "Find 50 B2B SaaS companies in Europe, extract their CEO's contact info, and add them to my outreach sequence."
                     </div>
                  </div>

                  {/* Planning Steps UI */}
                  <div className="dark:neu-panel neu-panel-light rounded-xl p-5 border border-rose-500/20 relative z-10">
                     <div className="flex items-center justify-between mb-4 border-b dark:border-white/5 border-black/5 pb-3">
                        <div className="text-sm font-bold dark:text-white text-slate-900 flex items-center gap-2">
                           <Bot size={16} className="text-rose-500" /> Agent Planning
                        </div>
                        <div className="text-[10px] bg-rose-500/20 text-rose-500 px-2 py-1 rounded font-bold animate-pulse">
                           Executing
                        </div>
                     </div>
                     <div className="space-y-3">
                        {[
                           { step: "Search LinkedIn for SaaS companies", status: "Done", color: "text-emerald-500" },
                           { step: "Filter by location: Europe", status: "Done", color: "text-emerald-500" },
                           { step: "Identify CEO profiles", status: "Active", color: "text-rose-500" },
                           { step: "Extract contact info", status: "Pending", color: "text-slate-500" }
                        ].map((item, i) => (
                           <div key={i} className="flex justify-between items-center text-xs">
                              <span className="dark:text-white/80 text-slate-600 flex items-center gap-2">
                                 {i < 2 ? <CheckSquare size={12} className="text-emerald-500"/> : (i===2 ? <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse ml-1 mr-0.5"></div> : <div className="w-1.5 h-1.5 bg-slate-500 rounded-full ml-1 mr-0.5"></div>)}
                                 {item.step}
                              </span>
                              <span className={`font-mono ${item.color}`}>{item.status}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Feature 6: Memory */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                  
                  {/* Database/Memory Mockup */}
                  <div className="w-full max-w-sm flex flex-col gap-3 relative z-10">
                     <div className="absolute -left-10 -top-10 w-32 h-32 bg-amber-500/10 blur-[30px] rounded-full"></div>
                     
                     <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Database size={14} /> Contextual Memory
                     </div>

                     {[
                        { title: "Previous Interactions", desc: "User prefers concise summaries over detailed logs.", icon: <MessageSquare size={14}/> },
                        { title: "Stored Credentials", desc: "Authenticated for LinkedIn, GitHub, and Salesforce.", icon: <Plug size={14}/> },
                        { title: "Learned Workflows", desc: "Optimized lead extraction path saved. 24% faster.", icon: <Zap size={14}/> }
                     ].map((mem, i) => (
                        <div key={i} className="dark:bg-[#1a1a1c] bg-white rounded-lg p-4 border border-black/10 dark:border-white/10 shadow-sm flex items-start gap-4 transition-transform hover:-translate-y-1 hover:shadow-md hover:border-amber-500/30">
                           <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                              {mem.icon}
                           </div>
                           <div>
                              <div className="text-sm font-bold dark:text-white text-slate-900 mb-1">{mem.title}</div>
                              <div className="text-xs dark:text-white/60 text-slate-500">{mem.desc}</div>
                           </div>
                        </div>
                     ))}
                  </div>
                  
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-amber-500/5 flex items-center justify-center text-amber-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Database size={24} />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                {t('openclaw.capabilities.c6.title')}
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('openclaw.capabilities.c6.desc')}
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Terminal Mockup */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-20">
        <div className="mt-32 w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border dark:border-white/10 border-black/10 dark:bg-[#0a0a0c] bg-slate-900">
          <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/40">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
              <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
            </div>
            <div className="mx-auto text-xs font-mono text-white/50">openclaw-agent — bash</div>
          </div>
          <div className="p-6 font-mono text-sm md:text-base text-slate-300 space-y-3 overflow-x-auto">
            <div className="flex gap-4">
              <span className="text-emerald-400 shrink-0">$</span>
              <span className="text-slate-300">{t('openclaw.terminal.prompt1')}</span>
            </div>
            <div className="text-blue-400">{t('openclaw.terminal.loading')}</div>
            <div className="text-purple-400">{t('openclaw.terminal.memory')}</div>
            <div className="text-orange-400">{t('openclaw.terminal.whatsapp')}</div>
            <div className="flex gap-4">
              <span className="text-emerald-400 shrink-0">$</span>
              <span className="text-slate-300">{t('openclaw.terminal.prompt2')}</span>
            </div>
            <div className="text-slate-400">{t('openclaw.terminal.navigating')}</div>
            <div className="text-slate-400">{t('openclaw.terminal.extracting')}</div>
            <div className="text-slate-400">{t('openclaw.terminal.generating')}</div>
            <div className="text-emerald-400 font-bold">{t('openclaw.terminal.completed')}</div>
            <div className="flex gap-4 mt-4 animate-pulse">
              <span className="text-emerald-400 shrink-0">$</span>
              <span className="w-2.5 h-5 bg-slate-300 inline-block"></span>
            </div>
          </div>
        </div>
      </div>
      {/* Bring your own OpenClaw */}
      <div className="mt-16 mb-24 text-center relative z-20 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full dark:neu-black-chip neu-white-chip border dark:border-white/10 border-black/10">
          <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-sm dark:text-white/80 text-slate-700">
            {t('openclaw.byo.text')} <a href="https://docs.makinari.com/mcp-server" target="_blank" rel="noreferrer" className="text-orange-500 hover:text-orange-400 font-medium underline underline-offset-4">{t('openclaw.byo.link')}</a> {t('openclaw.byo.text2')}
          </span>
        </div>
      </div>
    </div>
  )
}
