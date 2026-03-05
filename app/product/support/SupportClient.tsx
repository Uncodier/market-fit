"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Target, TrendingUp, Clock, Zap, CheckSquare, MessageSquare, Mail, Phone, Users, ShieldCheck, FileText, ArrowRight, Bot } from "@/app/components/ui/icons"
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

const SUPPORT_PROVIDERS = [
  { name: "Zendesk", color: "text-[#03363D] dark:text-white", iconColor: "text-[#03363D] dark:text-white", svg: <path d="M12.0007 0C5.37255 0 0 5.37255 0 12.0007C0 18.6274 5.37255 24 12.0007 24C18.6274 24 24 18.6274 24 12.0007C24 5.37255 18.6274 0 12.0007 0ZM19.2312 17.5513L15.3949 11.0478L19.2458 5.79815H17.2917L14.2492 9.9405L11.751 5.79815H7.50215L11.1278 11.7946L7.50215 17.5513H9.4548L12.6718 13.1843L15.3263 17.5513H19.2312Z"/> },
  { name: "Intercom", color: "text-black dark:text-white", iconColor: "text-[#000000] dark:text-white", svg: <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 18.25c-3.453 0-6.25-2.797-6.25-6.25S8.547 5.75 12 5.75s6.25 2.797 6.25 6.25-2.797 6.25-6.25 6.25z"/> },
  { name: "Front", color: "text-[#F9A825]", iconColor: "text-[#F9A825]", svg: <path d="M11.967 1.25l7.567 4.364v8.72l-7.567 4.363-7.567-4.363v-8.72l7.567-4.364zM11.967 0L3.4 4.93v9.86l8.567 4.93 8.566-4.93V4.93L11.967 0z"/> },
  { name: "Telegram", color: "text-[#22D3EE]", iconColor: "text-[#22D3EE]", svg: <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.222-.548.222l.188-3.03 5.517-4.98c.24-.214-.052-.334-.373-.122l-6.817 4.29-2.936-.918c-.636-.202-.647-.638.134-.945l11.47-4.426c.531-.194 1.002.13.865.937z"/> },
  { name: "WhatsApp", color: "text-[#25D366]", iconColor: "text-[#25D366]", svg: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/> },
  { name: "Slack", color: "text-[#4A154B] dark:text-[#E01E5A]", iconColor: "text-[#4A154B] dark:text-[#E01E5A]", svg: <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/> },
  { name: "Notion", color: "text-[#000000] dark:text-[#FFFFFF]", iconColor: "text-[#000000] dark:text-[#FFFFFF]", svg: <path d="M4.459 4.208c-.742.286-1.544-.22-1.544-1.011 0-.41.229-.79.593-.984L10.076.046c.552-.294 1.208-.294 1.76 0l11.082 5.922c.683.365.733 1.343.082 1.768L22.25 8.16l-3.351-1.742-5.756 2.924c-1.397.71-3.085.71-4.482 0l-4.202-2.134zm-2.915 2.502v10.643c0 .641.347 1.233.91 1.536l8.868 4.776c.54.29 1.18.29 1.72 0l8.775-4.726c.582-.313.945-.92.945-1.583V8.815l-1.921 1.006c-.687.36-1.517.36-2.204 0l-6.848-3.585-3.344 1.698c-1.077.548-2.38.548-3.458 0l-5.364-2.724z"/> },
  { name: "Jira", color: "text-[#0052CC]", iconColor: "text-[#0052CC]", svg: <path d="M11.53 2c0 2.4-1.97 4.35-4.35 4.35h-4.9v4.9c0 2.4 1.95 4.35 4.35 4.35 2.4 0 4.35-1.95 4.35-4.35V2zm6.12 10.65c-2.4 0-4.35 1.95-4.35 4.35v4.9h4.9c2.4 0 4.35-1.95 4.35-4.35 0-2.4-1.95-4.35-4.35-4.35v-4.9zm-6.12 0c0 2.4-1.95 4.35-4.35 4.35h-4.9v-4.9c0-2.4 1.95-4.35 4.35-4.35 2.4 0 4.35 1.95 4.35 4.35v4.9z"/> }
];

// ============================================================================
// COMPONENT: BENTO GRID LAYOUT FOR SUPPORT FEATURES
// ============================================================================

const SupportBentoFeatures = () => {
  const { t } = useLocalization();

  const containerRef = useRef<HTMLDivElement>(null);

  const bentoFeatures = [
    {
      title: t('support.bento.action.title') || "Action-driven Resolution",
      description: t('support.bento.action.desc') || "Grant agents access to your database or APIs. They can process refunds, update shipping addresses, cancel subscriptions, and solve tier-1 issues completely autonomously.",
      icon: <Zap size={24} className="text-indigo-500" />,
      color: "indigo",
      mockup: (
        <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(99,102,241,0.02)_20px,rgba(99,102,241,0.02)_40px)]"></div>
          {/* Vertical Scanner */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-[scan_3s_ease-in-out_infinite]"></div>
          </div>
          <div className="p-6 relative z-20 h-full flex flex-col gap-4">
             <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold dark:text-white/80 text-slate-700">{t('support.bento.action.mockup.log') || 'API Execution Log'}</span>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>{t('support.bento.action.mockup.live') || 'Live'}
                </div>
             </div>
             
             {[
                { action: "POST /v1/refunds", status: "200 OK", time: t('support.bento.action.mockup.time1') || "Just now", data: '{"order_id": "ORD-1234", "amount": 45.00}', color: "emerald" },
                { action: "PUT /v1/users/shipping", status: "200 OK", time: t('support.bento.action.mockup.time2') || "2m ago", data: '{"address": "123 Main St..."}', color: "emerald" },
                { action: "GET /v1/subscriptions", status: "200 OK", time: t('support.bento.action.mockup.time3') || "5m ago", data: '{"status": "active", "plan": "pro"}', color: "blue" },
             ].map((log, idx) => (
                <div key={idx} className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-xl p-3 flex flex-col gap-2 group/log hover:border-indigo-500/30 transition-colors backdrop-blur-sm relative overflow-hidden">
                   <div className={`absolute left-0 top-0 w-1 h-full bg-${log.color}-500 opacity-50`}></div>
                   <div className="flex justify-between items-start pl-2">
                      <div className="text-xs font-mono dark:text-white/90 text-slate-800 font-bold">{log.action}</div>
                      <div className={`text-[10px] font-bold text-${log.color}-500 bg-${log.color}-500/10 px-1.5 py-0.5 rounded border border-${log.color}-500/20`}>{log.status}</div>
                   </div>
                   <div className="pl-2 flex justify-between items-end">
                      <div className="text-[9px] font-mono dark:text-white/40 text-slate-500 truncate max-w-[80%]">{log.data}</div>
                      <div className="text-[8px] dark:text-white/30 text-slate-400 font-bold uppercase">{log.time}</div>
                   </div>
                </div>
             ))}
          </div>
        </div>
      )
    },
    {
      title: t('support.bento.handoff.title') || "Seamless Handoff",
      description: t('support.bento.handoff.desc') || "When sentiment drops or issues become complex, AI instantly routes the conversation to a human rep along with a full summary.",
      icon: <Users size={24} className="text-purple-500" />,
      color: "purple",
      mockup: (
         <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl flex flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.05),transparent_60%)] pointer-events-none"></div>
            
            {/* Header */}
            <div className="p-4 border-b dark:border-white/5 border-black/5 flex justify-between items-center bg-black/20">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 font-bold text-xs border border-purple-500/30">JD</div>
                  <div>
                     <div className="text-xs font-bold dark:text-white text-slate-900">{t('support.bento.handoff.mockup.user') || 'John Doe'}</div>
                     <div className="text-[9px] dark:text-white/50 text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> {t('support.bento.handoff.mockup.status') || 'Frustrated'}</div>
                  </div>
               </div>
               <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                  {t('support.bento.handoff.mockup.escalated') || 'Escalated'}
               </div>
            </div>
            
            {/* Summary Box */}
            <div className="p-4 border-b dark:border-white/5 border-black/5 bg-purple-500/5 relative overflow-hidden">
               <div className="absolute left-0 top-0 w-1 h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
               <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Bot size={12} /> {t('support.bento.handoff.mockup.aiSummaryTitle') || 'AI Summary'}</div>
               <p className="text-xs dark:text-white/80 text-slate-700 leading-relaxed">
                  {t('support.bento.handoff.mockup.aiSummaryText') || 'Customer has been trying to reset their password but isn\'t receiving the recovery email. I verified their email is correct and not on bounce list. They are getting frustrated after 3 attempts. Handing off to human agent to check mail server logs.'}
               </p>
            </div>
            
            {/* Chat Area */}
            <div className="flex-1 p-4 flex flex-col gap-3 relative z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')]">
               <div className="self-center text-[9px] font-bold dark:text-white/40 text-slate-500 bg-black/20 px-2 py-0.5 rounded-full">{t('support.bento.handoff.mockup.agentJoined') || 'Human Agent Joined'}</div>
               
               <div className="self-end bg-purple-500/10 border border-purple-500/30 rounded-2xl rounded-tr-sm p-3 max-w-[85%] text-sm text-purple-100 shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:scale-[1.02] transition-transform origin-bottom-right">
                 <div className="flex items-center justify-between mb-1">
                   <div className="font-bold text-[10px] text-purple-400">{t('support.bento.handoff.mockup.agentName') || 'Sarah (Support)'}</div>
                 </div>
                 <p className="leading-relaxed text-xs">{t('support.bento.handoff.mockup.agentMsg') || 'Hi John, I\'m taking over this chat. I see you\'re having trouble with the password reset. Let me check our mail server logs right now.'}</p>
               </div>
            </div>
         </div>
      )
    },
    {
      title: t('support.bento.learning.title') || "Instant Learning",
      description: t('support.bento.learning.desc') || "Sync your Zendesk, Notion, or Help Center. Agents learn your policies in seconds.",
      icon: <ShieldCheck size={24} className="text-blue-500" />,
      color: "blue",
      mockup: (
         <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl flex items-center justify-center">
            {/* Soft grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,dark:bg-[#09090b]_80%,bg-white_80%)] dark:opacity-100 opacity-50"></div>
            
            {/* Center Brain */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
               {/* Pulsing rings */}
               <div className="absolute inset-[-30px] border border-blue-500/30 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
               <div className="absolute inset-[-60px] border border-blue-500/10 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_1s]"></div>
               <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-[15px] animate-pulse"></div>
               
               <div className="relative w-16 h-16 dark:bg-[#09090b] bg-white border border-blue-500/40 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform duration-500 overflow-hidden shrink-0 aspect-square">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent"></div>
                  <Bot size={28} className="text-blue-500 relative z-10 shrink-0" />
               </div>
            </div>

            {/* Document Nodes flying in */}
            {[
               { icon: <FileText size={16} className="text-orange-500" />, label: t('support.bento.learning.mockup.doc1') || "Refund Policy.md", delay: "0s", angle: -35, distance: 140, type: "md" },
               { icon: <FileText size={16} className="text-rose-500" />, label: t('support.bento.learning.mockup.doc2') || "Shipping FAQ.pdf", delay: "0.5s", angle: 35, distance: 150, type: "pdf" },
               { icon: <ShieldCheck size={16} className="text-emerald-500" />, label: t('support.bento.learning.mockup.doc3') || "Zendesk Macros", delay: "1s", angle: 180, distance: 130, type: "zendesk" },
            ].map((doc, idx) => (
               <div key={idx} className="absolute top-1/2 left-1/2 z-20 flex items-center justify-center w-0 h-0" 
                    style={{ transform: `rotate(${doc.angle}deg)` }}>
                  
                  {/* Connecting Line with animated data packet */}
                  <div className="absolute left-0 top-1/2 h-[2px] -z-10 overflow-hidden rounded-full bg-gradient-to-r from-blue-500/50 to-blue-500/10" 
                       style={{ width: `${doc.distance}px`, transform: `translateY(-50%)` }}>
                     <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-transparent via-blue-400 to-transparent opacity-80"
                          style={{ 
                             animation: `travelLeft 2s linear infinite`,
                             animationDelay: doc.delay 
                          }}></div>
                  </div>
                  
                  {/* Doc Icon */}
                  <div className="absolute flex items-center justify-center" 
                       style={{ left: `${doc.distance}px`, transform: `translate(-50%, -50%) rotate(-${doc.angle}deg)` }}>
                     <div className="w-max px-3 py-2 dark:bg-[#0c0c0e] bg-white/90 backdrop-blur-md border dark:border-white/10 border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xl hover:border-blue-500/50 hover:shadow-blue-500/20 transition-all duration-300 relative overflow-hidden group/doc cursor-default">
                        {/* Scanning ingest effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent -translate-x-full group-hover/doc:animate-[support_scan_1.5s_ease-in-out_infinite]" style={{ animationDelay: doc.delay }}></div>
                        
                        <div className="bg-slate-100 dark:bg-white/5 w-8 h-8 rounded-lg z-10 flex items-center justify-center shrink-0 aspect-square">
                           {React.cloneElement(doc.icon as React.ReactElement, { className: `${(doc.icon as React.ReactElement).props.className} shrink-0` })}
                        </div>
                        <span className="text-[11px] font-bold dark:text-white/80 text-slate-700 whitespace-nowrap z-10 pr-2">{doc.label}</span>
                        
                        {/* Status dot */}
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full z-10 shadow-[0_0_8px_rgba(59,130,246,0.8)] border border-white dark:border-[#0c0c0e]"></div>
                     </div>
                  </div>
               </div>
            ))}
            
            <div className="absolute bottom-6 left-0 w-full flex justify-center z-40">
                  <div className="bg-white/90 dark:bg-[#121214]/90 border border-slate-200/80 dark:border-white/10 px-5 py-2.5 rounded-full backdrop-blur-md flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transform hover:-translate-y-1 transition-transform">
                  <div className="w-2 h-2 shrink-0 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
                  <span className="text-[10px] font-bold dark:text-white/90 text-slate-800 uppercase tracking-wider">{t('support.bento.learning.mockup.synced') || 'Knowledge Base Synced'}</span>
               </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes travelLeft {
                0% { transform: translateX(100%); }
                100% { transform: translateX(-200%); }
              }
              @keyframes support_scan {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
              }
            `}} />
         </div>
      )
    },
    {
      title: t('support.bento.insights.title') || "Actionable Insights",
      description: t('support.bento.insights.desc') || "Monitor CSAT, resolution times, and recurring issues. Makinari automatically categorizes ticket topics so you know what product areas need improvement.",
      icon: <Target size={24} className="text-emerald-500" />,
      color: "emerald",
      mockup: (
         <div className="relative w-full h-[400px] dark:bg-[#09090b] bg-white rounded-2xl border dark:border-white/5 border-black/5 overflow-hidden group shadow-2xl flex flex-col p-6">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08)_0%,transparent_60%)] pointer-events-none"></div>
            {/* Soft grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none mix-blend-multiply dark:mix-blend-screen"></div>
            
            <div className="flex gap-4 mb-6 relative z-10">
               <div className="flex-[1.2] bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden group/csat hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)] transition-all duration-300">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/30 rounded-full blur-[25px] group-hover/csat:bg-emerald-500/40 transition-colors"></div>
                  
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                     {t('support.bento.insights.mockup.csat') || 'CSAT Score'}
                  </div>
                  <div className="text-4xl font-black dark:text-white text-slate-900 mb-1.5 drop-shadow-sm">96<span className="text-2xl text-emerald-600/70 dark:text-emerald-400/70">%</span></div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                     <TrendingUp size={10} className="stroke-[3]"/> +2% this week
                  </div>
               </div>
               <div className="flex-[1] dark:bg-[#121214]/80 bg-white/80 backdrop-blur-md border dark:border-white/5 border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-[11px] font-bold dark:text-white/50 text-slate-500 uppercase tracking-widest mb-1.5">{t('support.bento.insights.mockup.deflection') || 'Deflection Rate'}</div>
                  <div className="text-4xl font-black dark:text-white text-slate-900 mb-1.5">72<span className="text-2xl text-slate-400 dark:text-white/30">%</span></div>
                  <div className="text-[10px] dark:text-emerald-400 text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 dark:bg-emerald-500/10 w-fit px-2 py-1 rounded-md">
                     <TrendingUp size={10} /> 1,420 tickets saved
                  </div>
               </div>
            </div>
            
            <div className="flex-1 dark:bg-[#121214]/80 bg-white/80 border dark:border-white/5 border-slate-200/80 rounded-2xl p-6 flex flex-col backdrop-blur-md relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
               <div className="text-[11px] font-bold dark:text-white/80 text-slate-700 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Target size={14} className="text-emerald-500" /> {t('support.bento.insights.mockup.topIssues') || 'Top Issue Categories'}
               </div>
               
               <div className="flex-1 flex flex-col justify-between gap-3">
                  {[
                     { name: t('support.bento.insights.mockup.issue1') || "Billing / Refunds", val: 45, color: "emerald" },
                     { name: t('support.bento.insights.mockup.issue2') || "Login / Access", val: 30, color: "emerald" },
                     { name: t('support.bento.insights.mockup.issue3') || "Feature Request", val: 15, color: "slate" },
                     { name: t('support.bento.insights.mockup.issue4') || "Bug Report", val: 10, color: "slate" }
                  ].map((item, idx) => (
                     <div key={idx} className="w-full group/bar">
                        <div className="flex justify-between text-[11px] mb-1.5 font-bold">
                           <span className="dark:text-white/80 text-slate-700">{item.name}</span>
                           <span className={item.color === 'emerald' ? "text-emerald-600 dark:text-emerald-400" : "dark:text-white/50 text-slate-500"}>{item.val}%</span>
                        </div>
                        <div className="w-full h-2 dark:bg-white/5 bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                           <div className={`h-full ${item.color === 'emerald' ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-white/20'} rounded-full relative group-hover/bar:brightness-110 transition-all duration-300 origin-left animate-[growWidth_1s_ease-out_forwards]`} 
                                style={{ width: `${item.val}%`, animationDelay: `${idx * 0.1}s` }}>
                              {item.color === 'emerald' && (
                                 <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)] animate-[travelRight_2s_linear_infinite]" style={{ animationDelay: `${idx * 0.5}s` }}></div>
                              )}
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
            
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes growWidth {
                0% { transform: scaleX(0); }
                100% { transform: scaleX(1); }
              }
              @keyframes travelRight {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(200%); }
              }
            `}} />
         </div>
      )
    }
  ];

  return (
    <div ref={containerRef} className="py-24 relative overflow-hidden bg-slate-50 dark:bg-[#030303] border-t border-black/5 dark:border-white/[0.04]">
      {/* Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[100px] opacity-30 rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Reveal delay={0} direction="up" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10 dark:text-white/70 text-slate-500 text-xs font-bold uppercase tracking-wider mb-6">
            {t('support.core.badge') || 'Core Capabilities'}
          </Reveal>
          <Reveal delay={100} direction="up" className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
<h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
            {t('support.core.title1') || 'Beyond basic '}<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{t('support.core.title2') || 'chatbots'}</span>
          </h2>
</Reveal>
          <Reveal delay={200} direction="up" className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">
<p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">
            {t('support.core.desc') || 'Our AI agents don\'t just reply with links to articles. They take action, use internal tools, and escalate when necessary.'}
          </p>
</Reveal>
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
                  
                  {/* Decorative line */}
                  <div className="pt-4">
                     <div className="w-12 h-1 bg-gradient-to-r dark:from-white/20 from-black/20 to-transparent rounded-full"></div>
                  </div>
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

export function SupportClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-indigo-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-indigo-500/30 bg-indigo-500/5 text-indigo-500 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
              {t('support.hero.badge') || '24/7 AI Resolution'}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              {t('support.hero.title1') || 'Resolve issues '}<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">{t('support.hero.title2') || 'instantly'}</span> {t('support.hero.title3') || ' with AI'}
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/60 text-slate-600 max-w-2xl font-light leading-relaxed mb-10">
              {t('support.hero.desc') || 'Manage tickets from Web, WhatsApp, and Email with proactive agents. Scale your customer success team without scaling your headcount.'}
            </p>
          </Reveal>
            <Reveal delay={250}>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes scroll-providers {
                  0% { transform: translate3d(0, 0, 0); }
                  100% { transform: translate3d(calc(-100% / 4), 0, 0); }
                }
                .animate-scroll-providers { 
                  animation: scroll-providers 30s linear infinite; 
                  will-change: transform;
                }
              `}} />
              <div className="w-full overflow-hidden mt-8 mb-12 opacity-60 dark:opacity-50 transition-opacity duration-500 hover:opacity-100 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] group">
                <div className="flex w-max animate-scroll-providers gap-16 pr-16 py-4 group-hover:[animation-play-state:paused]">
                  {[1, 2, 3, 4].map((set) => (
                    <React.Fragment key={set}>
                      {SUPPORT_PROVIDERS.map((provider) => (
                        <div key={`${set}-${provider.name}`} className="flex items-center gap-2 grayscale hover:grayscale-0 transition-[filter,transform] duration-300 transform-gpu">
                          <svg viewBox="0 0 24 24" className={`w-6 h-6 fill-current ${provider.iconColor}`} xmlns="http://www.w3.org/2000/svg">
                            {provider.svg}
                          </svg>
                          <span className={`font-bold tracking-tight text-lg ${provider.color}`}>{provider.name}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </Reveal>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-inter font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 group">
                {t('support.hero.cta.start') || 'Start with Makinari'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
                {t('support.hero.cta.explore') || 'Explore all features'}
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
              <div className="relative w-full h-[450px] rounded-xl dark:neu-mockup-screen border border-slate-200/50 dark:border-white/5 bg-slate-100/50 dark:bg-[#050505] p-6 group flex flex-col gap-4 font-inter shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-100 pointer-events-none rounded-xl"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 blur-[60px] rounded-full mix-blend-multiply dark:mix-blend-screen pointer-events-none transition-opacity duration-700 group-hover:opacity-100 opacity-50"></div>
                
                {/* Mockup UI */}
                <div className="flex gap-4 relative z-10">
                  <div className="flex-1 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-white/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                      {t('support.mockup.openTickets') || 'Open Tickets'}
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    </div>
                    <div>
                      <div className="text-3xl font-black dark:text-white text-slate-800 mt-2">124</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full w-fit border border-emerald-100 dark:border-emerald-500/20"><TrendingUp className="w-2.5 h-2.5" /> {t('support.mockup.openTicketsTrend') || '-15% vs last week'}</div>
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-white/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                      {t('support.mockup.avgRes') || 'Avg Resolution'}
                      <Clock size={12} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="text-3xl font-black dark:text-white text-slate-800 mt-2">1.2<span className="text-lg text-slate-400 font-bold ml-0.5">m</span></div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full w-fit border border-emerald-100 dark:border-emerald-500/20"><TrendingUp className="w-2.5 h-2.5" /> {t('support.mockup.avgResTrend') || 'Faster'}</div>
                    </div>
                  </div>
                </div>

                {/* Tickets List */}
                <div className="flex-1 rounded-xl bg-white/80 dark:bg-black/40 backdrop-blur-sm border border-slate-200/60 dark:border-white/5 p-5 relative overflow-hidden flex flex-col gap-3 z-10 dark:neu-panel neu-panel-light shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-[11px] dark:text-white/80 text-slate-700 font-bold tracking-widest uppercase flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm">
                      <MessageSquare size={14} className="text-indigo-500" /> {t('support.mockup.liveQueue') || 'Live Queue'}
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      {t('support.mockup.aiTriage') || 'AI Triage Active'}
                    </div>
                  </div>

                  {/* Ticket Items */}
                  {[
                    { source: t('support.mockup.ticket1.source') || "WhatsApp", user: "Maria G.", issue: t('support.mockup.ticket1.issue') || "Refund Request", status: t('support.mockup.ticket1.status') || "AI Resolving", icon: <MessageSquare size={14} />, time: t('support.mockup.ticket1.time') || "2m ago", avatar: "M" },
                    { source: t('support.mockup.ticket2.source') || "Web Widget", user: "John D.", issue: t('support.mockup.ticket2.issue') || "Login Issue", status: t('support.mockup.ticket2.status') || "AI Resolved", icon: <CheckSquare size={14} />, time: t('support.mockup.ticket2.time') || "15m ago", avatar: "J" },
                    { source: t('support.mockup.ticket3.source') || "Email", user: "Tech Corp", issue: t('support.mockup.ticket3.issue') || "API Documentation", status: t('support.mockup.ticket3.status') || "Escalated to Human", icon: <Mail size={14} />, time: t('support.mockup.ticket3.time') || "1h ago", avatar: "T" }
                  ].map((ticket, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.05] hover:shadow-sm transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${i === 0 ? 'bg-gradient-to-br from-indigo-400 to-indigo-600' : i === 1 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'}`}>
                            {ticket.avatar}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#1e1e1e] shadow-sm ${i === 2 ? 'bg-orange-500 text-white' : i === 1 ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`}>
                            {React.cloneElement(ticket.icon as React.ReactElement<{ className?: string }>, { className: "w-2.5 h-2.5" })}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-bold dark:text-white/90 text-slate-800 flex items-center gap-2">
                            {ticket.user}
                            <span className="text-[10px] font-medium text-slate-400 dark:text-white/40">{ticket.time}</span>
                          </div>
                          <div className="text-xs dark:text-white/50 text-slate-500 mt-0.5 font-medium">{ticket.source} <span className="text-slate-300 dark:text-slate-600 mx-1">•</span> {ticket.issue}</div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className={`text-[10px] px-3 py-1.5 rounded-full font-inter font-bold tracking-wide uppercase shadow-sm ${i === 2 ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20' : i === 1 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20'}`}>
                          {ticket.status}
                        </span>
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
              <h2 className="text-4xl md:text-5xl font-bold dark:text-white text-slate-900 mb-6 tracking-tight">
                Omnichannel triage
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 leading-relaxed mb-8">
                {t('support.features.triage.desc') || 'Connect all your customer touchpoints into one central hub. Makinari’s AI automatically reads, categorizes, and replies to support requests across platforms in real-time.'}
              </p>
              <ul className="space-y-4">
                {[
                  { name: t('support.features.triage.item1.name') || "Web Chat", icon: <MessageSquare size={18} className="text-indigo-500 dark:text-indigo-400" />, desc: t('support.features.triage.item1.desc') || "Deploy a smart widget on your site that can fetch orders and resolve FAQs." },
                  { name: t('support.features.triage.item2.name') || "WhatsApp integration", icon: <Phone size={18} className="text-indigo-500 dark:text-indigo-400" />, desc: t('support.features.triage.item2.desc') || "Bring support natively to your customer's favorite messaging app." },
                  { name: t('support.features.triage.item3.name') || "Email Ticketing", icon: <Mail size={18} className="text-indigo-500 dark:text-indigo-400" />, desc: t('support.features.triage.item3.desc') || "Turn incoming emails into actionable tickets parsed by AI." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-600 font-medium group bg-white dark:bg-transparent p-3 -ml-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border border-slate-200 dark:border-white/5 bg-indigo-50/50 dark:bg-indigo-500/5 flex items-center justify-center mr-4 flex-shrink-0 group-hover:border-indigo-300 dark:group-hover:border-indigo-500/30 transition-colors shadow-sm">
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 dark:text-white text-slate-800 font-bold mb-1">
                        {item.name}
                      </div>
                      <p className="text-sm dark:text-white/60 text-slate-500 leading-relaxed">
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

      <SupportBentoFeatures />

      {/* Agents Section */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <OpenClawCard />
      </section>

      <SiteFooter />
    </div>
  )
}
