"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalization } from "@/app/context/LocalizationContext";
import Link from "next/link";

const getTabs = (t: (key: string) => string) => [
  { id: "crm", label: t('mockupslider.tab.crm') || "CRM" },
  { id: "control-center", label: t('mockupslider.tab.control') || "Control Center" },
  { id: "dashboard", label: t('mockupslider.tab.reports') || "Reports" },
  { id: "chat", label: t('mockupslider.tab.inbox') || "Omni Inbox" },
  { id: "agents", label: t('mockupslider.tab.agents') || "AI Agents" },
  { id: "goals", label: t('mockupslider.tab.goals') || "AI Goals" },
];

const AUTO_ADVANCE_MS = 5000;

export function MockupSlider() {
  const { t } = useLocalization();
  const tabs = getTabs(t);
  
  const sliderContent = [
    {
      title: t('mockupslider.desc.crm.title') || "Data always up-to-date",
      desc: t('mockupslider.desc.crm.text') || "A CRM built from the ground up for AI agents to work autonomously, capturing data and updating records seamlessly without human intervention.",
      link: "/product/crm"
    },
    {
      title: t('mockupslider.desc.control.title') || "Supervise your virtual team",
      desc: t('mockupslider.desc.control.text') || "Monitor and orchestrate all your virtual employees from a single dashboard. Track tasks, view real-time logs, and intervene when necessary.",
      link: "/product/support"
    },
    {
      title: t('mockupslider.desc.reports.title') || "Data-driven decisions",
      desc: t('mockupslider.desc.reports.text') || "Get actionable insights with AI-generated reports on your revenue pipeline, automatically delivered to stakeholders exactly when needed.",
      link: "/product/reporting"
    },
    {
      title: t('mockupslider.desc.inbox.title') || "Unified communications",
      desc: t('mockupslider.desc.inbox.text') || "All your channels in one place. Your AI agents engage across email, WhatsApp, and social media, escalating qualified leads to human sales reps.",
      link: "/product/inbound"
    },
    {
      title: t('mockupslider.desc.agents.title') || "End-to-end automation",
      desc: t('mockupslider.desc.agents.text') || "Deploy specialized AI agents that execute complex multi-step workflows. They can navigate web apps, fill forms, and take action like a real employee.",
      link: "/product/agents"
    },
    {
      title: t('mockupslider.desc.goals.title') || "Outcome-based management",
      desc: t('mockupslider.desc.goals.text') || "Define high-level objectives and let the AI figure out the execution steps. It automatically prioritizes tasks based on impact and urgency.",
      link: "/product/openclaw"
    }
  ];
  
  const [activeMockup, setActiveMockup] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [timerProgress, setTimerProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const advanceToNext = useCallback(() => {
    setActiveMockup((prev) => (prev + 1) % tabs.length);
    setTimerProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (isHovering) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      intervalRef.current = null;
      progressIntervalRef.current = null;
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(100, (elapsed / AUTO_ADVANCE_MS) * 100);
      setTimerProgress(progress);
    }, 50);

    intervalRef.current = setInterval(() => {
      advanceToNext();
    }, AUTO_ADVANCE_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [activeMockup, isHovering, advanceToNext]);

  const handleTabClick = (i: number) => {
    setActiveMockup(i);
    setTimerProgress(0);
    startTimeRef.current = Date.now();
  };

  return (
    <div
      className="w-full flex flex-col items-center"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        startTimeRef.current = Date.now();
        setTimerProgress(0);
      }}
    >
      {/* Tab Selector */}
      <div className="w-[calc(100vw-2rem)] md:w-auto overflow-x-auto scrollbar-hide flex items-center justify-start md:justify-center gap-1.5 md:gap-2 mb-8 neu-pressed-light dark:neu-pressed p-1.5 rounded-2xl md:rounded-full font-sans relative snap-x mx-auto">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(i)}
            className={`relative whitespace-nowrap px-4 md:px-5 py-2 rounded-xl md:rounded-full font-sans text-sm font-medium transition-all duration-300 overflow-hidden snap-center shrink-0 ${
              activeMockup === i
                ? "neu-button-light dark:neu-button text-slate-900 dark:text-white"
                : "text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {activeMockup === i && !isHovering && (
              <span
                className="absolute inset-0 pointer-events-none rounded-full font-sans opacity-40"
                aria-hidden
                style={{
                  background: `conic-gradient(from -90deg, rgba(139,92,246,0.8) 0deg, rgba(139,92,246,0.8) ${timerProgress * 3.6}deg, transparent ${timerProgress * 3.6}deg)`,
                }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Mockup Container */}
      <div className="relative w-full max-w-5xl mx-auto h-[450px] md:h-[600px] group/card perspective-[1000px] font-sans">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMockup}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full"
          >
            {activeMockup === 0 && <CrmMockup t={t} />}
            {activeMockup === 1 && <ControlCenterMockup t={t} />}
            {activeMockup === 2 && <DashboardMockup t={t} />}
            {activeMockup === 3 && <ChatMockup t={t} />}
            {activeMockup === 4 && <AgentsMockup t={t} />}
            {activeMockup === 5 && <GoalsMockup t={t} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Explanatory Text and Link */}
      <div className="mt-8 md:mt-12 w-full max-w-2xl mx-auto text-center px-4 relative h-32 md:h-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMockup}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center"
          >
            <h3 className="text-xl md:text-2xl font-bold dark:text-white text-slate-900 mb-2">
              {sliderContent[activeMockup].title}
            </h3>
            <p className="text-sm md:text-base text-slate-500 dark:text-white/60 mb-4 line-clamp-2">
              {sliderContent[activeMockup].desc}
            </p>
            <Link 
              href={sliderContent[activeMockup].link}
              className="inline-flex items-center gap-2 rounded-full font-sans dark:neu-button neu-button-light px-6 py-2 font-semibold text-xs md:text-sm transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              {t('mockupslider.learnMore') || 'Learn more'}
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}

function CrmMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 transition-all duration-700 ease-out hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl dark:neu-mockup-screen neu-mockup-screen-light flex text-left overflow-hidden">
        {/* Border Overlay to ensure crisp rounded edges over children */}
        <div className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.05),transparent_50%)] transition-colors pointer-events-none"></div>
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.1)_8px,rgba(139,92,246,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.05)_8px,rgba(139,92,246,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
      {/* Sidebar */}
      <div className="hidden md:flex w-16 md:w-64 border-r border-black/5 dark:border-white/5 bg-gradient-to-b dark:from-white/[0.03] from-black/[0.03] to-transparent flex-col relative shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        <div className="h-16 border-b border-black/5 dark:border-white/5 flex items-center justify-center md:justify-start md:px-6">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_15px_rgba(139,92,246,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)]"></div>
          <div className="hidden md:block ml-3 h-4 w-24 dark:neu-skeleton neu-skeleton-light rounded"></div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`h-10 rounded-md flex items-center justify-center md:justify-start md:px-3 transition-all duration-300 animate-fade-in-up ${
                i === 1
                  ? "bg-violet-500/10 border border-violet-500/20 shadow-[inset_0_0_10px_rgba(139,92,246,0.1)]"
                  : "hover:bg-black/5 dark:hover:bg-white/5 hover:translate-x-1 cursor-pointer"
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className={`w-5 h-5 rounded ${
                  i === 1
                    ? "bg-violet-400/80 shadow-[0_0_10px_rgba(167,139,250,0.5)]"
                    : "dark:neu-skeleton neu-skeleton-light"
                }`}
              ></div>
              <div
                className={`hidden md:block ml-3 h-2.5 w-20 rounded ${
                  i === 1 ? "bg-violet-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]" : "dark:neu-skeleton neu-skeleton-light opacity-70"
                }`}
              ></div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-b dark:from-white/[0.01] from-black/[0.01] to-transparent">
        {/* Topbar */}
        <div className="h-16 border-b border-black/5 dark:border-white/5 dark:bg-white/[0.01] bg-black/[0.01] flex items-center justify-between px-6 backdrop-blur-md">
          <div className="hidden md:flex items-center w-64 h-9 neu-pressed-light dark:neu-pressed rounded-full font-sans px-3">
            <svg
              className="w-4 h-4 text-slate-500 dark:text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <div className="ml-2 h-2 w-16 dark:neu-skeleton neu-skeleton-light rounded"></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-black/5 dark:bg-white/5 flex items-center justify-center border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer">
              <div className="w-3 h-3 bg-black/30 dark:bg-white/30 rounded-full"></div>
            </div>
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-gradient-to-tr from-indigo-500 to-purple-500 border border-black/10 dark:border-white/10 shadow-[0_0_15px_rgba(99,102,241,0.4),inset_0_1px_1px_rgba(255,255,255,0.4)] cursor-pointer hover:scale-105 transition-transform"></div>
          </div>
        </div>

        {/* Kanban Grid */}
        <div className="flex-1 p-6 overflow-hidden flex gap-6 z-10 w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide">
          {[
            {
              title: t('mockupslider.crm.newLeads') || "New Leads",
              count: 24,
              color: "bg-blue-400",
              shadowColor: "rgba(96,165,250,0.5)",
            },
            {
              title: t('mockupslider.crm.engaged') || "Engaged by AI",
              count: 12,
              color: "bg-violet-400",
              active: true,
              shadowColor: "rgba(167,139,250,0.5)",
            },
            {
              title: t('mockupslider.crm.meeting') || "Meeting Booked",
              count: 5,
              color: "bg-emerald-400",
              shadowColor: "rgba(52,211,153,0.5)",
            },
          ].map((col, idx) => (
            <div key={idx} className="flex-1 flex flex-col gap-4 min-w-[260px] md:min-w-[220px] snap-center shrink-0 animate-fade-in-up" style={{ animationDelay: `${200 + idx * 150}ms` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full font-sans ${col.color} shadow-[0_0_8px_${col.shadowColor}]`}
                  ></div>
                  <div className="text-sm font-medium text-slate-500 dark:text-white/80">
                    {col.title}
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-500 dark:text-white/40 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full font-sans border border-black/5 dark:border-white/5">
                  {col.count}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {[...Array(col.active ? 3 : 2)].map((_, i) => (
                  <div
                    key={i}
                    className="dark:neu-card neu-card-light dark:neu-card neu-card-light-hover rounded-md p-4 cursor-pointer group/card relative overflow-hidden animate-fade-in-up"
                      <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
                    style={{ animationDelay: `${300 + idx * 150 + i * 100}ms` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr dark:from-white/0 from-black/0 dark:via-white/[0.02] via-black/[0.02] dark:to-white/0 to-black/0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                    {col.active && i === 0 && (
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-500 to-fuchsia-500 animate-pulse shadow-[0_0_10px_rgba(139,92,246,0.8)]"></div>
                    )}
                    <div className="h-3 w-3/4 dark:neu-skeleton neu-skeleton-light rounded mb-3"></div>
                    <div className="h-2 w-1/2 dark:neu-skeleton neu-skeleton-light opacity-70 rounded mb-4"></div>
                    <div className="flex justify-between items-center mt-4 relative z-10">
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 rounded-full font-sans dark:bg-zinc-800 bg-zinc-200 border-2 border-white dark:border-[#09090b] shadow-sm"></div>
                        {col.active && (
                          <div className="w-7 h-7 rounded-full font-sans font-bold bg-gradient-to-br from-violet-500 to-fuchsia-600 border-2 border-[#09090b] flex items-center justify-center text-[9px] font-bold shadow-[0_0_10px_rgba(139,92,246,0.6)] z-10">
                            AI
                          </div>
                        )}
                      </div>
                      <div
                        className={`h-5 px-2 rounded-md flex items-center text-[10px] font-medium transition-colors ${
                          col.active
                            ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.2)]"
                            : "bg-black/5 dark:bg-white/5 text-slate-500 dark:text-white/40 border border-black/5 dark:border-white/5 group-hover/card:border-black/10 dark:border-white/10"
                        }`}
                      >
                        {col.active ? (t('mockupslider.crm.active') || "Active") : (t('mockupslider.crm.pending') || "Pending")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
      {/* Floating Badges */}
      <div className="overflow-hidden relative absolute -right-4 md:-right-8 top-1/3 w-56 rounded-lg neu-panel-light dark:neu-panel p-4 animate-float-slow hidden md:block transition-all duration-500 group-hover/card:-translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(16,185,129,0.15)] z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full font-sans font-bold bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0">
            <svg
              className="w-5 h-5 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">
              {t('mockupslider.crm.meetingBooked') || "Meeting Booked"}
            </div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-tight">
              {t('mockupslider.crm.agentClosed') || "AI Agent closed the deal automatically"}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden relative absolute -left-4 md:-left-8 bottom-1/4 w-48 rounded-lg neu-panel-light dark:neu-panel p-3 animate-float-medium hidden md:block transition-all duration-500 group-hover/card:translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(139,92,246,0.15)] delay-100 z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full font-sans font-bold bg-violet-500 animate-pulse shadow-[0_0_12px_rgba(139,92,246,1)]"></div>
          <div className="text-xs font-medium text-slate-500 dark:text-white/80 tracking-wide">
            {t('mockupslider.crm.agentTyping') || "Agent typing..."}
          </div>
        </div>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}

function ControlCenterMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 transition-all duration-700 ease-out hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl dark:neu-mockup-screen neu-mockup-screen-light flex flex-col text-left overflow-hidden">
        {/* Border Overlay to ensure crisp rounded edges over children */}
        <div className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_50%)] transition-colors pointer-events-none"></div>
        <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(6,182,212,0.1)_10px,rgba(6,182,212,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
      {/* Topbar */}
      <div className="h-16 border-b border-black/5 dark:border-white/5 dark:bg-white/[0.01] bg-black/[0.01] flex items-center justify-between px-6 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-white/50">
            <span>{t('mockupslider.tab.control') || "Control Center"}</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white">TSK-8942</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full font-sans font-bold bg-cyan-500/10 border border-cyan-500/20">
            <div className="w-2 h-2 rounded-full font-sans font-bold bg-cyan-500 animate-pulse"></div>
            <span className="text-xs font-medium text-cyan-400">{t('mockupslider.control.inProgress') || "In Progress"}</span>
          </div>
        </div>
      </div>

      {/* Tabs and Content */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b dark:from-white/[0.01] from-black/[0.01] to-transparent flex justify-center p-4 md:p-6 scrollbar-hide">
        <div className="w-full max-w-2xl flex flex-col gap-4 md:gap-6 pb-6">
          
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-black/5 dark:border-white/5 pb-2 shrink-0">
            <div className="text-sm font-medium text-cyan-400 border-b-2 border-cyan-400 pb-2 -mb-[9px] px-1">{t('mockupslider.control.timeline') || "Timeline"}</div>
            <div className="text-sm font-medium text-slate-500 dark:text-white/50 pb-2 -mb-[9px] px-1">{t('mockupslider.control.details') || "Details"}</div>
          </div>

          {/* Comment Input */}
          <div className="overflow-hidden relative rounded-md neu-panel-light dark:neu-panel p-4 flex flex-col gap-3 animate-fade-in-up shrink-0" style={{ animationDelay: '100ms' }}>
            <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
            <div className="h-20 w-full rounded-md dark:neu-recessed neu-recessed-light p-3 text-sm text-slate-500 dark:text-white/40">
              {t('mockupslider.control.writeUpdate') || "Write an update or comment..."}
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-md bg-black/5 dark:bg-white/5 flex items-center justify-center text-slate-500 dark:text-white/50 cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </div>
              </div>
              <div className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-md cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                {t('mockupslider.control.postUpdate') || "Post Update"}
              </div>
            </div>
          </div>

          {/* Timeline Items */}
          <div className="flex flex-col gap-4">
            {[
              { author: "AI Agent", isAI: true, time: t('mockupslider.control.time1') || "Just now", content: t('mockupslider.control.msg1') || "I have successfully analyzed the data chunk and updated the relevant database tables. The synchronization is now 65% complete.", file: null },
              { author: "Sarah Jenkins", isAI: false, time: t('mockupslider.control.time2') || "2 hours ago", content: t('mockupslider.control.msg2') || "Can you provide a summary of the anomalies found so far?", file: null },
              { author: "AI Agent", isAI: true, time: t('mockupslider.control.time3') || "3 hours ago", content: t('mockupslider.control.msg3') || "Initial data extraction completed. Found 124 records with missing identifiers.", file: "anomaly_report.csv" }
            ].map((item, i) => (
              <div key={i} className="overflow-hidden relative rounded-md dark:neu-card neu-card-light p-4 flex gap-4 animate-fade-in-up hover:dark:bg-white/[0.03] bg-black/5 transition-colors" style={{ animationDelay: `${200 + i * 150}ms` }}>
                <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
                <div className={`w-10 h-10 rounded-full font-sans flex items-center justify-center text-xs font-bold shrink-0 ${item.isAI ? 'bg-gradient-to-br from-indigo-500 to-purple-600 border dark:border-[#09090b] border-white shadow-[0_0_10px_rgba(139,92,246,0.4)] text-white' : 'dark:bg-zinc-800 bg-zinc-200 border dark:border-[#09090b] border-white text-slate-700 dark:text-white/70'}`}>
                  {item.isAI ? 'AI' : item.author.charAt(0)}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-500 dark:text-white/90">{item.author}</div>
                    <div className="text-[10px] text-slate-500 dark:text-white/40">{item.time}</div>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-white/70 leading-relaxed">{item.content}</div>
                  {item.file && (
                    <div className="mt-2 flex items-center gap-3 p-2 rounded-md dark:bg-black/30 bg-black/5 border border-black/5 dark:border-white/5 w-fit cursor-pointer hover:bg-black/10 hover:dark:bg-white/5 transition-colors">
                       <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       </div>
                       <div>
                         <div className="text-xs font-medium text-slate-500 dark:text-white/90">{item.file}</div>
                         <div className="text-[10px] text-slate-500 dark:text-white/40">12 KB • CSV</div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Original Task Description */}
          <div className="rounded-md neu-panel-light dark:neu-panel p-5 flex gap-4 mt-4 animate-fade-in-up shrink-0 relative overflow-hidden" style={{ animationDelay: '700ms' }}>
            <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
             <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/30"></div>
             <div className="flex -space-x-2 shrink-0">
               <div className="w-10 h-10 rounded-full font-sans font-bold bg-blue-500/20 flex items-center justify-center border-2 border-[#09090b] text-blue-400 text-xs font-bold">SJ</div>
               <div className="w-10 h-10 rounded-full font-sans font-bold bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border-2 border-[#09090b] text-white text-xs font-bold shadow-[0_0_10px_rgba(139,92,246,0.4)] z-10">AI</div>
             </div>
             <div className="flex-1 flex flex-col gap-1.5">
               <div className="text-base font-semibold text-slate-500 dark:text-white/90 flex items-center gap-3">
                 {t('mockupslider.control.taskTitle') || "Data Sync & Analysis"}
                 <span className="font-mono text-[10px] text-slate-500 dark:text-white/40 bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10">TSK-8942</span>
               </div>
               <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/50">
                 <span className="hover:text-cyan-400 cursor-pointer transition-colors">Sarah Jenkins</span>
                 <span>•</span>
                 <span>{t('mockupslider.control.assignedTo') || "Task assigned to AI Agent"}</span>
               </div>
               <div className="text-sm text-slate-500 dark:text-white/70 mt-3 leading-relaxed">
                 {t('mockupslider.control.taskDesc') || "Synchronize 50k records from the legacy database and perform anomaly detection. Create a detailed report for any missing identifiers or formatting issues."}
               </div>
               <div className="text-[10px] text-slate-500 dark:text-white/40 mt-3">
                 Oct 24, 2023, 09:15 AM
               </div>
             </div>
          </div>

        </div>
      </div>
      </div>
      {/* Floating Badges */}
      <div className="overflow-hidden relative absolute -right-4 md:-right-8 top-1/4 w-56 rounded-lg neu-panel-light dark:neu-panel p-4 animate-float-slow hidden md:block transition-all duration-500 group-hover/card:-translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(6,182,212,0.15)] z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full font-sans font-bold bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0">
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{t('mockupslider.control.badgeUpdate') || "Task Update"}</div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-tight">{t('mockupslider.control.badgeUpdateDesc') || "AI Agent analyzed 50k records"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden relative absolute -left-4 md:-left-8 bottom-1/3 w-52 rounded-lg neu-panel-light dark:neu-panel p-3 animate-float-medium hidden md:block transition-all duration-500 group-hover/card:translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(239,68,68,0.15)] delay-100 z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full font-sans font-bold bg-red-500 animate-pulse shadow-[0_0_12px_rgba(239,68,68,1)]"></div>
          <div className="text-xs font-medium text-slate-500 dark:text-white/80 tracking-wide">{t('mockupslider.control.badgeAnomaly') || "Anomaly Detected"}</div>
        </div>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}

function DashboardMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 transition-all duration-700 ease-out hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl dark:neu-mockup-screen neu-mockup-screen-light flex flex-col text-left overflow-hidden">
        {/* Border Overlay to ensure crisp rounded edges over children */}
        <div className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.05),transparent_50%)] transition-colors pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-[0.03] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
      {/* Topbar */}
      <div className="h-16 border-b border-black/5 dark:border-white/5 dark:bg-white/[0.01] bg-black/[0.01] flex items-center justify-between px-6 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_0_15px_rgba(16,185,129,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('mockupslider.dashboard.title') || "Analytics Reports"}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-md neu-pressed-light dark:neu-pressed text-xs font-medium text-slate-500 dark:text-white/70 flex items-center gap-2 cursor-pointer transition-colors">
            {t('mockupslider.dashboard.period') || "Last 30 Days"}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden bg-gradient-to-b dark:from-white/[0.01] from-black/[0.01] to-transparent">
        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 shrink-0">
          {[
            { label: t('mockupslider.dashboard.stat1') || "Total Revenue", value: "$124,500", change: "+14.5%", positive: true },
            { label: t('mockupslider.dashboard.stat2') || "Active Users", value: "8,234", change: "+5.2%", positive: true },
            { label: t('mockupslider.dashboard.stat3') || "Conversion Rate", value: "3.2%", change: "-0.4%", positive: false },
            { label: t('mockupslider.dashboard.stat4') || "Avg Session", value: "4m 12s", change: "+1.2%", positive: true }
          ].map((stat, i) => (
            <div key={i} className="dark:neu-card neu-card-light dark:neu-card neu-card-light-hover rounded-md p-3 md:p-4 flex flex-col gap-2 relative overflow-hidden group cursor-pointer animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl dark:from-white/5 from-black/5 to-transparent rounded-bl-full"></div>
              <div className="text-[10px] md:text-xs text-slate-500 dark:text-white/50 font-medium">{stat.label}</div>
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-1 xl:gap-0 mt-auto">
                <div className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white leading-none">{stat.value}</div>
                <div className={`text-[10px] md:text-xs font-semibold px-1.5 py-0.5 rounded w-fit ${stat.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {stat.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Chart Area */}
        <div className="flex-1 rounded-md border border-black/5 dark:border-white/5 dark:bg-white/[0.02] bg-black/5 p-4 md:p-5 flex flex-col relative overflow-hidden animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm font-medium text-slate-500 dark:text-white/80">{t('mockupslider.dashboard.chartTitle') || "Revenue Overview"}</div>
            <div className="flex gap-1 md:gap-2 neu-pressed-light dark:neu-pressed p-1 rounded-md overflow-x-auto scrollbar-hide max-w-[50vw]">
              {['1W', '1M', '3M', '1Y', 'ALL'].map((period, i) => (
                <div key={i} className={`text-[9px] md:text-[10px] font-bold px-2 md:px-3 py-1.5 rounded-md cursor-pointer shrink-0 ${i === 1 ? 'neu-button-light dark:neu-button text-slate-900 dark:text-white' : 'text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70'}`}>
                  {period}
                </div>
              ))}
            </div>
          </div>
          
          {/* Chart Mockup */}
          <div className="flex-1 relative w-full flex items-end gap-2 px-2 pb-6">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full h-px bg-black/5 dark:bg-white/5 border-dashed border-t border-black/5 dark:border-white/5"></div>
              ))}
            </div>
            
            {/* Bars */}
            {[40, 55, 45, 70, 65, 85, 75, 90, 80, 100, 85, 95].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center group relative z-10 h-full">
                <div 
                  className={`w-full max-w-[24px] rounded-t-sm transition-all duration-500 animate-grow-up ${i === 9 ? 'bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-black/10 dark:bg-white/10 group-hover:bg-black/20 dark:group-hover:bg-white/20'}`}
                  style={{ height: `${height}%`, animationDelay: `${500 + i * 50}ms` }}
                ></div>
                {/* Tooltip on hover */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity dark:bg-[#121214] bg-white border border-black/10 dark:border-white/10 text-slate-900 dark:text-white text-[10px] py-1 px-2 rounded shadow-xl pointer-events-none whitespace-nowrap z-20">
                  ${(height * 1200).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
      {/* Floating Badges */}
      <div className="overflow-hidden relative absolute -left-4 md:-left-8 top-1/4 w-56 rounded-lg neu-panel-light dark:neu-panel p-4 animate-float-slow hidden md:block transition-all duration-500 group-hover/card:-translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(16,185,129,0.15)] z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full font-sans font-bold bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">Revenue Spike</div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-tight">+14.5% increase this week</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden relative absolute -right-4 md:-right-8 bottom-1/4 w-52 rounded-lg neu-panel-light dark:neu-panel p-3 animate-float-medium hidden md:block transition-all duration-500 group-hover/card:translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(59,130,246,0.15)] delay-100 z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white tracking-tight">Report Generated</div>
            <div className="text-[10px] text-slate-500 dark:text-white/50">Sent to stakeholders</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}

function ChatMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 transition-all duration-700 ease-out hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl dark:neu-mockup-screen neu-mockup-screen-light flex text-left overflow-hidden">
        {/* Border Overlay to ensure crisp rounded edges over children */}
        <div className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(236,72,153,0.05),transparent_50%)] transition-colors pointer-events-none"></div>
        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(236,72,153,0.1)_8px,rgba(236,72,153,0.1)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
      {/* Sidebar */}
      <div className="hidden md:flex w-64 border-r border-black/5 dark:border-white/5 bg-gradient-to-b dark:from-white/[0.03] from-black/[0.03] to-transparent flex-col relative shrink-0">
        <div className="h-16 border-b border-black/5 dark:border-white/5 flex items-center px-4">
          <div className="w-full h-9 neu-pressed-light dark:neu-pressed rounded-md px-3 flex items-center">
            <svg className="w-4 h-4 text-slate-500 dark:text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <div className="ml-2 text-xs text-slate-500 dark:text-white/30">{t('mockupslider.chat.search') || "Search messages..."}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {[
            { name: t('mockupslider.chat.team') || "Sales Team", msg: t('mockupslider.chat.msg1') || "Great job on the new campaign!", time: "10:42 AM", active: true, avatar: "bg-blue-500" },
            { name: "AI Assistant", msg: t('mockupslider.chat.msg2') || "I've drafted 5 new emails.", time: "09:15 AM", active: false, avatar: "bg-violet-500" },
            { name: t('mockupslider.chat.support') || "Support", msg: t('mockupslider.chat.msg3') || "Ticket #1042 resolved.", time: t('mockupslider.chat.yesterday') || "Yesterday", active: false, avatar: "bg-emerald-500" },
            { name: t('mockupslider.chat.marketing') || "Marketing", msg: t('mockupslider.chat.msg4') || "Assets are ready for review.", time: t('mockupslider.chat.yesterday') || "Yesterday", active: false, avatar: "bg-orange-500" }
          ].map((chat, i) => (
            <div key={i} className={`p-3 rounded-md flex items-center gap-3 cursor-pointer transition-colors animate-fade-in-up ${chat.active ? 'bg-black/10 dark:bg-white/10 border border-black/5 dark:border-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'}`} style={{ animationDelay: `${i * 100}ms` }}>
              <div className={`w-10 h-10 rounded-full font-sans flex items-center justify-center text-white font-bold text-sm shadow-inner ${chat.avatar}`}>
                {chat.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline mb-0.5">
                  <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{chat.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-white/40 shrink-0">{chat.time}</div>
                </div>
                <div className="text-xs text-slate-500 dark:text-white/50 truncate">{chat.msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gradient-to-b dark:from-white/[0.01] from-black/[0.01] to-transparent relative">
        {/* Header */}
        <div className="h-16 border-b border-black/5 dark:border-white/5 flex items-center justify-between px-6 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full font-sans font-bold bg-blue-500 flex items-center justify-center text-white font-bold text-sm shadow-inner">S</div>
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('mockupslider.chat.team') || "Sales Team"}</div>
              <div className="text-xs text-slate-500 dark:text-white/40 flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full font-sans font-bold bg-emerald-500 animate-pulse"></div>
                {t('mockupslider.chat.online') || "4 members online"}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4 text-slate-500 dark:text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </div>
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4 text-slate-500 dark:text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
          <div className="text-center text-[10px] font-medium text-slate-500 dark:text-white/30 my-2 animate-fade-in-up">{t('mockupslider.chat.today') || "Today"}</div>
          
          <div className="flex gap-3 max-w-[80%] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-emerald-500 shrink-0 mt-auto flex items-center justify-center text-white text-xs font-bold">J</div>
            <div className="overflow-hidden relative neu-panel-light dark:neu-panel rounded-lg rounded-bl-sm p-3 text-sm text-slate-500 dark:text-white/90">
              <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
              {t('mockupslider.chat.bubble1') || "Hey team, how's the new outreach campaign performing?"}
            </div>
          </div>
          
          <div className="flex gap-3 max-w-[80%] self-end flex-row-reverse animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-violet-500 shrink-0 mt-auto flex items-center justify-center text-white text-xs font-bold shadow-[0_0_10px_rgba(139,92,246,0.5)]">AI</div>
            <div className="bg-violet-500/20 border border-violet-500/30 rounded-lg rounded-br-sm p-3 text-sm text-slate-500 dark:text-white/90">
              {t('mockupslider.chat.bubble2') || "I've analyzed the initial data. Open rates are up 24% compared to last week. I've also automatically followed up with 45 engaged leads."}
            </div>
          </div>

          <div className="flex gap-3 max-w-[80%] animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-orange-500 shrink-0 mt-auto flex items-center justify-center text-white text-xs font-bold">M</div>
            <div className="overflow-hidden relative neu-panel-light dark:neu-panel rounded-lg rounded-bl-sm p-3 text-sm text-slate-500 dark:text-white/90">
              <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
              {t('mockupslider.chat.bubble3') || "That's amazing! Can you generate a report for the weekly meeting?"}
            </div>
          </div>
          
          <div className="flex gap-3 max-w-[80%] self-end flex-row-reverse animate-fade-in-up" style={{ animationDelay: '700ms' }}>
            <div className="w-8 h-8 rounded-full font-sans font-bold bg-violet-500 shrink-0 mt-auto flex items-center justify-center text-white text-xs font-bold shadow-[0_0_10px_rgba(139,92,246,0.5)]">AI</div>
            <div className="bg-violet-500/20 border border-violet-500/30 rounded-lg rounded-br-sm p-3 text-sm text-slate-500 dark:text-white/90 flex flex-col gap-2">
              <div>{t('mockupslider.chat.bubble4') || "Absolutely. I'm compiling the metrics now."}</div>
              <div className="dark:bg-black/30 bg-black/5 rounded-md p-2 flex items-center gap-3 border border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/10 hover:dark:bg-white/5 transition-colors">
                <div className="w-8 h-8 rounded bg-rose-500/20 flex items-center justify-center text-rose-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-900 dark:text-white">{t('mockupslider.chat.reportName') || "campaign_report_v1.pdf"}</div>
                  <div className="text-[10px] text-slate-500 dark:text-white/40">{t('mockupslider.chat.reportSize') || "1.2 MB • Ready"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="p-4 dark:bg-white/[0.02] bg-black/5 border-t border-black/5 dark:border-white/5 shrink-0">
          <div className="neu-pressed-light dark:neu-pressed rounded-md p-2 flex items-center gap-2 transition-all">
            <div className="w-8 h-8 rounded-md hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors text-slate-500 dark:text-white/40">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </div>
            <input 
              type="text" 
              placeholder={t('mockupslider.chat.placeholder') || "Type a message or ask AI..."}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-white dark:placeholder-white/30 placeholder-black/30 px-2"
            />
            <div className="w-8 h-8 rounded-md bg-violet-500 hover:bg-violet-600 flex items-center justify-center cursor-pointer transition-all text-white shadow-[0_0_10px_rgba(139,92,246,0.5)] hover:shadow-[0_0_20px_rgba(139,92,246,0.8)] hover:scale-105 active:scale-95">
              <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Floating Badges */}
      <div className="overflow-hidden relative absolute -right-4 md:-right-8 top-1/4 w-60 rounded-lg neu-panel-light dark:neu-panel p-4 animate-float-slow hidden md:block transition-all duration-500 group-hover/card:-translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(139,92,246,0.15)] z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent"></div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full font-sans font-bold bg-violet-500/20 flex items-center justify-center border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.3)] shrink-0">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{t('mockupslider.chat.autoReply') || "Auto-Reply Sent"}</div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-tight">{t('mockupslider.chat.autoReplyDesc') || "AI handled 45 inquiries"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden relative absolute -left-4 md:-left-8 bottom-1/4 w-52 rounded-lg neu-panel-light dark:neu-panel p-3 animate-float-medium hidden md:block transition-all duration-500 group-hover/card:translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(16,185,129,0.15)] delay-100 z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full font-sans font-bold bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white tracking-tight">{t('mockupslider.chat.leadQualified') || "Lead Qualified"}</div>
            <div className="text-[10px] text-slate-500 dark:text-white/50">{t('mockupslider.chat.leadQualifiedDesc') || "Transferred to Sales"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}

function AgentsMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 transition-all duration-700 ease-out hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl dark:neu-mockup-screen neu-mockup-screen-light flex flex-col text-left overflow-hidden">
        {/* Border Overlay to ensure crisp rounded edges over children */}
        <div className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.05),transparent_50%)] transition-colors pointer-events-none"></div>
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(244,63,94,0.1)_8px,rgba(244,63,94,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(244,63,94,0.05)_8px,rgba(244,63,94,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
      {/* Topbar */}
      <div className="h-16 border-b border-black/5 dark:border-white/5 dark:bg-white/[0.01] bg-black/[0.01] flex items-center px-6 backdrop-blur-md shrink-0 gap-4">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-rose-500 to-pink-600 shadow-[0_0_15px_rgba(244,63,94,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center">
           <svg className="w-4 h-4 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        </div>
        <div className="flex gap-2 neu-pressed-light dark:neu-pressed p-1 rounded-full">
          {[t('mockupslider.agents.new') || "New Makina", t('mockupslider.agents.instance1') || "Instance 1", t('mockupslider.agents.instance2') || "Instance 2"].map((tab, i) => (
            <div key={i} className={`text-xs font-medium px-4 py-1.5 rounded-full font-sans cursor-pointer transition-colors ${i === 1 ? 'neu-button-light dark:neu-button text-slate-900 dark:text-white' : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80'}`}>
              {tab}
            </div>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Browser Area */}
        <div className="flex-1 p-4 md:p-6 flex flex-col bg-gradient-to-b dark:from-white/[0.01] from-black/[0.01] to-transparent overflow-hidden">
          <div className="flex-1 rounded-md dark:neu-recessed neu-recessed-light overflow-hidden flex flex-col relative group">
            <div className="h-10 border-b border-black/5 dark:border-white/5 dark:bg-white/[0.02] bg-black/5 flex items-center px-4 gap-3 shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full font-sans font-bold bg-rose-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full font-sans font-bold bg-amber-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full font-sans font-bold bg-emerald-500/80"></div>
              </div>
              <div className="flex-1 h-6 bg-black/5 dark:bg-white/5 rounded-md border border-black/5 dark:border-white/5 flex items-center justify-center">
                <span className="text-[10px] text-slate-500 dark:text-white/30 font-mono">browser-session-xyz.internal</span>
              </div>
            </div>
            
            {/* Animated Loading Overlay */}
            <div className="absolute inset-0 top-10 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
               <div className="flex flex-col items-center gap-3">
                 <div className="w-12 h-12 rounded-full font-sans border-2 border-rose-500/20 border-t-rose-500 animate-spin"></div>
                 <div className="text-rose-400 text-xs font-mono animate-pulse">{t('mockupslider.agents.running') || "Running Task..."}</div>
               </div>
            </div>
            
            <div className="flex-1 p-8 flex flex-col gap-6 opacity-60">
              <div className="w-1/3 h-8 dark:neu-skeleton neu-skeleton-light rounded-md animate-pulse-slow"></div>
              <div className="w-full h-32 dark:neu-skeleton neu-skeleton-light rounded-md border border-black/5 dark:border-white/5"></div>
              <div className="grid grid-cols-3 gap-4">
                <div className="h-24 dark:neu-skeleton neu-skeleton-light rounded-md border border-black/5 dark:border-white/5"></div>
                <div className="h-24 dark:neu-skeleton neu-skeleton-light rounded-md border border-black/5 dark:border-white/5"></div>
                <div className="h-24 dark:neu-skeleton neu-skeleton-light rounded-md border border-black/5 dark:border-white/5"></div>
              </div>
            </div>
            
            {/* Fake Cursor Animation */}
            <div className="absolute w-4 h-4 text-slate-900 dark:text-white z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ animation: 'move-cursor 4s ease-in-out infinite' }}>
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2l12 11.2-5.8.5 3.3 7.3-2.2 1-3.2-7.4-4.4 4.5z"/></svg>
            </div>
          </div>
        </div>
        
        {/* Chat / Log area */}
        <div className="w-full md:w-80 h-1/2 md:h-full border-t md:border-t-0 md:border-l border-black/5 dark:border-white/5 dark:bg-[#0a0a0c] bg-white flex flex-col shrink-0">
          <div className="h-12 border-b dark:border-white/5 border-black/5 flex items-center px-4 gap-2 dark:bg-white/[0.01] bg-black/[0.01]">
            <div className="w-2 h-2 rounded-full font-sans font-bold bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
            <span className="text-xs font-medium dark:text-white/80 text-slate-500">{t('mockupslider.agents.agentLog') || "Agent Log"}</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 font-mono text-[10px]">
            <div className="dark:text-white/40 text-slate-500 animate-fade-in-up" style={{ animationDelay: '0ms' }}>{t('mockupslider.agents.log1') || "[10:42:01] Navigating to target URL..."}</div>
            <div className="text-emerald-500 dark:text-emerald-400 animate-fade-in-up" style={{ animationDelay: '500ms' }}>{t('mockupslider.agents.log2') || "[10:42:03] Page loaded successfully"}</div>
            <div className="dark:text-white/40 text-slate-500 animate-fade-in-up" style={{ animationDelay: '1000ms' }}>{t('mockupslider.agents.log3') || "[10:42:05] Scanning DOM elements..."}</div>
            <div className="text-rose-500 dark:text-rose-400 animate-fade-in-up" style={{ animationDelay: '1500ms' }}>{t('mockupslider.agents.log4') || "[10:42:06] Found target form, analyzing fields"}</div>
            <div className="dark:bg-rose-500/10 bg-rose-500/10 border dark:border-rose-500/20 border-rose-500/20 rounded p-2 text-rose-500 dark:text-rose-300 shadow-[inset_0_0_10px_rgba(244,63,94,0.05)] dark:shadow-[inset_0_0_10px_rgba(244,63,94,0.1)] animate-fade-in-up" style={{ animationDelay: '2000ms' }}>
              {t('mockupslider.agents.log5a') || "Executing action: FILL_FORM"}
              {"\n"}{">"} {t('mockupslider.agents.log5b') || "Extracted 5 fields"}
              {"\n"}{">"} {t('mockupslider.agents.log5c') || "Injecting data..."}
            </div>
            <div className="text-emerald-500 dark:text-emerald-400 animate-fade-in-up" style={{ animationDelay: '3000ms' }}>{t('mockupslider.agents.log6') || "[10:42:08] Form filled, awaiting confirmation"}</div>
            <div className="animate-pulse dark:text-white/50 text-slate-500 mt-2">_</div>
          </div>
          <div className="p-3 border-t dark:border-white/5 border-black/5 dark:bg-white/[0.02] bg-black/5">
            <div className="dark:bg-black/50 bg-white border dark:border-white/10 border-black/10 rounded-md p-2 flex items-center gap-2 transition-all hover:dark:border-white/20 hover:border-black/20 hover:shadow-[0_0_15px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
              <input type="text" placeholder={t('mockupslider.agents.instruction') || "Send instruction..."} className="flex-1 bg-transparent border-none outline-none text-xs dark:text-white text-slate-900 dark:placeholder-white/30 placeholder-black/30" />
              <div className="w-6 h-6 rounded bg-rose-500/20 flex items-center justify-center text-rose-400 hover:bg-rose-500/40 cursor-pointer transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* Floating Badges */}
      <div className="overflow-hidden relative absolute -left-4 md:-left-8 top-1/4 w-56 rounded-lg neu-panel-light dark:neu-panel p-4 animate-float-slow hidden md:block transition-all duration-500 group-hover/card:-translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(244,63,94,0.15)] z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full font-sans font-bold bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)] shrink-0">
            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{t('mockupslider.agents.deployed') || "Instance Deployed"}</div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-tight">{t('mockupslider.agents.deployedDesc') || "Running form automation"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden relative absolute -right-4 md:-right-8 bottom-1/4 w-56 rounded-lg neu-panel-light dark:neu-panel p-3 animate-float-medium hidden md:block transition-all duration-500 group-hover/card:translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(244,63,94,0.15)] delay-100 z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-rose-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full font-sans font-bold bg-rose-500/20 flex items-center justify-center border border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
            <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white tracking-tight">{t('mockupslider.agents.completed') || "Action Completed"}</div>
            <div className="text-[10px] text-slate-500 dark:text-white/50">{t('mockupslider.agents.completedDesc') || "5 fields extracted & injected"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}

function GoalsMockup({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 transition-all duration-700 ease-out hover:scale-[1.02]">
      <div className="absolute inset-0 rounded-xl dark:neu-mockup-screen neu-mockup-screen-light flex flex-col text-left overflow-hidden">
        {/* Border Overlay to ensure crisp rounded edges over children */}
        <div className="absolute inset-0 rounded-xl border border-black/10 dark:border-white/10 pointer-events-none z-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.05),transparent_50%)] transition-colors pointer-events-none"></div>
        <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(234,179,8,0.1)_10px,rgba(234,179,8,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
      {/* Topbar */}
      <div className="h-16 border-b border-black/5 dark:border-white/5 dark:bg-white/[0.01] bg-black/[0.01] flex items-center px-6 backdrop-blur-md shrink-0 gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-400 to-orange-600 shadow-[0_0_15px_rgba(234,179,8,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-900 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          </div>
          <div className="flex gap-2 neu-pressed-light dark:neu-pressed p-1 rounded-md">
            {[t('mockupslider.goals.tab1') || "All Requirements", t('mockupslider.goals.tab2') || "Pending", t('mockupslider.goals.tab3') || "Completed"].map((tab, i) => (
              <div key={i} className={`text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer transition-colors ${i === 1 ? 'neu-button-light dark:neu-button text-slate-900 dark:text-white' : 'text-slate-500 dark:text-white/50 hover:text-slate-700 dark:hover:text-white/80'}`}>
                {tab}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
           <div className="px-3 py-1.5 rounded-md bg-amber-500 text-black text-xs font-bold shadow-[0_0_15px_rgba(234,179,8,0.4)] cursor-pointer hover:bg-amber-400 transition-colors">
             + {t('mockupslider.goals.newGoal') || "New Goal"}
           </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto bg-gradient-to-b dark:from-white/[0.01] from-black/[0.01] to-transparent">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { title: t('mockupslider.goals.g1.title') || "Automate Outreach Setup", type: t('mockupslider.goals.type.feature') || "Feature", status: t('mockupslider.goals.status.inProgress') || "In Progress", priority: t('mockupslider.goals.priority.high') || "High", progress: 65, color: "text-amber-400", bg: "bg-amber-500" },
            { title: t('mockupslider.goals.g2.title') || "Optimize Landing Page Speed", type: t('mockupslider.goals.type.optimization') || "Optimization", status: t('mockupslider.goals.status.pending') || "Pending", priority: t('mockupslider.goals.priority.medium') || "Medium", progress: 0, color: "text-blue-400", bg: "bg-blue-500" },
            { title: t('mockupslider.goals.g3.title') || "Fix API Rate Limiting", type: t('mockupslider.goals.type.bug') || "Bug", status: t('mockupslider.goals.status.completed') || "Completed", priority: t('mockupslider.goals.priority.critical') || "Critical", progress: 100, color: "text-emerald-400", bg: "bg-emerald-500" },
            { title: t('mockupslider.goals.g4.title') || "Implement Stripe Billing", type: t('mockupslider.goals.type.feature') || "Feature", status: t('mockupslider.goals.status.inProgress') || "In Progress", priority: t('mockupslider.goals.priority.high') || "High", progress: 30, color: "text-amber-400", bg: "bg-amber-500" }
          ].map((req, i) => (
            <div key={i} className="overflow-hidden relative dark:neu-card neu-card-light dark:neu-card neu-card-light-hover rounded-lg p-5 cursor-pointer group animate-fade-in-up" style={{ animationDelay: `${i * 150}ms` }}>
              <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="text-sm font-semibold text-slate-500 dark:text-white/90">{req.title}</div>
                <div className={`text-[10px] font-bold px-2 py-1 rounded border ${
                  req.priority === "Critical" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                  req.priority === "High" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                  "bg-blue-500/10 text-blue-400 border-blue-500/20"
                }`}>
                  {req.priority}
                </div>
              </div>
              
              <div className="flex items-center gap-3 mb-5">
                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded text-[10px] text-slate-500 dark:text-white/60 border border-black/5 dark:border-white/5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  {req.type}
                </div>
                <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 px-2 py-1 rounded text-[10px] text-slate-500 dark:text-white/60 border border-black/5 dark:border-white/5">
                  <div className={`w-1.5 h-1.5 rounded-full font-sans ${req.bg}`}></div>
                  {req.status}
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <div className="flex-1 mr-4">
                  <div className="flex justify-between text-[10px] text-slate-500 dark:text-white/40 mb-1.5">
                    <span>{t('mockupslider.goals.progress') || "Progress"}</span>
                    <span>{req.progress}%</span>
                  </div>
                  <div className="h-1.5 dark:neu-recessed neu-recessed-light rounded-full font-sans overflow-hidden border border-black/5 dark:border-white/5">
                    <div className={`h-full ${req.bg} rounded-full font-sans transition-all duration-1000 ease-out`} style={{ width: req.progress === 0 ? '0%' : '0%', animation: `fill-progress-${req.progress} 1s ease-out ${500 + i * 150}ms forwards` }}></div>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full font-sans dark:bg-zinc-800 bg-zinc-200 border border-white dark:border-[#09090b] shadow-sm"></div>
                  <div className="w-6 h-6 rounded-full font-sans font-bold bg-gradient-to-br from-indigo-500 to-purple-600 border border-[#09090b] flex items-center justify-center text-[8px] font-bold text-white z-10">AI</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
      {/* Floating Badges */}
      <div className="overflow-hidden relative absolute -right-4 md:-right-8 top-1/4 w-56 rounded-lg neu-panel-light dark:neu-panel p-4 animate-float-slow hidden md:block transition-all duration-500 group-hover/card:-translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(234,179,8,0.15)] z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full font-sans font-bold bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(234,179,8,0.3)] shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{t('mockupslider.goals.goalAchieved') || "Goal Achieved"}</div>
            <div className="text-xs text-slate-500 dark:text-white/50 mt-1 leading-tight">{t('mockupslider.goals.goalAchievedDesc') || "API Rate Limiting fixed"}</div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden relative absolute -left-4 md:-left-8 bottom-1/4 w-56 rounded-lg neu-panel-light dark:neu-panel p-3 animate-float-medium hidden md:block transition-all duration-500 group-hover/card:translate-y-4 group-hover/card:scale-105 group-hover/card:shadow-[0_20px_60px_rgba(234,179,8,0.15)] delay-100 z-50">
        <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(0,0,0,0.05)_8px,rgba(0,0,0,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-lines"></div>
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full font-sans font-bold bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
             <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white tracking-tight">{t('mockupslider.goals.autoPrioritization') || "Auto-prioritization"}</div>
            <div className="text-[10px] text-slate-500 dark:text-white/50">{t('mockupslider.goals.autoPrioritizationDesc') || "Stripe Billing moved to High"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Global animations for mockups
if (typeof window !== "undefined" && !document.getElementById("mockup-animations")) {
  const style = document.createElement("style");
  style.id = "mockup-animations";
  style.innerHTML = `
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes grow-up {
      from { transform: scaleY(0); transform-origin: bottom; }
      to { transform: scaleY(1); transform-origin: bottom; }
    }
    .animate-grow-up {
      animation: grow-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transform-origin: bottom;
      transform: scaleY(0);
    }
    @keyframes fill-progress-65 {
      from { width: 0%; }
      to { width: 65%; }
    }
    @keyframes fill-progress-30 {
      from { width: 0%; }
      to { width: 30%; }
    }
    @keyframes fill-progress-100 {
      from { width: 0%; }
      to { width: 100%; }
    }
    @keyframes move-cursor {
      0% { transform: translate(0px, 0px); }
      25% { transform: translate(50px, -20px); }
      50% { transform: translate(100px, 40px); }
      75% { transform: translate(150px, -10px); }
      100% { transform: translate(0px, 0px); }
    }
  `;
  document.head.appendChild(style);
}
