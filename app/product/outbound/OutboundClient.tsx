"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { NetworkTree, Phone, CheckSquare, Mail, Bot, ArrowUpRight } from "@/app/components/ui/icons"
import { SiLinkedin } from "react-icons/si"
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

export function OutboundClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-blue-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-blue-500/30 bg-blue-500/5 text-blue-500">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
              Outbound Sales
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              Build pipeline <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">without the patchwork</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">
              Dialer, personalized sequencing, and AI inbox warming built directly into your CRM. Manage omni-channel outreach without ever switching tabs.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex gap-4">
              <Link href="/auth" className="px-8 py-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]">
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
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_10px,rgba(59,130,246,0.02)_10px,rgba(59,130,246,0.02)_20px)] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex gap-4 h-full relative z-10">
                  <div className="w-1/3 border-r dark:border-white/5 border-black/5 pr-4 flex flex-col gap-3">
                    <div className="text-xs dark:text-white/50 text-slate-500 mb-4 uppercase font-bold tracking-wider flex items-center">
                      <NetworkTree size={12} className="mr-2" /> Sequences
                    </div>
                    {[1,2,3,4].map((i) => (
                      <div key={i} className={`p-4 rounded-md border transition-all duration-300 cursor-pointer ${i===1 ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] translate-x-1' : 'dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5 hover:dark:bg-white/10 bg-black/10'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className={`w-16 h-2 rounded-full ${i===1 ? 'bg-blue-400 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]' : 'dark:neu-skeleton neu-skeleton-light opacity-70'}`}></div>
                          {i===1 && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>}
                        </div>
                        <div className="w-full h-1.5 dark:neu-skeleton neu-skeleton-light opacity-50 rounded-full"></div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="w-2/3 flex flex-col gap-4">
                    <div className="flex gap-3 items-center border-b dark:border-white/5 border-black/5 pb-4">
                      <div className="w-10 h-10 rounded-full dark:neu-panel neu-panel-light flex items-center justify-center text-blue-400">
                        <Bot size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="dark:text-white text-slate-900 text-sm font-semibold">AI Assistant</div>
                        <div className="text-blue-400 text-xs">Drafting response...</div>
                      </div>
                    </div>
                    
                    <div className="flex-1 dark:neu-panel neu-panel-light rounded-lg p-5 flex flex-col gap-4 relative overflow-hidden transition-colors duration-500">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full"></div>
                      
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full dark:neu-skeleton neu-skeleton-light flex-shrink-0"></div>
                        <div className="dark:bg-white/5 bg-black/5 rounded-lg rounded-tl-sm p-3 w-[80%] border dark:border-white/5 border-black/5 shadow-inner">
                          <div className="w-full h-2 dark:neu-skeleton neu-skeleton-light rounded-full mb-2"></div>
                          <div className="w-5/6 h-2 dark:neu-skeleton neu-skeleton-light rounded-full"></div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 flex-row-reverse mt-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
                          <Bot size={14} />
                        </div>
                        <div className="bg-blue-500/10 rounded-lg rounded-tr-sm p-4 w-[85%] border border-blue-500/20 relative">
                          <div className="w-full h-2 bg-blue-400/50 rounded-full mb-3"></div>
                          <div className="w-5/6 h-2 bg-blue-400/50 rounded-full mb-3"></div>
                          <div className="w-4/6 h-2 bg-blue-400/50 rounded-full"></div>
                          <div className="absolute -left-2 top-1/2 w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                        </div>
                      </div>
                    </div>
                    <div className="w-32 h-10 dark:neu-button neu-button-light rounded-md self-end flex items-center justify-center dark:text-white text-slate-900 text-xs font-bold cursor-pointer">
                      Send Sequence
                    </div>
                  </div>
                </div>
                
                {/* Floating element */}
                <div className="absolute -left-8 top-1/3 w-48 rounded-md dark:neu-panel neu-panel-light p-4 animate-float-medium transition-transform group-hover:scale-105 z-30 shadow-xl border border-blue-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                  <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 flex-shrink-0 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                      <Mail size={16} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-xs font-bold">Email Opened</div>
                      <div className="dark:text-white/50 text-slate-500 text-[10px]">Just now by John Doe</div>
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
                Scale conversations logically
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Reach prospects with multi-touch, multi-channel sequences. AI ensures high deliverability through automated inbox warming and responsive messaging.
              </p>
              <ul className="space-y-4">
                {[
                  { id: 'sequencing', name: "Omni-channel Sequencing", icon: <NetworkTree size={18} className="text-blue-400" />, desc: "Automate email, LinkedIn, and calls with smart routing." },
                  { id: 'dialer', name: "Integrated Dialer", icon: <Phone size={18} className="text-blue-400" />, desc: "Call instantly from your CRM, auto-record and transcribe." },
                  { id: 'inbox-warming', name: "Inbox Protection", icon: <CheckSquare size={18} className="text-blue-400" />, desc: "Ensure your emails land in the primary inbox, always." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border dark:border-white/5 border-black/5 group-hover:border-blue-500/30 transition-colors bg-blue-500/5">
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

      {/* Waterfall Enrichment & B2B Data Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="right">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6 border border-orange-500/30 bg-orange-500/5 text-orange-500">
                Data & Enrichment
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Waterfall enrichment with 50+ data providers
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Stop relying on a single data source. We waterfall through the top data providers (Apollo, Clearbit, Dropcontact, etc.) to maximize your coverage. If Provider A doesn't have the verified email or phone number, we automatically check the rest.
              </p>
              <ul className="space-y-4">
                {[
                  { name: "250M+ B2B Contacts", desc: "Access our built-in database with verified work and personal emails." },
                  { name: "Intent Data & Signals", desc: "Target accounts showing buying intent, recent funding, or tech stack changes." },
                  { name: "Live Web Scraping", desc: "Extract real-time data from company websites and LinkedIn profiles." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-2 mr-3 flex-shrink-0"></div>
                    <div>
                      <span className="dark:text-white text-slate-900 font-semibold">{item.name}: </span>
                      {item.desc}
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="left">
              <MockupScrollWrapper direction="left">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                  
                  {/* Waterfall UI Mockup */}
                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="text-sm dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-2 text-center">Enrichment Waterfall</div>
                    
                    {[
                      { provider: "Provider A", found: false, time: "0.2s" },
                      { provider: "Provider B", found: false, time: "0.4s" },
                      { provider: "Provider C", found: true, time: "0.8s" }
                    ].map((step, i) => (
                      <div key={i} className={`p-4 rounded-lg border flex items-center justify-between transition-all duration-300 ${step.found ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] scale-105 z-10' : 'dark:bg-white/5 bg-black/5 dark:border-white/5 border-black/5 opacity-70'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step.found ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'dark:bg-white/10 bg-black/10 dark:text-white/40 text-slate-500 dark:border-white/10 border-black/10'}`}>
                            {step.found ? <CheckSquare size={14} /> : <span className="text-xs">{i+1}</span>}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${step.found ? 'text-emerald-500' : 'dark:text-white/70 text-slate-600'}`}>{step.provider}</div>
                            <div className="text-[10px] dark:text-white/40 text-slate-500">Checking email & phone...</div>
                          </div>
                        </div>
                        <div className="text-right">
                          {step.found ? (
                            <div className="text-xs font-bold text-emerald-500">Data Found</div>
                          ) : (
                            <div className="text-xs font-bold dark:text-white/40 text-slate-500">Not Found</div>
                          )}
                          <div className="text-[10px] dark:text-white/30 text-slate-400">{step.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
        </div>
      </section>

      {/* AI Personalization Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col-reverse lg:flex-row items-center gap-16">
          <div className="w-full lg:w-1/2 perspective-[1200px]">
            <Reveal delay={200} direction="right">
              <MockupScrollWrapper direction="right">
                <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen neu-mockup-screen-light p-6 group font-inter flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                  
                  {/* AI UI Mockup */}
                  <div className="flex items-center gap-3 mb-6 border-b dark:border-white/5 border-black/5 pb-4 relative z-10">
                    <div className="w-10 h-10 rounded-full dark:neu-panel neu-panel-light flex items-center justify-center text-fuchsia-400">
                      <Bot size={20} />
                    </div>
                    <div>
                      <div className="dark:text-white text-slate-900 text-sm font-semibold">AI Researcher Agent</div>
                      <div className="text-fuchsia-400 text-xs animate-pulse">Analyzing prospect...</div>
                    </div>
                  </div>

                  <div className="space-y-4 relative z-10 flex-1">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 flex-shrink-0 mt-1">
                        <CheckSquare size={10} />
                      </div>
                      <div className="text-sm dark:text-white/70 text-slate-600">
                        Scraped <span className="font-semibold text-fuchsia-400">acmecorp.com/about</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 flex-shrink-0 mt-1">
                        <CheckSquare size={10} />
                      </div>
                      <div className="text-sm dark:text-white/70 text-slate-600">
                        Analyzed recent LinkedIn post about <span className="font-semibold text-fuchsia-400">Q3 Expansion</span>
                      </div>
                    </div>
                    
                    <div className="mt-6 dark:neu-panel neu-panel-light p-4 rounded-lg border border-fuchsia-500/20 relative">
                      <div className="absolute -top-3 left-4 bg-fuchsia-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Generated Opener</div>
                      <p className="text-sm dark:text-white text-slate-900 leading-relaxed mt-2 italic">
                        "Hey Sarah, loved your recent post about Acme's expansion into EMEA. Since you're scaling the sales team there, I thought..."
                      </p>
                    </div>
                  </div>
                </div>
              </MockupScrollWrapper>
            </Reveal>
          </div>
          <div className="w-full lg:w-1/2">
            <Reveal delay={0} direction="left">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6 border border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-400">
                Hyper-Personalization
              </div>
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                AI research that writes emails that get replies
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                Say goodbye to generic "Hope you're doing well" emails. Our AI agents visit your prospect's website, read their company news, and analyze their LinkedIn activity to generate highly relevant, human-like openers at scale.
              </p>
              <ul className="space-y-4">
                {[
                  { name: "Website Scraping", desc: "Extract value props, case studies, and company mission." },
                  { name: "Social Media Analysis", desc: "Reference recent posts, job changes, or company milestones." },
                  { name: "Custom Prompts", desc: "Build your own AI prompt to decide exactly how the AI should write the email." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-2 h-2 rounded-full bg-fuchsia-500 mt-2 mr-3 flex-shrink-0"></div>
                    <div>
                      <span className="dark:text-white text-slate-900 font-semibold">{item.name}: </span>
                      {item.desc}
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Bento Grid Layout for Outbound features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                Complete <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Outbound Engine</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                Launch, scale, and optimize your cold outreach without worrying about technical setup or deliverability.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 0: Prospecting Process */}
            <Reveal delay={50} className="md:col-span-3">
              <div className="w-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col md:flex-row items-center gap-12 transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08),transparent_70%)]"></div>
                
                <div className="w-full md:w-1/3 relative z-10 flex flex-col justify-center">
                  <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6 border border-blue-500/30 bg-blue-500/5 text-blue-500 w-max">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                    Multi-Channel
                  </div>
                  <h3 className="text-3xl font-bold dark:text-white text-slate-900 mb-4">The ultimate outreach process</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Build smart workflows that engage your prospects exactly where they are. Automatically sequence touchpoints across email, LinkedIn, and calls based on behavior.
                  </p>
                </div>

                <div className="w-full md:w-2/3 relative z-10 py-6">
                  {/* Flow Diagram */}
                  <div className="flex flex-col md:flex-row items-center justify-between w-full relative h-full">
                    {/* Connecting Line (Desktop) */}
                    <div className="absolute top-8 left-16 right-16 h-1 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-violet-500/20 hidden md:block rounded-full"></div>
                    {/* Connecting Line (Mobile) */}
                    <div className="absolute left-8 top-16 bottom-16 w-1 bg-gradient-to-b from-blue-500/20 via-cyan-500/20 to-violet-500/20 block md:hidden rounded-full"></div>

                    {/* Step 1: Email */}
                    <div className="relative z-10 flex flex-row md:flex-col items-center md:items-center gap-6 md:gap-4 mb-8 md:mb-0 group/step flex-1 w-full md:w-auto">
                      <div className="w-16 h-16 rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg group-hover/step:-translate-y-2 group-hover/step:scale-110 transition-all duration-300 group-hover/step:border-blue-500/50 group-hover/step:shadow-[0_10px_30px_-10px_rgba(59,130,246,0.5)] z-10 shrink-0">
                        <Mail size={26} className="text-blue-500" />
                      </div>
                      <div className="text-left md:text-center bg-white/50 dark:bg-black/50 backdrop-blur-sm px-4 py-2 md:px-3 md:py-1.5 rounded-lg border dark:border-white/5 border-black/5 flex-1 md:flex-none">
                        <div className="text-sm font-bold dark:text-white text-slate-900">Email Drop</div>
                        <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase tracking-wider mt-0.5">Day 1</div>
                      </div>
                    </div>

                    {/* Step 2: LinkedIn */}
                    <div className="relative z-10 flex flex-row md:flex-col items-center md:items-center gap-6 md:gap-4 mb-8 md:mb-0 group/step flex-1 w-full md:w-auto">
                      <div className="w-16 h-16 rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg group-hover/step:-translate-y-2 group-hover/step:scale-110 transition-all duration-300 group-hover/step:border-[#0A66C2]/50 group-hover/step:shadow-[0_10px_30px_-10px_rgba(10,102,194,0.5)] z-10 shrink-0">
                        <SiLinkedin size={26} className="text-[#0A66C2]" />
                      </div>
                      <div className="text-left md:text-center bg-white/50 dark:bg-black/50 backdrop-blur-sm px-4 py-2 md:px-3 md:py-1.5 rounded-lg border dark:border-white/5 border-black/5 flex-1 md:flex-none">
                        <div className="text-sm font-bold dark:text-white text-slate-900">Social Touch</div>
                        <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase tracking-wider mt-0.5">Day 3</div>
                      </div>
                    </div>

                    {/* Step 3: Call */}
                    <div className="relative z-10 flex flex-row md:flex-col items-center md:items-center gap-6 md:gap-4 mb-8 md:mb-0 group/step flex-1 w-full md:w-auto">
                      <div className="w-16 h-16 rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg group-hover/step:-translate-y-2 group-hover/step:scale-110 transition-all duration-300 group-hover/step:border-violet-500/50 group-hover/step:shadow-[0_10px_30px_-10px_rgba(139,92,246,0.5)] z-10 shrink-0">
                        <Phone size={26} className="text-violet-500" />
                      </div>
                      <div className="text-left md:text-center bg-white/50 dark:bg-black/50 backdrop-blur-sm px-4 py-2 md:px-3 md:py-1.5 rounded-lg border dark:border-white/5 border-black/5 flex-1 md:flex-none">
                        <div className="text-sm font-bold dark:text-white text-slate-900">Cold Call</div>
                        <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase tracking-wider mt-0.5">Day 5</div>
                      </div>
                    </div>

                    {/* Step 4: Meeting */}
                    <div className="relative z-10 flex flex-row md:flex-col items-center md:items-center gap-6 md:gap-4 group/step flex-1 w-full md:w-auto">
                      <div className="w-16 h-16 rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg group-hover/step:-translate-y-2 group-hover/step:scale-110 transition-all duration-300 group-hover/step:border-emerald-500/50 group-hover/step:shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] relative overflow-hidden z-10 shrink-0">
                        <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover/step:opacity-100 transition-opacity"></div>
                        <Bot size={26} className="text-emerald-500 relative z-10" />
                      </div>
                      <div className="text-left md:text-center bg-white/50 dark:bg-black/50 backdrop-blur-sm px-4 py-2 md:px-3 md:py-1.5 rounded-lg border dark:border-white/5 border-black/5 flex-1 md:flex-none">
                        <div className="text-sm font-bold dark:text-white text-slate-900">AI Hand-off</div>
                        <div className="text-[10px] dark:text-emerald-500 text-emerald-600 uppercase tracking-wider font-bold mt-0.5">Conversion</div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </Reveal>

            {/* Bento 1: Dynamic Sequences */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)]"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
                    <NetworkTree size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Dynamic Omni-Sequences</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Build complex multi-channel flows. If they don't open the email, send a LinkedIn request. If they open but don't click, queue a cold call. Completely automated.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMzYjgyZjYiIGZpbGwtb3BhY2l0eT0iMC40Ii8+PC9zdmc+')] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
              </div>
            </Reveal>

            {/* Bento 2: Channel Management */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.1),transparent_50%)]"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-500 mb-6">
                    <Bot size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Unlimited Inboxes</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Connect infinite email accounts to scale your volume while staying under sending limits. Manage every reply from a single unified Unibox.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: Native Dialer */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(139,92,246,0.1),transparent_50%)]"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 mb-6">
                    <Phone size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Native Dialer</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Call prospects directly from the browser. AI automatically records, transcribes, and extracts action items into the CRM.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Bento 4: Deliverability & Inbox Warming */}
            <Reveal delay={400} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_50%)]"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
                    <CheckSquare size={24} />
                  </div>
                  <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3">Unlimited Warmup & Spam Checker</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed">
                    Automated domain warming running silently in the background keeps your reputation pristine. Integrated spam checks ensure your emails always land in the primary inbox, maintaining a 99% deliverability rate without manual intervention.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 pointer-events-none bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#10b981_10px,#10b981_20px)] [mask-image:linear-gradient(to_left,black,transparent)]"></div>
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
