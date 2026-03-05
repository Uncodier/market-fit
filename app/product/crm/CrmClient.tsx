"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Users, Bot, PieChart, NetworkTree, Zap, TrendingUp, BarChart, ArrowUpRight, Star, ShieldCheck, MessageSquare, LayoutGrid, Settings, Mail, Phone, Check, Globe, ArrowRight } from "@/app/components/ui/icons"
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

const CrmBentoFeatures = () => {
  const { t } = useLocalization();
  const containerRef = useRef<HTMLDivElement>(null);

  const bentoFeatures = [
    {
      title: t('crm.bento.taskAutomation.title') || "Task Automation",
      description: t('crm.bento.taskAutomation.description') || "Automate repetitive tasks like data entry, follow-ups, and email logging so your team can focus on selling.",
      icon: <Zap size={24} className="text-fuchsia-500" />,
      color: "fuchsia",
      mockup: (
        <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(217,70,239,0.02)_20px,rgba(217,70,239,0.02)_40px)]"></div>
          {/* Vertical Scanner */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(217,70,239,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>
          </div>
          <div className="p-6 relative z-20 h-full flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold dark:text-white/80 text-slate-700">{t('crm.bento.taskAutomation.activeWorkflows') || "Active Workflows"}</span>
              <div className="px-2 py-1 rounded bg-fuchsia-500/10 text-fuchsia-500 text-[10px] font-mono border border-fuchsia-500/20 shadow-[0_0_10px_rgba(217,70,239,0.1)]">{t('crm.bento.taskAutomation.running') || "3 Running"}</div>
            </div>
            
            {/* Workflow Items */}
            {[
              { name: t('crm.bento.taskAutomation.leadQualification') || "Lead Qualification", trigger: t('crm.bento.taskAutomation.formSubmit') || "Form Submit", action: t('crm.bento.taskAutomation.assignToRep') || "Assign to Rep", status: "Active", delay: "0s" },
              { name: t('crm.bento.taskAutomation.followUpSequence') || "Follow-up Sequence", trigger: t('crm.bento.taskAutomation.noReply') || "No Reply (2d)", action: t('crm.bento.taskAutomation.sendEmail2') || "Send Email 2", status: "Active", delay: "0.5s" },
              { name: t('crm.bento.taskAutomation.dealStageUpdate') || "Deal Stage Update", trigger: t('crm.bento.taskAutomation.meetingBooked') || "Meeting Booked", action: t('crm.bento.taskAutomation.moveToDemo') || "Move to Demo", status: "Active", delay: "1s" }
            ].map((workflow, idx) => (
              <div key={idx} className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl p-4 flex flex-col gap-3 group/workflow hover:border-fuchsia-500/30 transition-colors backdrop-blur-sm" style={{ animationDelay: workflow.delay }}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-fuchsia-500/20 flex items-center justify-center border border-fuchsia-500/30">
                      <Zap size={12} className="text-fuchsia-500" />
                    </div>
                    <span className="text-sm font-medium dark:text-white text-slate-900">{workflow.name}</span>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                </div>
                <div className="flex items-center gap-2 text-xs dark:text-white/50 text-slate-500 font-mono">
                  <span className="px-2 py-0.5 rounded dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10">{workflow.trigger}</span>
                  <ArrowUpRight size={10} className="text-fuchsia-500" />
                  <span className="px-2 py-0.5 rounded bg-fuchsia-500/10 text-fuchsia-500 border border-fuchsia-500/20">{workflow.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      title: t('crm.bento.smartEnrichment.title') || "Smart Enrichment",
      description: t('crm.bento.smartEnrichment.description') || "New contacts are automatically enriched with social data, company details, and intent signals the moment they enter your CRM.",
      icon: <Users size={24} className="text-blue-500" />,
      color: "blue",
      mockup: (
         <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_20px,rgba(59,130,246,0.02)_20px,rgba(59,130,246,0.02)_40px)]"></div>
            {/* Horizontal Scanner */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>
            </div>
            
            <div className="p-6 relative z-20 h-full flex flex-col gap-4">
              <div className="flex items-center gap-4 dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 p-4 rounded-xl backdrop-blur-sm">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 flex items-center justify-center relative shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:scale-105 transition-transform">
                   <Users size={20} className="text-blue-500" />
                   <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#09090b] flex items-center justify-center animate-pulse">
                     <Check size={8} className="text-[#09090b]"/>
                   </div>
                </div>
                <div>
                  <div className="text-sm font-semibold dark:text-white text-slate-900 flex items-center gap-2">Sarah Jenkins <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[8px] uppercase tracking-wider border border-blue-500/20 font-bold shadow-[0_0_8px_rgba(59,130,246,0.15)]">{t('crm.bento.smartEnrichment.enriched') || "Enriched"}</span></div>
                  <div className="text-xs dark:text-white/50 text-slate-500 font-mono mt-0.5">{t('crm.bento.smartEnrichment.vpEngineering') || "VP of Engineering @ TechCorp"}</div>
                </div>
              </div>
              
              <div className="flex-1 grid grid-cols-2 gap-3">
                 {[
                   { label: t('crm.bento.smartEnrichment.location') || "Location", value: t('crm.bento.smartEnrichment.locationValue') || "San Francisco, CA", verified: true },
                   { label: t('crm.bento.smartEnrichment.linkedin') || "LinkedIn", value: "linkedin.com/in/sjenkins", verified: true },
                   { label: t('crm.bento.smartEnrichment.companySize') || "Company Size", value: "1,000 - 5,000", verified: true },
                   { label: t('crm.bento.smartEnrichment.techStack') || "Tech Stack", value: "React, Node, AWS", verified: true },
                 ].map((data, idx) => (
                    <div key={idx} className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-lg p-3 flex flex-col gap-1 relative overflow-hidden group/data hover:border-blue-500/30 transition-colors">
                       {/* Scanning overlay on hover */}
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent -translate-x-full group-hover/data:animate-[slide_1.5s_ease-in-out_infinite]"></div>
                       <span className="text-[10px] dark:text-white/40 text-slate-500 uppercase font-bold tracking-wider">{data.label}</span>
                       <div className="flex items-center justify-between mt-1">
                         <span className="text-xs dark:text-white/90 text-slate-800 truncate font-medium">{data.value}</span>
                         {data.verified && <Check size={10} className="text-blue-500"/>}
                       </div>
                    </div>
                 ))}
                 
                 <div className="col-span-2 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3 mt-2 shadow-sm relative overflow-hidden">
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-500 opacity-50 shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                    <Bot size={14} className="text-blue-500 mt-0.5 shrink-0 ml-1" />
                    <div>
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-1">{t('crm.bento.smartEnrichment.aiInsight') || "AI Insight"}</span>
                      <p className="text-xs dark:text-white/70 text-slate-600 leading-relaxed">{t('crm.bento.smartEnrichment.insightText') || "Sarah recently posted about scaling Node.js applications. High probability of interest in our infrastructure solutions."}</p>
                    </div>
                 </div>
              </div>
            </div>
         </div>
      )
    },
    {
      title: t('crm.bento.aiForecasting.title') || "AI Forecasting",
      description: t('crm.bento.aiForecasting.description') || "Predictive analytics that learn from your historical wins to give you an accurate revenue forecast, completely hands-off.",
      icon: <PieChart size={24} className="text-emerald-500" />,
      color: "emerald",
      mockup: (
        <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl">
           <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_16px,rgba(16,185,129,0.02)_16px,rgba(16,185,129,0.02)_32px)]"></div>
           {/* Radar Sweep Effect */}
           <div className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,transparent_270deg,rgba(16,185,129,0.1)_360deg)] animate-[spin_4s_linear_infinite] rounded-full pointer-events-none z-10"></div>
           
           <div className="p-6 relative z-20 h-full flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl p-3 flex flex-col justify-center backdrop-blur-sm group-hover:border-emerald-500/30 transition-colors">
                  <span className="text-[10px] dark:text-white/50 text-slate-500 uppercase tracking-wider font-bold mb-1">{t('crm.bento.aiForecasting.winProbability') || "AI Win Probability"}</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold dark:text-white text-slate-900 font-mono">68%</span>
                    <span className="text-xs text-emerald-500 mb-1 flex items-center bg-emerald-500/10 px-1 py-0.5 rounded font-bold"><TrendingUp size={10}/> +5%</span>
                  </div>
                </div>
                <div className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl p-3 flex flex-col justify-center backdrop-blur-sm group-hover:border-emerald-500/30 transition-colors">
                  <span className="text-[10px] dark:text-white/50 text-slate-500 uppercase tracking-wider font-bold mb-1">{t('crm.bento.aiForecasting.projectedQ4') || "Projected Q4"}</span>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold dark:text-white text-slate-900 font-mono">$1.2M</span>
                    <span className="text-xs text-emerald-500 mb-1 flex items-center bg-emerald-500/10 px-1 py-0.5 rounded font-bold"><TrendingUp size={10}/> +$150k</span>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl p-4 flex flex-col backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                   <span className="text-xs font-bold dark:text-white/80 text-slate-700 uppercase tracking-wider">{t('crm.bento.aiForecasting.confidenceTrend') || "Confidence Trend"}</span>
                   <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                      <Bot size={10}/> {t('crm.bento.aiForecasting.aiOptimized') || "AI Optimized"}
                   </div>
                </div>
                <div className="flex-1 flex items-end justify-between gap-2 relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 z-0">
                    <div className="w-full border-t dark:border-white/20 border-black/20"></div>
                    <div className="w-full border-t dark:border-white/20 border-black/20"></div>
                    <div className="w-full border-t dark:border-white/20 border-black/20"></div>
                    <div className="w-full border-t dark:border-white/20 border-black/20"></div>
                  </div>
                  {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                    <div key={i} className="w-full bg-emerald-500/20 rounded-t relative group/bar z-10 hover:bg-emerald-500/40 transition-colors cursor-crosshair" style={{ height: `${h}%` }}>
                      <div className="absolute bottom-0 left-0 w-full bg-emerald-500 rounded-t shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all duration-700 ease-bounce" style={{ height: `${h * 0.7}%`, transitionDelay: `${i * 100}ms` }}></div>
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#09090b] text-white font-mono text-[10px] px-2 py-1 rounded border border-emerald-500/30 opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl">
                        {h}% {t('crm.bento.aiForecasting.conf') || "Conf"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
           </div>
        </div>
      )
    },
    {
      title: t('crm.bento.customWorkflows.title') || "Custom Workflows",
      description: t('crm.bento.customWorkflows.description') || "Build complex logic visually or let the AI set it up for you. Trigger SLA alerts, automated follow-ups, and territory routing based on any field change.",
      icon: <NetworkTree size={24} className="text-violet-500" />,
      color: "violet",
      mockup: (
         <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-slate-50 rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8b5cf60a_1px,transparent_1px),linear-gradient(to_bottom,#8b5cf60a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            
            {/* Glow Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-700"></div>

            <div className="absolute inset-0 flex items-center justify-center">
               <div className="relative w-full max-w-[340px] h-[310px]">
                  {/* SVG Paths for connections */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                     <path d="M 170 82 L 170 110" stroke="currentColor" className="text-violet-500/40" strokeWidth="2" strokeDasharray="6 6" fill="none">
                        <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
                     </path>

                     <path d="M 170 192 C 170 215, 80 210, 80 230" stroke="currentColor" className="text-violet-500/40" strokeWidth="2" strokeDasharray="6 6" fill="none">
                        <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
                     </path>

                     <path d="M 170 192 C 170 215, 260 210, 260 230" stroke="currentColor" className="text-violet-500/40" strokeWidth="2" strokeDasharray="6 6" fill="none">
                        <animate attributeName="stroke-dashoffset" from="12" to="0" dur="1s" repeatCount="indefinite" />
                     </path>
                  </svg>

                  {/* Trigger Node */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[220px] dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md border border-violet-500/30 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.15)] z-10 group-hover:-translate-y-1 transition-transform duration-500">
                     <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 dark:bg-[#09090b] bg-white border-2 border-violet-500 rounded-full z-20 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                     <div className="p-3">
                        <div className="flex items-center justify-between mb-3">
                           <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-violet-500/20 flex items-center justify-center text-violet-500 border border-violet-500/20">
                                 <Zap size={12} />
                              </div>
                              <span className="text-[10px] font-bold dark:text-white/80 text-slate-700 uppercase tracking-wider">{t('crm.bento.customWorkflows.trigger') || "Trigger"}</span>
                           </div>
                           <div className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-bold uppercase border border-emerald-500/20 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> {t('crm.bento.customWorkflows.active') || "Active"}
                           </div>
                        </div>
                        <div className="text-xs font-semibold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 rounded-md px-2 py-1.5 bg-black/5 dark:bg-white/5 font-mono shadow-inner">
                           {t('crm.bento.customWorkflows.stageClosedWon') || 'Stage = "Closed Won"'}
                        </div>
                     </div>
                  </div>

                  {/* Condition Node */}
                  <div className="absolute top-[110px] left-1/2 -translate-x-1/2 w-[200px] dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md border dark:border-white/10 border-black/10 hover:border-violet-500/30 rounded-xl shadow-lg z-10 group-hover:scale-105 transition-all duration-500 delay-75">
                     <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 dark:bg-[#09090b] bg-white border-2 dark:border-slate-600 border-slate-300 rounded-full z-20"></div>
                     <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 dark:bg-[#09090b] bg-white border-2 border-violet-500 rounded-full z-20 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                     <div className="p-3">
                        <div className="flex items-center gap-2 mb-3">
                           <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center text-amber-500 border border-amber-500/20">
                              <NetworkTree size={12} />
                           </div>
                           <span className="text-[10px] font-bold dark:text-white/80 text-slate-700 uppercase tracking-wider">{t('crm.bento.customWorkflows.condition') || "Condition"}</span>
                        </div>
                        <div className="text-xs font-semibold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 rounded-md px-2 py-1.5 bg-black/5 dark:bg-white/5 flex items-center justify-between shadow-inner">
                           <span>{t('crm.bento.customWorkflows.value') || "Value"}</span>
                           <span className="text-violet-500 font-mono font-bold">&gt; $10k</span>
                        </div>
                     </div>
                  </div>

                  {/* Action Node 1 */}
                  <div className="absolute top-[230px] left-[0px] w-[160px] dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md border dark:border-white/10 border-black/10 hover:border-blue-500/30 rounded-xl shadow-lg z-10 group-hover:-translate-x-2 transition-transform duration-500 delay-150">
                     <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 dark:bg-[#09090b] bg-white border-2 dark:border-slate-600 border-slate-300 rounded-full z-20"></div>
                     <div className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                              <Mail size={12} />
                           </div>
                           <div className="text-[10px] font-bold dark:text-white/60 text-slate-500 uppercase tracking-wider">{t('crm.bento.customWorkflows.action') || "Action"}</div>
                        </div>
                        <div className="text-xs font-semibold dark:text-white text-slate-900 leading-tight">{t('crm.bento.customWorkflows.sendWelcomeEmail') || "Send Welcome Email"}</div>
                     </div>
                  </div>

                  {/* Action Node 2 */}
                  <div className="absolute top-[230px] right-[0px] w-[160px] dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md border dark:border-white/10 border-black/10 hover:border-emerald-500/30 rounded-xl shadow-lg z-10 group-hover:translate-x-2 transition-transform duration-500 delay-150">
                     <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 dark:bg-[#09090b] bg-white border-2 dark:border-slate-600 border-slate-300 rounded-full z-20"></div>
                     <div className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                              <Check size={12} />
                           </div>
                           <div className="text-[10px] font-bold dark:text-white/60 text-slate-500 uppercase tracking-wider">{t('crm.bento.customWorkflows.action') || "Action"}</div>
                        </div>
                        <div className="text-xs font-semibold dark:text-white text-slate-900 leading-tight">{t('crm.bento.customWorkflows.createOnboardingTask') || "Create Onboarding Task"}</div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 dark:bg-black/60 bg-white/90 border dark:border-white/10 border-black/10 px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-md shadow-xl z-20 cursor-pointer hover:border-violet-500/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-all">
               <div className="text-violet-500 animate-pulse">
                  <Bot size={14} />
               </div>
               <span className="text-[10px] font-bold dark:text-white/90 text-slate-800 uppercase tracking-wider">{t('crm.bento.customWorkflows.generateWithAI') || "Generate with AI"}</span>
               <div className="flex gap-0.5 ml-1">
                  <div className="w-1 h-1 bg-violet-500 rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1 h-1 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
               </div>
            </div>
         </div>
      )
    }
  ];

  return (
    <div ref={containerRef} className="py-24 relative overflow-hidden bg-slate-50 dark:bg-[#030303] border-t border-black/5 dark:border-white/[0.04]">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-500/10 blur-[100px] opacity-30 rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Reveal
            delay={0}
            direction="up"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 dark:text-white/70 text-slate-500 text-xs font-bold uppercase tracking-wider mb-6"
          >{t('crm.header.coreCapabilities') || "Core CRM Capabilities"}</Reveal>
          <Reveal
            delay={100}
            direction="up"
            className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight"
          >
            {t('crm.header.everythingYouNeed') || "Everything you need to"} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">{t('crm.header.manageRelationships') || "manage relationships"}</span>
          </Reveal>
          <Reveal
            delay={200}
            direction="up"
            className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light leading-relaxed"
          >{t('crm.header.unifiedView') || "A unified view of your entire customer journey, augmented by AI that does the heavy lifting so your team can focus on selling."}</Reveal>
        </div>

        {/* Left/Right Animated Sections */}
        <div className="space-y-32">
          {bentoFeatures.map((feature, index) => {
            const isEven = index % 2 === 0;
            return (
              <Reveal
                key={index}
                delay={0}
                direction="up"
                className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 lg:gap-20 items-center`}
              >
                {/* Text Content */}
                <div className="flex-1 space-y-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-${feature.color}-500/5 shadow-sm group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 tracking-tight">{feature.title}</h3>
                  <p className="text-lg dark:text-white/60 text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                  
                </div>

                {/* Mockup Container */}
                <div className="flex-[1.2] w-full">
                   <div className="relative group perspective-[2000px]">
                      {/* Glow Behind */}
                      <div className={`absolute -inset-4 bg-${feature.color}-500/20 blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[3rem] -z-10`}></div>
                      
                      {/* 3D Wrapper */}
                      <MockupScrollWrapper direction={isEven ? "right" : "left"}>
                        <div className="relative z-10">
                          {feature.mockup}
                        </div>
                      </MockupScrollWrapper>
                   </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export function CrmClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-violet-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-violet-500/30 bg-violet-500/5 text-violet-500">
              <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
              {t('crm.hero.chip') || "Customer Relationship Management"}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              {t('crm.hero.operateFrom') || "Operate from a"} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-500">{t('crm.hero.singleSource') || "single source of truth"}</span>
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-10">{t('crm.hero.description') || "Your pipeline manages itself with automated activity logging and stage gating. Trust your forecast because it's based on real activity, not manual updates."}</p>
          </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-violet-500 hover:bg-violet-600 text-white font-inter font-bold transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] flex items-center justify-center gap-2 group">
              {t('crm.hero.startWith') || "Start with Makinari"}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
              {t('crm.hero.exploreFeatures') || "Explore all features"}
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
                <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_center,transparent,transparent_12px,rgba(139,92,246,0.02)_12px,rgba(139,92,246,0.02)_24px)] opacity-100 pointer-events-none rounded-xl"></div>
                
                {/* Mockup UI */}
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div className="space-y-2">
                    <div className="text-xs dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                      <TrendingUp size={12} /> {t('crm.feature1.pipelineValue') || "Pipeline Value"}
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
                        <span className="truncate">{t('crm.feature1.projectedRevenue') || "Projected Revenue"}</span>
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
                        <Star size={12} /> {t('crm.feature1.copilotInsight') || "Copilot Insight"}
                      </div>
                      <div className="dark:text-white/80 text-slate-500 text-sm leading-relaxed">{t('crm.feature1.copilotInsightText') || "Acme Corp deal is stalling. Consider sending the ROI calculator to the CFO. I can draft this email for you."}</div>
                      <div className="mt-3 flex gap-2">
                        <div className="bg-violet-500 dark:text-white text-slate-900 text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer hover:bg-violet-600 transition-colors">{t('crm.feature1.draftEmail') || "Draft Email"}</div>
                        <div className="dark:bg-white/10 bg-black/10 dark:text-white/70 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-md cursor-pointer hover:dark:bg-white/20 bg-black/20 transition-colors">{t('crm.feature1.dismiss') || "Dismiss"}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pipeline stages */}
                  <div className="w-full flex justify-between mt-6 px-2 relative z-10 gap-2">
                    {[
                      { name: t('crm.feature1.stages.lead') || "Lead", color: "bg-blue-400" },
                      { name: t('crm.feature1.stages.meeting') || "Meeting", color: "bg-orange-400" },
                      { name: t('crm.feature1.stages.proposal') || "Proposal", color: "bg-violet-400" },
                      { name: t('crm.feature1.stages.negotiation') || "Negotiation", color: "bg-pink-400" },
                      { name: t('crm.feature1.stages.closed') || "Closed", color: "bg-emerald-400" }
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
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">{t('crm.feature1.title') || "An intelligent CRM that works for you"}</h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">{t('crm.feature1.description') || "Stop updating fields manually. Our CRM automatically enriches contacts, logs activities, and prompts you with the next best action to close deals faster."}</p>
              <ul className="space-y-4">
                {[
                  { id: 'ai-copilot', name: t('crm.feature1.askAi.name') || "Ask AI Copilot", icon: <Bot size={18} className="text-violet-400" />, desc: t('crm.feature1.askAi.desc') || "Get real-time deal insights and draft communications instantly." },
                  { id: 'reporting', name: t('crm.feature1.reporting.name') || "Reporting & Forecasting", icon: <PieChart size={18} className="text-violet-400" />, desc: t('crm.feature1.reporting.desc') || "Predict revenue accurately based on actual signals, not guesses." },
                  { id: 'workflows', name: t('crm.feature1.workflows.name') || "Automated Workflows", icon: <NetworkTree size={18} className="text-violet-400" />, desc: t('crm.feature1.workflows.desc') || "Trigger tasks, emails, and alerts when deal stages change." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-500 font-medium group">
                    <div className="w-10 h-10 rounded-md dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-violet-500/5 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-violet-500/30 transition-colors">
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

      <CrmBentoFeatures />
      {/* Enterprise-Grade Core Section */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-slate-50 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-fuchsia-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 relative z-10">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-xs font-bold mb-6 border dark:border-white/10 border-black/10 text-slate-500 dark:text-white/70">{t('crm.enterprise.chip') || "Enterprise-Grade Architecture"}</div>
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                {t('crm.enterprise.title') || "A robust foundation for"} <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-violet-400">{t('crm.enterprise.complexOperations') || "complex operations"}</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">{t('crm.enterprise.description') || "Beyond AI, Makinari delivers all the core CRM features that growing enterprise teams demand for their daily operations."}</p>
            </div>
          </Reveal>

          <div className="flex flex-col gap-24 mt-16">
            
            {/* Widget 1: 360 Customer View */}
            <Reveal delay={100} className="w-full">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                <div className="w-full lg:w-1/2 flex-shrink-0">
                  <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-slate-50 rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl transition-all duration-500 hover:-translate-y-1">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#d946ef0a_1px,transparent_1px),linear-gradient(to_bottom,#d946ef0a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {/* Glow Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    {/* Visual Widget */}
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <div className="relative z-10 w-full h-full rounded-xl border dark:border-white/10 border-black/10 dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md overflow-hidden flex flex-col p-4 shadow-xl group-hover:scale-[1.02] transition-transform duration-500">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-transparent via-fuchsia-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(217,70,239,0.8)] animate-[scan_vertical_4s_ease-in-out_infinite] pointer-events-none z-20"></div>

                      <div className="flex items-center justify-between mb-6 pb-4 border-b dark:border-white/5 border-black/5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(217,70,239,0.2)] border border-fuchsia-500/30 group-hover:scale-110 transition-transform duration-500">
                            <Users size={24} />
                          </div>
                          <div>
                            <div className="text-lg font-bold dark:text-white text-slate-900">Acme Corp</div>
                            <div className="text-sm dark:text-white/40 text-slate-500 font-mono text-[10px]">acmecorp.com</div>
                          </div>
                        </div>
                        <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div> {t('crm.bento.customWorkflows.active') || "Active"}
                        </div>
                      </div>
                      <div className="flex-[1] flex flex-col gap-6 relative px-2 overflow-hidden">
                        <div className="absolute left-[15px] top-4 bottom-0 w-px border-l border-dashed border-fuchsia-500/30"></div>
                        
                        <div className="flex items-start gap-5 relative z-10">
                          <div className="w-4 h-4 rounded-full bg-fuchsia-400 border-[3px] border-[#09090b] shadow-[0_0_10px_rgba(217,70,239,0.5)] mt-1 shrink-0 z-10"></div>
                            <div className="flex-[1] bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-lg p-4 group-hover:bg-fuchsia-500/15 transition-colors shadow-sm relative overflow-hidden">
                              <div className="absolute right-0 top-0 w-16 h-16 bg-fuchsia-500/10 blur-[15px] rounded-full"></div>
                              <div className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"><Globe size={10} /> {t('crm.widget1.justNow') || "Just Now"}</div>
                              <div className="text-sm font-medium dark:text-white/90 text-slate-800">{t('crm.widget1.viewedPricing') || "Viewed Enterprise Pricing Page"}</div>
                              <div className="mt-2 flex gap-2">
                                <span className="text-[8px] px-2 py-0.5 rounded border border-fuchsia-500/30 text-fuchsia-400 bg-fuchsia-500/10 font-bold uppercase">{t('crm.widget1.highIntent') || "High Intent"}</span>
                              </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-5 relative z-10">
                          <div className="w-4 h-4 rounded-full dark:bg-slate-700 bg-slate-300 border-[3px] border-[#09090b] mt-1 shrink-0 z-10"></div>
                          <div className="flex-[1] dark:bg-white/[0.03] bg-black/5 border dark:border-white/5 border-black/5 rounded-lg p-3 hover:dark:bg-white/5 transition-colors">
                            <div className="text-[10px] dark:text-white/40 text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><Mail size={10} /> {t('crm.widget1.hoursAgo') || "2 hours ago"}</div>
                            <div className="text-xs dark:text-white/70 text-slate-600">{t('crm.widget1.openedEmail') || 'Opened Email: "Q3 Strategy Planning"'}</div>
                          </div>
                        </div>

                        <div className="flex items-start gap-5 relative z-10 opacity-50">
                          <div className="w-4 h-4 rounded-full dark:bg-slate-700 bg-slate-300 border-[3px] border-[#09090b] mt-1 shrink-0 z-10"></div>
                          <div className="flex-[1] dark:bg-white/[0.03] bg-black/5 border dark:border-white/5 border-black/5 rounded-lg p-3">
                            <div className="h-3 w-1/4 rounded dark:neu-skeleton neu-skeleton-light mb-2"></div>
                            <div className="h-3 w-3/4 rounded dark:neu-skeleton neu-skeleton-light"></div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Floating Element */}
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 w-48 rounded-md dark:neu-panel neu-panel-light p-3 animate-float-slow transition-transform group-hover:scale-105 z-30 shadow-2xl border border-fuchsia-500/20 bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl">
                        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-fuchsia-500/50 to-transparent"></div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400 mb-2 flex items-center gap-1.5"><Bot size={10}/>{t('crm.widget1.aiInsight') || "AI Insight"}</div>
                        <div className="text-xs dark:text-white/80 text-slate-600 leading-relaxed">{t('crm.widget1.insightText') || "Decision maker is active. Recommend immediate follow-up."}</div>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
                <div className="w-full lg:w-1/2">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-fuchsia-500/5 flex items-center justify-center text-fuchsia-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                    <Users size={24} />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('crm.widget1.title') || "360° Customer View"}</h3>
                  <p className="text-lg dark:text-white/60 text-slate-600 leading-relaxed">{t('crm.widget1.description') || "Get a complete timeline of every interaction, email, meeting, and transaction in one unified profile. Stop digging through different tabs to understand where a deal stands. Everything is chronologically ordered and enriched automatically."}</p>
                  <ul className="mt-8 space-y-3">
                    {[t('crm.widget1.feature1') || 'Automatic activity capture', t('crm.widget1.feature2') || 'Unified communication history', t('crm.widget1.feature3') || 'Cross-object data enrichment', t('crm.widget1.feature4') || 'Real-time intent signals'].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm font-medium dark:text-white/70 text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center shrink-0">
                          <Check size={12} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Widget 2: Visual Pipeline Management */}
            <Reveal delay={150} className="w-full">
              <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
                <div className="w-full lg:w-1/2">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-violet-500/5 flex items-center justify-center text-violet-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                    <LayoutGrid size={24} />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('crm.widget2.title') || "Visual Pipeline Management"}</h3>
                  <p className="text-lg dark:text-white/60 text-slate-600 leading-relaxed">{t('crm.widget2.description') || "Drag-and-drop Kanban boards with custom stages, win probabilities, and automated transitions. Manage your sales process exactly how your team works, with complete visibility into every stage."}</p>
                  <ul className="mt-8 space-y-3">
                    {[t('crm.widget2.feature1') || 'Customizable pipeline stages', t('crm.widget2.feature2') || 'Drag-and-drop deal movement', t('crm.widget2.feature3') || 'Automated stage transitions', t('crm.widget2.feature4') || 'Win probability forecasting'].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm font-medium dark:text-white/70 text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                          <Check size={12} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-full lg:w-1/2 flex-shrink-0">
                  <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-slate-50 rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl transition-all duration-500 hover:-translate-y-1">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#8b5cf60a_1px,transparent_1px),linear-gradient(to_bottom,#8b5cf60a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {/* Glow Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    {/* Visual Widget */}
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <div className="relative z-10 w-full h-full flex gap-4 overflow-hidden dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md rounded-xl border dark:border-white/10 border-black/10 p-4 shadow-xl group-hover:scale-[1.02] transition-transform duration-500">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-[scan_3s_ease-in-out_infinite_reverse] pointer-events-none z-20"></div>
                      
                      {[
                        { name: t('crm.feature1.stages.meeting') || "Meeting", count: "5", color: "bg-blue-400", val: "$45K" },
                        { name: t('crm.feature1.stages.proposal') || "Proposal", count: "2", color: "bg-violet-400", val: "$145K", active: true }
                      ].map((col, i) => (
                        <div key={i} className={`flex-[1] flex flex-col gap-3 rounded-xl p-3 border relative overflow-hidden transition-colors ${col.active ? 'bg-violet-500/5 border-violet-500/30' : 'bg-white/[0.02] border-white/5'}`}>
                          <div className="flex items-center justify-between px-1 mb-1">
                            <div className="text-[10px] font-bold dark:text-white/80 text-slate-700 uppercase tracking-wider">{col.name}</div>
                            <div className="text-[10px] font-mono font-bold dark:text-white/50 text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">{col.count}</div>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono px-1">{col.val} {t('crm.widget2.total') || "Total"}</div>
                          <div className="w-full h-1 rounded-full dark:bg-white/10 bg-black/10 mb-2">
                            <div className={`h-full rounded-full ${col.color} shadow-[0_0_8px_${col.color}]`} style={{ width: col.active ? '75%' : (i===0 ? '40%' : '100%') }}></div>
                          </div>
                          
                          <div className="flex flex-col gap-3 flex-[1] overflow-hidden relative">
                            {/* Card 1 */}
                            {col.active && (
                              <div className="w-full rounded-lg bg-violet-500/10 border border-violet-500/40 p-3 shadow-[0_0_20px_rgba(139,92,246,0.2)] group-hover:-translate-y-1 transition-transform duration-300 relative z-20 cursor-grab active:cursor-grabbing backdrop-blur-md">
                                <div className="absolute -left-px top-2 bottom-2 w-0.5 bg-violet-500 rounded-full"></div>
                                <div className="flex justify-between items-start mb-2">
                                  <div className="text-sm font-bold dark:text-white text-slate-900">Acme Corp</div>
                                  <div className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">{t('crm.widget2.winRate') || "75% Win"}</div>
                                </div>
                                <div className="text-xs text-violet-300 font-mono font-bold mb-3">$145,000</div>
                                <div className="flex justify-between items-center mt-auto border-t border-white/5 pt-2">
                                  <div className="flex -space-x-1">
                                    <div className="w-5 h-5 rounded-full bg-violet-400/30 flex items-center justify-center text-[8px] font-bold border border-violet-500/50">JD</div>
                                    <div className="w-5 h-5 rounded-full bg-blue-400/30 flex items-center justify-center text-[8px] font-bold border border-blue-500/50">AM</div>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                                    <Bot size={10} className="text-violet-400" /> {t('crm.widget2.action') || "Action"}
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {/* Other Cards */}
                            {Array.from({ length: col.active ? 1 : 2 }).map((_, j) => (
                              <div key={`card-${j}`} className="w-full rounded-lg dark:bg-white/[0.03] bg-white p-3 border dark:border-white/5 border-black/10 shadow-sm hover:dark:bg-white/[0.05] transition-colors cursor-grab">
                                <div className="w-3/4 h-2.5 rounded dark:neu-skeleton neu-skeleton-light mb-2"></div>
                                <div className="w-1/2 h-2 rounded dark:neu-skeleton neu-skeleton-light opacity-60 mb-3"></div>
                                <div className="w-full flex justify-between border-t border-white/5 pt-2 mt-2">
                                  <div className="w-4 h-4 rounded-full dark:neu-skeleton neu-skeleton-light opacity-50"></div>
                                  <div className="w-8 h-2 rounded dark:neu-skeleton neu-skeleton-light opacity-40"></div>
                                </div>
                              </div>
                            ))}

                            {/* Drag overlay hint */}
                            {col.active && <div className="absolute inset-0 border-2 border-dashed border-violet-500/20 rounded-lg pointer-events-none z-10 hidden group-hover:block opacity-50"></div>}
                          </div>
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Widget 3: Omnichannel Inbox */}
            <Reveal delay={200} className="w-full">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                <div className="w-full lg:w-1/2 flex-shrink-0">
                  <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-slate-50 rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl transition-all duration-500 hover:-translate-y-1">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#3b82f60a_1px,transparent_1px),linear-gradient(to_bottom,#3b82f60a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {/* Glow Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    {/* Visual Widget */}
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <div className="relative z-10 w-full h-full rounded-xl border dark:border-white/10 border-black/10 dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md overflow-hidden flex flex-col shadow-xl group-hover:scale-[1.02] transition-transform duration-500">
                      <div className="flex border-b dark:border-white/10 border-black/10 bg-black/20">
                        <div className="flex-[1] p-3 border-r dark:border-white/10 border-black/10 bg-blue-500/10 flex items-center justify-center gap-2 border-b-2 border-b-blue-500 relative">
                          <Mail size={14} className="text-blue-400" />
                          <span className="text-xs font-bold text-blue-400">{t('crm.widget3.email') || "Email"}</span>
                          <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
                        </div>
                        <div className="flex-[1] p-3 border-r dark:border-white/10 border-black/10 flex items-center justify-center gap-2 opacity-50 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer">
                          <MessageSquare size={14} className="dark:text-white text-slate-900" />
                          <span className="text-xs font-bold dark:text-white text-slate-900">{t('crm.widget3.whatsapp') || "WhatsApp"}</span>
                        </div>
                        <div className="flex-[1] p-3 flex items-center justify-center gap-2 opacity-50 hover:opacity-100 hover:bg-white/5 transition-all cursor-pointer">
                          <Phone size={14} className="dark:text-white text-slate-900" />
                          <span className="text-xs font-bold dark:text-white text-slate-900">{t('crm.widget3.calls') || "Calls"}</span>
                        </div>
                      </div>
                      
                      <div className="flex-[1] p-6 flex flex-col gap-4 overflow-hidden relative bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')]">
                        <div className="self-center bg-black/20 dark:bg-white/10 border border-white/5 px-4 py-1 rounded-full text-[10px] font-bold dark:text-white/60 text-slate-500 mb-2 backdrop-blur-md">{t('crm.widget3.today') || "Today"}</div>
                        
                        <div className="self-start bg-black/10 dark:bg-white/[0.03] border border-white/5 rounded-2xl rounded-tl-sm p-4 max-w-[85%] text-sm dark:text-white/90 text-slate-700 relative shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-bold text-xs opacity-70">Sarah Jenkins</div>
                            <div className="text-[9px] font-mono opacity-50">10:42 AM</div>
                          </div>
                          <p className="leading-relaxed text-xs">{t('crm.widget3.clientMessage') || "Thanks for the proposal. We're reviewing it with the board tomorrow. Can we schedule a quick call for Friday?"}</p>
                        </div>
                        
                        <div className="self-end bg-blue-500/10 border border-blue-500/30 rounded-2xl rounded-tr-sm p-4 max-w-[85%] text-sm text-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.15)] group-hover:scale-[1.02] transition-transform origin-bottom-right duration-500 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/20 blur-[15px] rounded-full"></div>
                          <div className="flex items-center justify-between mb-2 relative z-10">
                            <div className="font-bold text-xs text-blue-400">{t('crm.widget3.you') || "You"}</div>
                            <div className="text-[9px] font-mono text-blue-400/60">11:05 AM</div>
                          </div>
                          <p className="leading-relaxed text-xs relative z-10">{t('crm.widget3.yourMessage') || "Absolutely, Sarah. I'll send over a calendar invite for Friday morning. Let me know if the board needs any additional documentation."}</p>
                          <div className="flex justify-end items-center gap-1 mt-3 pt-2 border-t border-blue-500/20 relative z-10">
                            <div className="text-[8px] uppercase tracking-wider font-bold text-blue-400 flex items-center gap-1"><Check size={10} className="text-blue-500" /> {t('crm.widget3.read') || "Read"}</div>
                          </div>
                        </div>
                        
                        <div className="absolute bottom-4 left-6 right-6 h-12 rounded-full dark:bg-black/60 bg-white border dark:border-white/10 border-black/10 flex items-center px-4 justify-between shadow-xl backdrop-blur-xl group/input hover:border-blue-500/50 transition-colors">
                          <div className="text-xs font-mono dark:text-white/40 text-slate-400 flex items-center gap-2">
                            <span className="w-1 h-4 bg-blue-500 rounded-full animate-pulse opacity-0 group-hover/input:opacity-100 transition-opacity"></span>
                            {t('crm.widget3.replyPlaceholder') || "Reply to Sarah..."}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] cursor-pointer hover:bg-blue-400 transition-colors">
                            <Bot size={14} />
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="w-full lg:w-1/2">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-blue-500/5 flex items-center justify-center text-blue-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                    <MessageSquare size={24} />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('crm.widget3.title') || "Omnichannel Inbox"}</h3>
                  <p className="text-lg dark:text-white/60 text-slate-600 leading-relaxed">{t('crm.widget3.description') || "Manage email, WhatsApp, and social channels from a single threaded view attached to the deal record. Never lose context across different communication platforms again."}</p>
                  <ul className="mt-8 space-y-3">
                    {[t('crm.widget3.feature1') || 'Unified messaging thread per contact', t('crm.widget3.feature2') || 'Native WhatsApp & Email integration', t('crm.widget3.feature3') || 'AI-drafted contextual replies', t('crm.widget3.feature4') || 'Read receipts & engagement tracking'].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm font-medium dark:text-white/70 text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                          <Check size={12} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Widget 4: Advanced Dashboards */}
            <Reveal delay={250} className="w-full">
              <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-20">
                <div className="w-full lg:w-1/2">
                  <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center text-emerald-400 mb-6 shadow-sm group-hover:scale-110 transition-transform">
                    <BarChart size={24} />
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('crm.widget4.title') || "Advanced Dashboards"}</h3>
                  <p className="text-lg dark:text-white/60 text-slate-600 leading-relaxed">{t('crm.widget4.description') || "Customizable reports for sales funnels, team performance, and ROI tracking with real-time data sync. Build unlimited dashboards to track exactly the metrics that matter to your board."}</p>
                  <ul className="mt-8 space-y-3">
                    {[t('crm.widget4.feature1') || 'Drag-and-drop report builder', t('crm.widget4.feature2') || 'Real-time revenue forecasting', t('crm.widget4.feature3') || 'Team performance analytics', t('crm.widget4.feature4') || 'Exportable board-ready views'].map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-sm font-medium dark:text-white/70 text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <Check size={12} />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="w-full lg:w-1/2 flex-shrink-0">
                  <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-slate-50 rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl transition-all duration-500 hover:-translate-y-1">
                    {/* Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b9810a_1px,transparent_1px),linear-gradient(to_bottom,#10b9810a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    
                    {/* Glow Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-700"></div>
                    
                    {/* Visual Widget */}
                    <div className="absolute inset-0 flex items-center justify-center p-6">
                      <div className="relative z-10 w-full h-full rounded-xl border dark:border-white/10 border-black/10 dark:bg-[#09090b]/90 bg-white/90 backdrop-blur-md overflow-hidden flex flex-col gap-4 p-4 shadow-xl group-hover:scale-[1.02] transition-transform duration-500">
                      <div className="flex gap-4 h-1/3">
                        <div className="flex-[1] rounded-lg dark:bg-white/[0.03] bg-black/5 border dark:border-white/10 border-black/10 p-4 flex flex-col justify-center relative overflow-hidden group/stat hover:border-emerald-500/30 transition-colors cursor-default">
                          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[20px] opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                          <div className="text-[10px] font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                            {t('crm.widget4.arr') || "ARR"} <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
                          </div>
                          <div className="text-3xl font-bold dark:text-white text-slate-900 font-mono tracking-tight">$1.2M</div>
                          <div className="text-[10px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1 bg-emerald-500/10 w-fit px-2 py-0.5 rounded border border-emerald-500/20"><TrendingUp size={10}/>{t('crm.widget4.yoy') || "+18.5% YoY"}</div>
                        </div>
                        <div className="flex-[1] rounded-lg dark:bg-white/[0.03] bg-black/5 border dark:border-white/10 border-black/10 p-4 flex flex-col justify-center relative overflow-hidden group/stat hover:border-emerald-500/30 transition-colors cursor-default">
                          <div className="text-[10px] font-bold dark:text-white/50 text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                            {t('crm.widget4.winRate') || "Win Rate"} <BarChart size={10} className="dark:text-white/30" />
                          </div>
                          <div className="text-3xl font-bold dark:text-white text-slate-900 font-mono tracking-tight">32.4%</div>
                          <div className="text-[10px] text-emerald-400 font-bold mt-1.5 flex items-center gap-1 bg-emerald-500/10 w-fit px-2 py-0.5 rounded border border-emerald-500/20"><TrendingUp size={10}/>{t('crm.widget4.mom') || "+4.2% MoM"}</div>
                        </div>
                      </div>
                      
                      <div className="flex-[1] w-full rounded-lg border dark:border-white/10 border-black/10 dark:bg-white/[0.02] bg-white p-5 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500 opacity-50 shadow-[0_0_15px_rgba(16,185,129,1)]"></div>
                        <div className="flex justify-between items-center mb-4 relative z-10">
                          <div className="text-sm font-bold dark:text-white text-slate-900 flex items-center gap-2"><PieChart size={14} className="text-emerald-500"/> {t('crm.widget4.revenueForecast') || "Revenue Forecast"}</div>
                          <div className="text-[10px] uppercase font-bold dark:text-white/60 text-slate-500 px-2 py-1 rounded border dark:border-white/10 border-black/10 bg-black/20">{t('crm.widget4.q3') || "Q3 2026"}</div>
                        </div>
                        <div className="w-full flex items-end gap-2 flex-1 pt-4 relative z-10">
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                            <div className="w-full h-px dark:bg-white bg-black"></div>
                            <div className="w-full h-px dark:bg-white bg-black"></div>
                            <div className="w-full h-px dark:bg-white bg-black"></div>
                          </div>
                          
                          {[30, 45, 60, 40, 75, 55, 90, 85, 100].map((h, i) => (
                            <div key={i} className="flex-[1] rounded-t dark:bg-white/5 bg-black/5 group-hover:dark:bg-white/10 hover:border-emerald-500/50 border-t-2 border-transparent transition-all duration-500 relative overflow-hidden group/bar cursor-crosshair" style={{ height: '100%' }}>
                              <div className="absolute bottom-0 w-full rounded-t bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all duration-700 ease-bounce" style={{ height: `${h}%`, transitionDelay: `${i * 50}ms` }}></div>
                              {i > 5 && (
                                <div className="absolute bottom-0 w-full rounded-t bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.2)_4px,rgba(0,0,0,0.2)_8px)] z-10" style={{ height: `${h}%` }}></div>
                              )}
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-lg z-30">
                                ${h}k
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="w-full border-t dark:border-white/10 border-black/10 mt-3 pt-2 flex justify-between text-[9px] dark:text-white/40 text-slate-500 font-bold uppercase font-mono relative z-10">
                          <span>{t('crm.widget4.months.jul') || "Jul"}</span>
                          <span>{t('crm.widget4.months.aug') || "Aug"}</span>
                          <span>{t('crm.widget4.months.sep') || "Sep (Proj)"}</span>
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
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
