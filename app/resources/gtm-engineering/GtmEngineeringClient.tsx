"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Command, Bot, NetworkTree, Zap, Settings, ArrowUpRight, Plus, Rocket, Workflow, DatabaseIcon, Terminal } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OpenClawCard } from "@/app/components/auth/sections/OpenClawCard"

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
  const getTransform = () => {
    if (direction === "up") return { y: 60, x: 0 };
    if (direction === "down") return { y: -60, x: 0 };
    if (direction === "left") return { x: 60, y: 0 };
    if (direction === "right") return { x: -60, y: 0 };
    return { x: 0, y: 0 };
  };

  const initial = { opacity: 0, filter: "blur(12px)", ...getTransform() };

  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, filter: "blur(0px)", x: 0, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -50px 0px" }}
      transition={{ 
        duration: 1, 
        delay: delay / 1000, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      className={className}
    >
      {children}
    </motion.div>
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

export function GtmEngineeringClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-indigo-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-indigo-500/30 bg-indigo-500/5 text-indigo-500">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse"></span>
              Built for Builders
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              The Ultimate Playground for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">GTM Engineers</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              Stop duct-taping ten different tools together. Build, deploy, and scale robust revenue engines on a unified architecture designed for programmable go-to-market.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex gap-4">
              <a href="https://docs.makinari.com/rest-api" target="_blank" rel="noreferrer" className="px-8 py-3 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                Read API Docs
              </a>
              <Link href="/auth" className="px-8 py-3 rounded-full dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 font-bold transition-colors border dark:border-white/10 border-black/10">
                Start Building Free
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
                    <Command size={12} /> invoke-agent.sh
                  </div>
                </div>
                
                <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-5 flex flex-col relative overflow-hidden transition-colors duration-500">
                  <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                  
                  <div className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 leading-relaxed font-mono relative z-10">
                    <p className="mb-2 text-indigo-500 dark:text-indigo-400">POST /v1/agents/research/invoke</p>
                    <p className="text-slate-500 dark:text-slate-400">{`{`}</p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"target_account"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-amber-600 dark:text-amber-400">{`"acme_corp"`}</span><span className="text-slate-500 dark:text-slate-400">,</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"intent_signals"`}<span className="text-slate-500 dark:text-slate-400">: [</span><span className="text-amber-600 dark:text-amber-400">{`"hiring_engineers"`}</span><span className="text-slate-500 dark:text-slate-400">,</span> <span className="text-amber-600 dark:text-amber-400">{`"recent_funding"`}</span><span className="text-slate-500 dark:text-slate-400">],</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"action_on_complete"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-amber-600 dark:text-amber-400">{`"draft_sequence"`}</span></p>
                    <p className="text-slate-500 dark:text-slate-400">{`}`}</p>
                    
                    <div className="my-4 h-px w-full bg-black/10 dark:bg-white/10"></div>
                    
                    <p className="mb-2 text-slate-500 dark:text-slate-400">// Response 200 OK</p>
                    <p className="text-slate-500 dark:text-slate-400">{`{`}</p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"status"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-emerald-600 dark:text-emerald-400">{`"processing"`}</span><span className="text-slate-500 dark:text-slate-400">,</span></p>
                    <p className="pl-4 text-blue-600 dark:text-blue-400">{`"job_id"`}<span className="text-slate-500 dark:text-slate-400">:</span> <span className="text-amber-600 dark:text-amber-400">{`"agt_9832nd198d"`}</span></p>
                    <p className="text-slate-500 dark:text-slate-400">{`}`}</p>
                  </div>
                  
                  {/* Floating Action Badge */}
                  <div className="absolute right-4 bottom-4 rounded-full dark:bg-indigo-500/20 bg-indigo-50 dark:border-indigo-500/30 border-indigo-200 border px-4 py-2 flex items-center gap-2 shadow-lg backdrop-blur-md animate-float-slow z-20">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider font-sans">Agent Deployed</span>
                  </div>
                </div>
              </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Programmable AI Agents
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                We didn't just bolt ChatGPT onto a CRM. Makinari gives you programmable AI agents with explicit skills. Trigger them via API, webhook, or status change to execute complex playbooks natively.
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'mcp', name: "Model Context Protocol", icon: <Terminal size={18} className="text-indigo-400" />, desc: "Deploy custom agents via MCP and securely expose your internal data to the Makinari engine." },
                  { id: 'context', name: "Native Context Passing", icon: <DatabaseIcon size={18} className="text-indigo-400" />, desc: "Context flows automatically from pipeline stages right into your custom prompts." },
                  { id: 'pipelines', name: "Autonomous Pipelines", icon: <NetworkTree size={18} className="text-indigo-400" />, desc: "Build hands-free scoring, enrichment, and outreach pipelines using webhooks." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-indigo-500/30 transition-colors bg-indigo-500/5">
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
                Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">engineer revenue</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                A unified architecture that eliminates integration debt, letting you focus on building highly converting growth engines.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 1: Unified Data Graph */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.1),transparent_50%)]"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-6">
                    <DatabaseIcon size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Unified Graph Model</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    GTM Engineers spend half their time fixing broken workflows and mapping data schemas. Makinari provides a unified data model across CRM, Outreach, and Content. No more syncing required.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiM2MzY2ZjEiIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

            {/* Bento 2: Fast Experiments */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.1),transparent_50%)]"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 mb-6">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Ship Experiments Faster</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed mb-4">
                    GTM Engineering is all about speed and experimentation. Testing a new playbook shouldn't require custom engineering sprints.
                  </p>
                  <ul className="space-y-2 text-sm dark:text-white/70 text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 mt-1">•</span>
                      Native A/B testing across all revenue channels
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-pink-500 mt-1">•</span>
                      Instant feedback loops from Sales to Marketing
                    </li>
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: Custom Headless APIs */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
                    <Terminal size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Headless Operations</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Build your own UI on top of our orchestration layer using standard REST APIs and WebSocket streams for real-time agent execution.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: Extensibility */}
            <Reveal delay={400} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_50%)]"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                    <Settings size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">The All-in-One GTM Platform</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Stop managing tools and start engineering revenue. Join the GTM Engineers leveraging our unified architecture, native AI agents, and all-inclusive toolset to build infinitely scalable growth engines.
                  </p>
                  <div className="mt-6 flex items-center gap-6">
                    <Link href="/auth" className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors">
                      Start Building Free <ArrowUpRight size={16} />
                    </Link>
                    <Link href="/product/pricing" className="text-sm font-medium dark:text-white/70 text-slate-600 hover:dark:text-white hover:text-slate-900 transition-colors">
                      View all-inclusive pricing
                    </Link>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#3b82f6_10px,#3b82f6_20px)] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
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
