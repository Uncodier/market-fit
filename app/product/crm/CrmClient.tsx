"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Users, Bot, PieChart, NetworkTree, Zap, TrendingUp, BarChart, ArrowUpRight, Star, ShieldCheck, MessageSquare, LayoutGrid, Settings } from "@/app/components/ui/icons"
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

export function CrmClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-violet-500/30 bg-violet-500/5 text-violet-500">
              <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
              Customer Relationship Management
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              Operate from a <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">single source of truth</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              Your pipeline manages itself with automated activity logging and stage gating. Trust your forecast because it's based on real activity, not manual updates.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex gap-4">
              <Link href="/auth" className="px-8 py-3 rounded-full bg-violet-500 hover:bg-violet-600 text-white font-bold transition-colors shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                Start for free
              </Link>
              <Link href="/product/features" className="px-8 py-3 rounded-full dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 font-bold transition-colors border dark:border-white/10 border-black/10">
                Explore all features
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
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group flex flex-col font-inter">
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_12px,rgba(139,92,246,0.02)_12px,rgba(139,92,246,0.02)_24px)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="space-y-2">
                    <div className="text-xs dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                      <TrendingUp size={12} /> Pipeline Value
                    </div>
                    <div className="text-4xl font-bold dark:text-white text-slate-900 flex items-center gap-3">
                      $2.4M
                    </div>
                  </div>
                  
                  {/* Floating Chart Element */}
                  <div className="absolute right-[-1rem] top-[-1.5rem] w-[260px] rounded-xl dark:neu-panel neu-panel-light p-4 animate-float-slow transition-transform group-hover:scale-105 group-hover:-translate-y-2 z-30 shadow-2xl border dark:border-white/10 border-black/10 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-md hidden sm:block">
                    <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
                    <div className="absolute right-0 top-0 w-32 h-32 bg-violet-500/5 blur-[30px] rounded-full pointer-events-none"></div>
                    <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold dark:text-white/80 text-slate-500 uppercase tracking-wider min-w-0">
                        <BarChart size={12} className="text-violet-500 shrink-0" /> 
                        <span className="truncate">Projected Revenue</span>
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
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0 border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                      <Bot size={16} className="text-violet-400" />
                    </div>
                    <div>
                      <div className="text-xs text-violet-300 font-bold tracking-wider mb-2 uppercase flex items-center gap-2">
                        <Star size={12} /> Copilot Insight
                      </div>
                      <div className="dark:text-white/80 text-slate-500 text-sm leading-relaxed">
                        Acme Corp deal is stalling. Consider sending the ROI calculator to the CFO. I can draft this email for you.
                      </div>
                      <div className="mt-3 flex gap-2">
                        <div className="bg-violet-500 dark:text-white text-slate-900 text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer hover:bg-violet-600 transition-colors">
                          Draft Email
                        </div>
                        <div className="dark:bg-white/10 bg-black/10 dark:text-white/70 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer hover:dark:bg-white/20 bg-black/20 transition-colors">
                          Dismiss
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pipeline stages */}
                  <div className="w-full flex justify-between mt-6 px-2 relative z-10 gap-2">
                    {[
                      { name: "Lead", color: "bg-blue-400" },
                      { name: "Meeting", color: "bg-orange-400" },
                      { name: "Proposal", color: "bg-violet-400" },
                      { name: "Negotiation", color: "bg-pink-400" },
                      { name: "Closed", color: "bg-emerald-400" }
                    ].map((stage, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 flex-1">
                        <div className="text-[9px] dark:text-white/50 text-slate-500 uppercase font-semibold tracking-wider">{stage.name}</div>
                        <div className={`w-full h-1.5 rounded-full ${i <= 2 ? stage.color : 'dark:bg-white/10 bg-black/10'} ${i === 2 ? 'shadow-[0_0_10px_rgba(139,92,246,0.5)]' : ''}`}></div>
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
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                An intelligent CRM that works for you
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Stop updating fields manually. Our CRM automatically enriches contacts, logs activities, and prompts you with the next best action to close deals faster.
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'ai-copilot', name: "Ask AI Copilot", icon: <Bot size={18} className="text-violet-400" />, desc: "Get real-time deal insights and draft communications instantly." },
                  { id: 'reporting', name: "Reporting & Forecasting", icon: <PieChart size={18} className="text-violet-400" />, desc: "Predict revenue accurately based on actual signals, not guesses." },
                  { id: 'workflows', name: "Automated Workflows", icon: <NetworkTree size={18} className="text-violet-400" />, desc: "Trigger tasks, emails, and alerts when deal stages change." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-violet-500/30 transition-colors bg-violet-500/5">
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

      {/* Bento Grid Layout for CRM features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">manage relationships</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                A unified view of your entire customer journey, augmented by AI that does the heavy lifting.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 1: Auto Logging */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.1),transparent_50%)]"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 mb-6">
                    <Zap size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Auto-Logging Activity</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Say goodbye to manual data entry. Makinari automatically captures emails, calls, and meetings, associating them with the right contacts and deals.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiM4YjVjZjYiIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

            {/* Bento 2: Smart Enrichment */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(217,70,239,0.1),transparent_50%)]"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 mb-6">
                    <Users size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Smart Enrichment</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    New contacts are automatically enriched with social data, company details, and intent signals the moment they enter your CRM.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: AI Forecasting */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
                    <PieChart size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">AI Forecasting</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Predictive analytics that learn from your historical wins to give you an accurate revenue forecast, completely hands-off.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: Custom Workflows */}
            <Reveal delay={400} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_50%)]"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                    <NetworkTree size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Custom Workflows</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Build complex logic visually or let the AI set it up for you. Trigger SLA alerts, automated follow-ups, and territory routing based on any field change.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#3b82f6_10px,#3b82f6_20px)] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* Enterprise-Grade Core Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-slate-50 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-fuchsia-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-xs font-bold mb-6 border dark:border-white/10 border-black/10 text-slate-500 dark:text-white/70">
                Enterprise-Grade Architecture
              </div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                A robust foundation for <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-violet-400">complex operations</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">
                Beyond AI, Makinari delivers all the core CRM features that growing enterprise teams demand for their daily operations.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "360° Customer View",
                desc: "Get a complete timeline of every interaction, email, meeting, and transaction in one unified profile.",
                icon: <Users size={24} className="text-fuchsia-400" />,
                delay: 100
              },
              {
                title: "Visual Pipeline Management",
                desc: "Drag-and-drop Kanban boards with custom stages, win probabilities, and automated state transitions.",
                icon: <LayoutGrid size={24} className="text-violet-400" />,
                delay: 150
              },
              {
                title: "Omnichannel Inbox",
                desc: "Manage email, WhatsApp, and social channels from a single threaded view attached to the deal record.",
                icon: <MessageSquare size={24} className="text-blue-400" />,
                delay: 200
              },
              {
                title: "Advanced Dashboards",
                desc: "Customizable reports for sales funnels, team performance, and ROI tracking with real-time data sync.",
                icon: <BarChart size={24} className="text-emerald-400" />,
                delay: 250
              },
              {
                title: "Roles & Permissions",
                desc: "Granular access control, field-level security, and audit logs for enterprise compliance.",
                icon: <ShieldCheck size={24} className="text-orange-400" />,
                delay: 300
              },
              {
                title: "Customization & API",
                desc: "Create custom objects, fields, and modules. Connect your entire tech stack via our robust API and webhooks.",
                icon: <Settings size={24} className="text-slate-400" />,
                delay: 350
              }
            ].map((feature, i) => (
              <Reveal key={i} delay={feature.delay} className="h-full w-full">
                <div className="h-full p-8 rounded-xl dark:neu-panel neu-panel-light border dark:border-white/5 border-black/5 hover:border-violet-500/30 transition-all duration-300 group">
                  <div className="w-12 h-12 rounded-lg dark:bg-white/5 bg-black/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{feature.title}</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed text-sm">
                    {feature.desc}
                  </p>
                </div>
              </Reveal>
            ))}
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
