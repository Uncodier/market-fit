"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Command, Bot, NetworkTree, Zap, Settings, ArrowUpRight, DatabaseIcon, Terminal, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OpenClawCard } from "@/app/components/auth/sections/OpenClawCard"
import { AllInOnePlatform } from "@/app/components/auth/sections/AllInOnePlatform"


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

export function AgentsClient() {
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
              The Ultimate GTM Brain
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              Equip Your Agents with a <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">Unified Memory</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              Makinari serves as the <strong className="font-semibold dark:text-white text-slate-900">Business Neural Center</strong> and <strong className="font-semibold dark:text-white text-slate-900">Main Source of Truth</strong> for autonomous AI agents. A complete, easy-to-use interface built specifically for agents to execute flawlessly, supported by open-source flexibility and enterprise SLAs.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <a href="https://docs.makinari.com/rest-api" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 group">
                API Reference
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="/docs/AGENT_ADVANTAGES.md" target="_blank" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
                Read Advantages Docs
              </a>
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
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group flex flex-col font-mono">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_12px,rgba(99,102,241,0.02)_12px,rgba(99,102,241,0.02)_24px)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI - IDE Interface */}
                <div className="flex justify-between items-start mb-4 relative z-10 border-b dark:border-white/10 border-black/10 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="text-xs dark:text-white/40 text-slate-500 flex items-center gap-2">
                    <Command size={12} /> mcp-agent-connect.ts
                  </div>
                </div>
                
                <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-5 flex flex-col relative overflow-hidden transition-colors duration-500">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                  
                  <div className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 leading-relaxed font-mono relative z-10">
                    <p className="mb-2 text-indigo-500 dark:text-indigo-400">await makinari.mcp.connect({`{`}</p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">agentId<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-amber-600 dark:text-amber-400">'agt_autonomous_sdr'</span><span className="text-slate-500 dark:text-slate-400">,</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">scopes<span className="text-slate-500 dark:text-slate-400">: [</span><span className="text-amber-600 dark:text-amber-400">'crm:read'</span><span className="text-slate-500 dark:text-slate-400">,</span> <span className="text-amber-600 dark:text-amber-400">'outreach:write'</span><span className="text-slate-500 dark:text-slate-400">],</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">contextWindow<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-amber-600 dark:text-amber-400">'full_history'</span></p>
                    <p className="text-slate-500 dark:text-slate-400">{`}`})</p>
                    
                    <div className="my-4 h-px w-full bg-black/10 dark:bg-white/10"></div>
                    
                    <p className="mb-2 text-slate-500 dark:text-slate-400">// System Response</p>
                    <p className="text-slate-500 dark:text-slate-400">{`{`}</p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"status"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-emerald-600 dark:text-emerald-400">{`"connected"`}</span><span className="text-slate-500 dark:text-slate-400">,</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"graph_access"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-emerald-600 dark:text-emerald-400">{`true`}</span><span className="text-slate-500 dark:text-slate-400">,</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"active_webhooks"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-amber-600 dark:text-amber-400">4</span></p>
                    <p className="text-slate-500 dark:text-slate-400">{`}`}</p>
                  </div>
                  
                  {/* Floating Action Badge */}
                  <div className="absolute right-4 bottom-4 rounded-full dark:bg-indigo-500/20 bg-indigo-50 dark:border-indigo-500/30 border-indigo-200 border px-4 py-2 flex items-center gap-2 shadow-lg backdrop-blur-md animate-float-slow z-20">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider ">MCP Live</span>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Built for Agentic Workflows
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Agents need more than just endpoints; they need a persistent brain. Makinari offers structured data, historical context, and native webhook triggers to enable true autonomy.
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'mcp', name: "Native MCP Support", icon: <Terminal size={18} className="text-indigo-400" />, desc: "Connect agents instantly via the Model Context Protocol to securely expose your internal business logic." },
                  { id: 'context', name: "Unified Data Graph", icon: <DatabaseIcon size={18} className="text-indigo-400" />, desc: "Agents can read a prospect's entire lifecycle without complex querying across disconnected apps." },
                  { id: 'pipelines', name: "Event-Driven Webhooks", icon: <Zap size={18} className="text-indigo-400" />, desc: "Agents don't need to poll. Trigger their execution the moment a deal stage changes or an email arrives." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-indigo-500/5 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-indigo-500/30 transition-colors">
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

      {/* Bento Grid Layout for Engineering features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                Why Agents Thrive on <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Makinari</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                Give your AI operators the infrastructure they need to scale processes safely, efficiently, and with full historical context.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 1: Unified Data Graph */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(99,102,241,0.1)_8px,rgba(99,102,241,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(99,102,241,0.05)_8px,rgba(99,102,241,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-indigo-500 mb-6 bg-indigo-500/5">
                    <DatabaseIcon size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">The Main Source of Truth</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Makinari acts as the <strong className="font-semibold dark:text-white text-slate-900">Business Neural Center</strong> for your operations. A language model is only as good as its context. By using our Unified Graph, your agent instantly understands the entire relationship history with any contact, ensuring deeply personalized and accurate actions.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiM2MzY2ZjEiIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

            {/* Bento 2: Fast Experiments */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(236,72,153,0.1)_10px,rgba(236,72,153,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-pink-500 mb-6 bg-pink-500/5">
                    <Settings size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Enterprise SLAs & Governance</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed mb-4">
                    Safely deploy agents with built-in limits, human-in-the-loop approval workflows, and Enterprise-grade SLAs to ensure your AI workforce is always online.
                  </p>
                  <ul className="space-y-2 text-sm dark:text-white/70 text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 mt-1">•</span>
                      Guaranteed uptime & SLA
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 mt-1">•</span>
                      Budget and rate limiters
                    </li>
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: Custom Headless APIs */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.03] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-emerald-500 mb-6 bg-emerald-500/5">
                    <NetworkTree size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Easy Open-Source Integration</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Seamlessly connect your existing stack. Built with open-source principles and frictionless integration via REST APIs, webhooks, and MCP, eliminating brittle vendor lock-in.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: Extensibility */}
            <Reveal delay={400} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(59,130,246,0.1)_8px,rgba(59,130,246,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 flex items-center justify-center text-blue-500 mb-6 bg-blue-500/5">
                    <Bot size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">The Ultimate AI UI & Runtime</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Unlike human-centric tools, Makinari is designed specifically as the perfect UI and runtime for AI. Elevate your LLM wrappers into powerful autonomous revenue operators that you converse with to execute complex tasks flawlessly.
                  </p>
                  <div className="mt-6 flex items-center gap-6">
                    <Link href="/auth" className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                      Start with Makinari <ArrowUpRight size={16} />
                    </Link>
                    <a href="/docs/AGENT_ADVANTAGES.md" target="_blank" className="text-sm font-medium dark:text-white/70 text-slate-600 hover:dark:text-white hover:text-slate-900 transition-colors">
                      Read the full advantages document
                    </a>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#3b82f6_10px,#3b82f6_20px)] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* NEW SECTION: All-in-One Clarification */}
      <AllInOnePlatform />

      {/* Agents Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <OpenClawCard />
      </section>

      <SiteFooter />
    </div>
  )
}
