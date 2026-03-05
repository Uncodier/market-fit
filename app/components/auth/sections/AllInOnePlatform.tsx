"use client"

import React from "react"
import { motion } from "framer-motion"
import { DatabaseIcon, Zap, NetworkTree, Mail, Users, Bot, Settings, Search, Megaphone, Check } from "@/app/components/ui/icons"

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
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translate(0)" : getTransform(),
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

export function AllInOnePlatform() {
  const tools = [
    { name: "B2B Data Provider", icon: <DatabaseIcon size={20} />, oldCost: "$12k/yr", colorClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20" },
    { name: "Sales Engagement", icon: <Mail size={20} />, oldCost: "$1.5k/yr/user", colorClass: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20" },
    { name: "Intent Signals", icon: <Zap size={20} />, oldCost: "$15k/yr", colorClass: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20" },
    { name: "CRM Platform", icon: <Users size={20} />, oldCost: "$1.8k/yr/user", colorClass: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20" },
    { name: "Lead Routing", icon: <NetworkTree size={20} />, oldCost: "$5k/yr", colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" },
    { name: "AI Assistants", icon: <Bot size={20} />, oldCost: "$600/yr/user", colorClass: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/10 border-fuchsia-200 dark:border-fuchsia-500/20" },
  ];

  return (
    <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#0a0a0c] bg-slate-50 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-indigo-500/5 blur-[120px] pointer-events-none rounded-full"></div>
      
      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
        <Reveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
              The true meaning of <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">All-in-One</span>
            </h2>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
              Stop paying the "integration tax". Makinari consolidates your entire GTM stack into a single, cohesive engine where data flows instantly without Zapier.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch relative">
          {/* Decorative connector line for desktop */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
            <div className="w-12 h-12 rounded-full font-inter dark:bg-black/80 bg-white/80 border dark:border-white/10 border-black/10 backdrop-blur-md flex items-center justify-center shadow-lg transform rotate-90 lg:rotate-0">
              <svg className="w-5 h-5 dark:text-white/50 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </div>

          {/* The Old Way */}
          <Reveal delay={100} direction="right" className="h-full">
            <div className="rounded-2xl dark:neu-base neu-base-light border dark:border-red-500/20 border-red-200/50 p-8 relative overflow-hidden group transition-all duration-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.05)] h-full flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
              <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-red-500/5 blur-[60px] rounded-full font-inter pointer-events-none group-hover:bg-red-500/10 transition-colors duration-500"></div>
              
              <div className="relative z-10 flex-1 flex flex-col">
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full font-inter font-bold bg-red-500 animate-pulse"></div>
                  The Fragmented Stack
                </h3>
                <p className="text-sm dark:text-white/60 text-slate-600 mb-8">Expensive, disconnected, and relies on brittle webhooks.</p>
                
                <div className="flex flex-col gap-3 relative p-6 rounded-xl dark:bg-black/40 bg-white/50 border dark:border-red-500/10 border-red-200/30 backdrop-blur-sm flex-1">
                  {/* Animated dashed line */}
                  <div className="absolute left-[48px] -translate-x-1/2 top-10 bottom-10 w-px border-l-2 border-dashed dark:border-red-500/30 border-red-400/40 z-0"></div>
                  
                  {tools.map((tool, i) => (
                    <div key={i} className="flex items-center gap-4 relative z-10 group/item hover:-translate-y-0.5 transition-transform">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all border ${tool.colorClass} group-hover/item:scale-105 group-hover/item:shadow-sm`}>
                        {tool.icon}
                      </div>
                      <div className="flex-1 dark:bg-white/[0.02] bg-white border dark:border-white/[0.05] border-black/5 rounded-lg py-3 px-4 flex justify-between items-center group-hover/item:border-red-500/20 transition-colors shadow-sm dark:shadow-none">
                        <span className="font-medium text-sm dark:text-white/80 text-slate-700">{tool.name}</span>
                        <span className="text-xs font-mono dark:text-red-400 text-red-600 line-through opacity-80 bg-red-500/10 px-2 py-0.5 rounded">{tool.oldCost}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

          {/* The Makinari Way */}
          <Reveal delay={200} direction="left" className="h-full">
            <div className="rounded-2xl dark:neu-base neu-base-light border dark:border-indigo-500/30 border-indigo-200/50 p-8 relative overflow-hidden group transition-all duration-500 hover:shadow-[0_0_40px_rgba(99,102,241,0.15)] h-full flex flex-col">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/10 blur-[60px] rounded-full font-inter pointer-events-none group-hover:bg-indigo-500/20 transition-colors duration-500"></div>
              
              <div className="relative z-10 flex-1 flex flex-col">
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full font-inter font-bold bg-indigo-500 animate-[pulse_1.5s_ease-in-out_infinite] shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                  The Makinari Engine
                </h3>
                <p className="text-sm dark:text-white/60 text-slate-600 mb-8">One unified graph. Native execution. Zero integration debt.</p>
                
                <div className="relative p-6 rounded-xl dark:bg-black/40 bg-white/50 border dark:border-indigo-500/20 border-indigo-200/50 backdrop-blur-sm flex-1 flex flex-col justify-between">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { title: "Native Sourcing", desc: "Built-in B2B data & enrichment", icon: <Search size={16} />, colorClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 group-hover/card:bg-blue-100 dark:group-hover/card:bg-blue-500/20 border border-blue-100 dark:border-blue-500/20" },
                      { title: "Omnichannel", desc: "Email, LinkedIn & Calls", icon: <Megaphone size={16} />, colorClass: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 group-hover/card:bg-orange-100 dark:group-hover/card:bg-orange-500/20 border border-orange-100 dark:border-orange-500/20" },
                      { title: "Smart CRM", desc: "Automated logging & scoring", icon: <DatabaseIcon size={16} />, colorClass: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 group-hover/card:bg-violet-100 dark:group-hover/card:bg-violet-500/20 border border-violet-100 dark:border-violet-500/20" },
                      { title: "Workflow Engine", desc: "Programmable pipelines", icon: <NetworkTree size={16} />, colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 group-hover/card:bg-emerald-100 dark:group-hover/card:bg-emerald-500/20 border border-emerald-100 dark:border-emerald-500/20" },
                      { title: "Intent Engine", desc: "Real-time buying signals", icon: <Zap size={16} />, colorClass: "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 group-hover/card:bg-yellow-100 dark:group-hover/card:bg-yellow-500/20 border border-yellow-100 dark:border-yellow-500/20" },
                      { title: "AI Copilot", desc: "Personalization at scale", icon: <Bot size={16} />, colorClass: "text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-500/10 group-hover/card:bg-fuchsia-100 dark:group-hover/card:bg-fuchsia-500/20 border border-fuchsia-100 dark:border-fuchsia-500/20" },
                    ].map((feature, i) => (
                      <div key={i} className="flex flex-col gap-2 p-4 rounded-lg dark:bg-white/[0.02] bg-white border dark:border-white/[0.05] border-black/5 hover:border-indigo-500/40 hover:-translate-y-1 transition-all group/card shadow-sm dark:shadow-none">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center group-hover/card:scale-110 transition-all ${feature.colorClass}`}>
                          {feature.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-sm dark:text-white text-slate-900 mb-0.5 transition-colors">{feature.title}</div>
                          <div className="text-[10px] md:text-xs dark:text-white/50 text-slate-500 leading-tight">{feature.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 flex items-center justify-center pt-6 border-t dark:border-white/10 border-black/10">
                    <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-inter dark:bg-emerald-500/10 bg-emerald-50 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-colors shadow-sm">
                      <div className="bg-emerald-500/20 p-1 rounded-full">
                        <Check size={14} />
                      </div>
                      All included in one subscription
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
