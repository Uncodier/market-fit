"use client"

import React, { useRef } from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion"
import { Target, TrendingUp, Clock, Zap, CheckSquare, MessageSquare, Mail, Phone, Users, ShieldCheck, FileText, ArrowRight } from "@/app/components/ui/icons"
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

export function SupportClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-indigo-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-24 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Reveal delay={0}>
            <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 border border-indigo-500/30 bg-indigo-500/5 text-indigo-500 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>
              24/7 AI Resolution
            </div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg max-w-4xl">
              Resolve issues <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">instantly</span> with AI
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="text-lg md:text-xl dark:text-white/60 text-slate-600 max-w-2xl font-light leading-relaxed mb-10">
              Manage tickets from Web, WhatsApp, and Email with proactive agents. Scale your customer success team without scaling your headcount.
            </p>
          </Reveal>
            <Reveal delay={250}>
              <div className="flex flex-wrap items-center justify-center gap-8 mb-12 opacity-50 dark:opacity-40 max-w-3xl mx-auto">
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#03363D] dark:text-white" xmlns="http://www.w3.org/2000/svg"><path d="M12.0007 0C5.37255 0 0 5.37255 0 12.0007C0 18.6274 5.37255 24 12.0007 24C18.6274 24 24 18.6274 24 12.0007C24 5.37255 18.6274 0 12.0007 0ZM19.2312 17.5513L15.3949 11.0478L19.2458 5.79815H17.2917L14.2492 9.9405L11.751 5.79815H7.50215L11.1278 11.7946L7.50215 17.5513H9.4548L12.6718 13.1843L15.3263 17.5513H19.2312Z"/></svg>
                  <span className="font-bold tracking-tight text-[#03363D] dark:text-white text-lg">Zendesk</span>
                </div>
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#000000] dark:text-white" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm0 18.25c-3.453 0-6.25-2.797-6.25-6.25S8.547 5.75 12 5.75s6.25 2.797 6.25 6.25-2.797 6.25-6.25 6.25z"/></svg>
                  <span className="font-bold tracking-tight text-black dark:text-white text-lg">Intercom</span>
                </div>
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#F9A825]" xmlns="http://www.w3.org/2000/svg"><path d="M11.967 1.25l7.567 4.364v8.72l-7.567 4.363-7.567-4.363v-8.72l7.567-4.364zM11.967 0L3.4 4.93v9.86l8.567 4.93 8.566-4.93V4.93L11.967 0z"/></svg>
                  <span className="font-bold tracking-tight text-[#F9A825] text-lg">Front</span>
                </div>
                 <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#22D3EE]" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.222-.548.222l.188-3.03 5.517-4.98c.24-.214-.052-.334-.373-.122l-6.817 4.29-2.936-.918c-.636-.202-.647-.638.134-.945l11.47-4.426c.531-.194 1.002.13.865.937z"/></svg>
                  <span className="font-bold tracking-tight text-[#22D3EE] text-lg">Telegram</span>
                </div>
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#25D366]" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  <span className="font-bold tracking-tight text-[#25D366] text-lg">WhatsApp</span>
                </div>
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#4A154B] dark:text-[#E01E5A]" xmlns="http://www.w3.org/2000/svg"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                  <span className="font-bold tracking-tight text-[#4A154B] dark:text-[#E01E5A] text-lg">Slack</span>
                </div>
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#000000] dark:text-[#FFFFFF]" xmlns="http://www.w3.org/2000/svg"><path d="M4.459 4.208c-.742.286-1.544-.22-1.544-1.011 0-.41.229-.79.593-.984L10.076.046c.552-.294 1.208-.294 1.76 0l11.082 5.922c.683.365.733 1.343.082 1.768L22.25 8.16l-3.351-1.742-5.756 2.924c-1.397.71-3.085.71-4.482 0l-4.202-2.134zm-2.915 2.502v10.643c0 .641.347 1.233.91 1.536l8.868 4.776c.54.29 1.18.29 1.72 0l8.775-4.726c.582-.313.945-.92.945-1.583V8.815l-1.921 1.006c-.687.36-1.517.36-2.204 0l-6.848-3.585-3.344 1.698c-1.077.548-2.38.548-3.458 0l-5.364-2.724z"/></svg>
                  <span className="font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF] text-lg">Notion</span>
                </div>
                <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#0052CC]" xmlns="http://www.w3.org/2000/svg"><path d="M11.53 2c0 2.4-1.97 4.35-4.35 4.35h-4.9v4.9c0 2.4 1.95 4.35 4.35 4.35 2.4 0 4.35-1.95 4.35-4.35V2zm6.12 10.65c-2.4 0-4.35 1.95-4.35 4.35v4.9h4.9c2.4 0 4.35-1.95 4.35-4.35 0-2.4-1.95-4.35-4.35-4.35v-4.9zm-6.12 0c0 2.4-1.95 4.35-4.35 4.35h-4.9v-4.9c0-2.4 1.95-4.35 4.35-4.35 2.4 0 4.35 1.95 4.35 4.35v4.9z"/></svg>
                  <span className="font-bold tracking-tight text-[#0052CC] text-lg">Jira</span>
                </div>
              </div>
            </Reveal>
            <div className="flex gap-16 overflow-hidden mt-8 opacity-70">
              <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#F9A825]" xmlns="http://www.w3.org/2000/svg"><path d="M11.967 1.25l7.567 4.364v8.72l-7.567 4.363-7.567-4.363v-8.72l7.567-4.364zM11.967 0L3.4 4.93v9.86l8.567 4.93 8.566-4.93V4.93L11.967 0z"/></svg>
                <span className="font-bold tracking-tight text-[#F9A825] text-lg">Front</span>
              </div>
               <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#22D3EE]" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.222-.548.222l.188-3.03 5.517-4.98c.24-.214-.052-.334-.373-.122l-6.817 4.29-2.936-.918c-.636-.202-.647-.638.134-.945l11.47-4.426c.531-.194 1.002.13.865.937z"/></svg>
                <span className="font-bold tracking-tight text-[#22D3EE] text-lg">Telegram</span>
              </div>
              <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-[#25D366]" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                <span className="font-bold tracking-tight text-[#25D366] text-lg">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#4A154B] dark:text-[#E01E5A]" xmlns="http://www.w3.org/2000/svg"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                <span className="font-bold tracking-tight text-[#4A154B] dark:text-[#E01E5A] text-lg">Slack</span>
              </div>
              <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#000000] dark:text-[#FFFFFF]" xmlns="http://www.w3.org/2000/svg"><path d="M4.459 4.208c-.742.286-1.544-.22-1.544-1.011 0-.41.229-.79.593-.984L10.076.046c.552-.294 1.208-.294 1.76 0l11.082 5.922c.683.365.733 1.343.082 1.768L22.25 8.16l-3.351-1.742-5.756 2.924c-1.397.71-3.085.71-4.482 0l-4.202-2.134zm-2.915 2.502v10.643c0 .641.347 1.233.91 1.536l8.868 4.776c.54.29 1.18.29 1.72 0l8.775-4.726c.582-.313.945-.92.945-1.583V8.815l-1.921 1.006c-.687.36-1.517.36-2.204 0l-6.848-3.585-3.344 1.698c-1.077.548-2.38.548-3.458 0l-5.364-2.724z"/></svg>
                <span className="font-bold tracking-tight text-[#000000] dark:text-[#FFFFFF] text-lg">Notion</span>
              </div>
              <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-[#0052CC]" xmlns="http://www.w3.org/2000/svg"><path d="M11.53 2c0 2.4-1.97 4.35-4.35 4.35h-4.9v4.9c0 2.4 1.95 4.35 4.35 4.35 2.4 0 4.35-1.95 4.35-4.35V2zm6.12 10.65c-2.4 0-4.35 1.95-4.35 4.35v4.9h4.9c2.4 0 4.35-1.95 4.35-4.35 0-2.4-1.95-4.35-4.35-4.35v-4.9zm-6.12 0c0 2.4-1.95 4.35-4.35 4.35h-4.9v-4.9c0-2.4 1.95-4.35 4.35-4.35 2.4 0 4.35 1.95 4.35 4.35v4.9z"/></svg>
                <span className="font-bold tracking-tight text-[#0052CC] text-lg">Jira</span>
              </div>
            </div>
          <Reveal delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] flex items-center justify-center gap-2 group">
                Start for free
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 font-bold transition-colors border dark:border-white/10 border-black/10 text-center">
                Explore features
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
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-xl"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/20 blur-[60px] rounded-full mix-blend-multiply dark:mix-blend-screen pointer-events-none transition-opacity duration-700 group-hover:opacity-100 opacity-50"></div>
                
                {/* Mockup UI */}
                <div className="flex gap-4 relative z-10">
                  <div className="flex-1 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-white/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                      Open Tickets
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    </div>
                    <div>
                      <div className="text-3xl font-black dark:text-white text-slate-800 mt-2">124</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full w-fit border border-emerald-100 dark:border-emerald-500/20"><TrendingUp className="w-2.5 h-2.5" /> -15% vs last week</div>
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl bg-white dark:bg-black/40 border border-slate-200/60 dark:border-white/5 p-4 relative overflow-hidden dark:neu-panel neu-panel-light shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div className="text-[10px] dark:text-white/50 text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                      Avg Resolution
                      <Clock size={12} className="text-slate-400" />
                    </div>
                    <div>
                      <div className="text-3xl font-black dark:text-white text-slate-800 mt-2">1.2<span className="text-lg text-slate-400 font-bold ml-0.5">m</span></div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full w-fit border border-emerald-100 dark:border-emerald-500/20"><TrendingUp className="w-2.5 h-2.5" /> Faster</div>
                    </div>
                  </div>
                </div>

                {/* Tickets List */}
                <div className="flex-1 rounded-xl bg-white/80 dark:bg-black/40 backdrop-blur-sm border border-slate-200/60 dark:border-white/5 p-5 relative overflow-hidden flex flex-col gap-3 z-10 dark:neu-panel neu-panel-light shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-[11px] dark:text-white/80 text-slate-700 font-bold tracking-widest uppercase flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/5 shadow-sm">
                      <MessageSquare size={14} className="text-indigo-500" /> Live Queue
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                      AI Triage Active
                    </div>
                  </div>

                  {/* Ticket Items */}
                  {[
                    { source: "WhatsApp", user: "Maria G.", issue: "Refund Request", status: "AI Resolving", icon: <MessageSquare size={14} />, time: "2m ago", avatar: "M" },
                    { source: "Web Widget", user: "John D.", issue: "Login Issue", status: "AI Resolved", icon: <CheckSquare size={14} />, time: "15m ago", avatar: "J" },
                    { source: "Email", user: "Tech Corp", issue: "API Documentation", status: "Escalated to Human", icon: <Mail size={14} />, time: "1h ago", avatar: "T" }
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
                        <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold tracking-wide uppercase shadow-sm ${i === 2 ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20' : i === 1 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20'}`}>
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
                Connect all your customer touchpoints into one central hub. Makinari’s AI automatically reads, categorizes, and replies to support requests across platforms in real-time.
              </p>
              <ul className="space-y-4">
                {[
                  { name: "Web Chat", icon: <MessageSquare size={18} className="text-indigo-500 dark:text-indigo-400" />, desc: "Deploy a smart widget on your site that can fetch orders and resolve FAQs." },
                  { name: "WhatsApp integration", icon: <Phone size={18} className="text-indigo-500 dark:text-indigo-400" />, desc: "Bring support natively to your customer's favorite messaging app." },
                  { name: "Email Ticketing", icon: <Mail size={18} className="text-indigo-500 dark:text-indigo-400" />, desc: "Turn incoming emails into actionable tickets parsed by AI." }
                ].map((item, i) => (
                  <li key={i} className="flex items-start dark:text-white/80 text-slate-600 font-medium group bg-white dark:bg-transparent p-3 -ml-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                    <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light flex items-center justify-center mr-4 flex-shrink-0 border border-slate-200 dark:border-white/5 group-hover:border-indigo-300 dark:group-hover:border-indigo-500/30 transition-colors bg-indigo-50/50 dark:bg-indigo-500/5 shadow-sm">
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

            {/* Bento Grid Layout for Support features */}
      <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <Reveal delay={0}>
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
                Beyond basic <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">chatbots</span>
              </h2>
              <p className="text-lg dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
                Our AI agents don't just reply with links to articles. They take action, use internal tools, and escalate when necessary.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(300px,auto)]">
            
            {/* Bento 1: Actionable Agents */}
            <Reveal delay={100} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/5 border-slate-200/60 overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1 hover:shadow-xl shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity duration-700"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-14 h-14 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-8 shadow-sm border border-indigo-100 dark:border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Zap size={28} />
                  </div>
                  <h3 className="text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">Action-driven Resolution</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed text-lg">
                    Grant agents access to your database or APIs. They can process refunds, update shipping addresses, cancel subscriptions, and solve tier-1 issues completely autonomously.
                  </p>
                </div>
                {/* Floating element representation */}
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-60 dark:opacity-30 pointer-events-none flex items-end justify-end p-4">
                  <div className="w-56 bg-white dark:bg-[#0a0a0c] border border-slate-200 dark:border-white/5 rounded-xl shadow-2xl p-4 transform translate-y-6 group-hover:-translate-y-2 transition-transform duration-700 ease-out">
                     <div className="flex items-center gap-3 mb-3">
                       <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                       <span className="text-xs font-bold text-slate-700 dark:text-white/80">API Success</span>
                     </div>
                     <div className="text-[10px] text-slate-500 dark:text-white/50 font-mono bg-slate-50 dark:bg-black/50 p-2 rounded-lg border border-slate-100 dark:border-white/5">POST /v1/refunds</div>
                     <div className="mt-3 h-2 w-full bg-emerald-100 dark:bg-emerald-500/20 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-full animate-[pulse_2s_ease-in-out_infinite]"></div>
                     </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Bento 2: Human Escalation */}
            <Reveal delay={200} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/5 border-slate-200/60 overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1 hover:shadow-xl shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-bl from-purple-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity duration-700"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-8 shadow-sm border border-purple-100 dark:border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Users size={28} />
                  </div>
                  <h3 className="text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">Seamless Handoff</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed text-lg">
                    When sentiment drops or issues become complex, AI instantly routes the conversation to a human rep along with a full summary.
                  </p>
                </div>
                {/* Visual representation of handoff */}
                <div className="absolute right-0 top-0 w-full h-full opacity-60 dark:opacity-30 pointer-events-none flex items-start justify-end p-8">
                   <div className="w-24 h-24 border-2 border-dashed border-purple-300 dark:border-purple-500/50 rounded-full flex items-center justify-center relative mt-4 group-hover:scale-110 transition-transform duration-700 bg-white/50 dark:bg-transparent backdrop-blur-sm">
                      <div className="absolute -top-4 -left-4 w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-full flex items-center justify-center text-indigo-500 shadow-md group-hover:-translate-x-2 group-hover:-translate-y-2 transition-transform duration-500"><Zap size={16} /></div>
                      <svg className="w-10 h-10 text-purple-400 dark:text-purple-500/50 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                      <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-purple-100 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30 rounded-full flex items-center justify-center text-purple-500 shadow-md group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-500"><Users size={16} /></div>
                   </div>
                </div>
              </div>
            </Reveal>

            {/* Bento 3: Knowledge Base */}
            <Reveal delay={300} className="md:col-span-1 h-full">
              <div className="w-full h-full rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/5 border-slate-200/60 overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1 hover:shadow-xl shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity duration-700"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-8 shadow-sm border border-blue-100 dark:border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                    <ShieldCheck size={28} />
                  </div>
                  <h3 className="text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">Instant Learning</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed text-lg">
                    Sync your Zendesk, Notion, or Help Center. Agents learn your policies in seconds.
                  </p>
                </div>
                 {/* Visual representation of docs */}
                 <div className="absolute right-0 bottom-0 w-full h-full opacity-60 dark:opacity-30 pointer-events-none flex items-end justify-end p-4">
                    <div className="flex flex-col gap-4 transform translate-x-4 translate-y-4 group-hover:-translate-x-2 group-hover:-translate-y-2 transition-transform duration-700 ease-out">
                       <div className="w-48 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-blue-500"><ShieldCheck size={14} /></div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                            <div className="h-1 w-2/3 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                          </div>
                       </div>
                       <div className="w-40 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 ml-8">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-indigo-500"><FileText size={14} /></div>
                          <div className="flex flex-col gap-1.5 flex-1">
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                            <div className="h-1 w-1/2 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            </Reveal>

            {/* Bento 4: CS Metrics */}
            <Reveal delay={400} className="md:col-span-2 h-full">
              <div className="w-full h-full rounded-2xl dark:bg-[#0a0a0c] bg-white border dark:border-white/5 border-slate-200/60 overflow-hidden relative group p-8 flex flex-col justify-center transition-all duration-500 hover:-translate-y-1 hover:shadow-xl shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-bl from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[60px] pointer-events-none group-hover:opacity-100 opacity-0 transition-opacity duration-700"></div>
                <div className="relative z-10 max-w-md">
                  <div className="w-14 h-14 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-8 shadow-sm border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                    <Target size={28} />
                  </div>
                  <h3 className="text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">Actionable Insights</h3>
                  <p className="dark:text-white/60 text-slate-600 leading-relaxed text-lg">
                    Monitor CSAT, resolution times, and recurring issues. Makinari automatically categorizes ticket topics so you know what product areas need improvement.
                  </p>
                </div>
                
                {/* Metric visual */}
                <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-60 dark:opacity-30 pointer-events-none flex items-center justify-center p-4">
                   <div className="w-36 h-36 rounded-full border-[8px] border-slate-200 dark:border-slate-800 relative flex items-center justify-center group-hover:scale-110 transition-transform duration-700 ease-out shadow-2xl">
                      <div className="absolute inset-0 rounded-full border-[8px] border-emerald-500 border-t-transparent border-r-transparent transform -rotate-[60deg] transition-transform duration-1000 group-hover:-rotate-45"></div>
                      <div className="text-center z-10 bg-white dark:bg-black/90 rounded-full w-28 h-28 flex flex-col items-center justify-center backdrop-blur-md shadow-sm border border-slate-100 dark:border-white/10">
                         <div className="text-4xl font-black text-slate-800 dark:text-white leading-none">98<span className="text-xl text-slate-400 font-bold">%</span></div>
                         <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5">CSAT</div>
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
