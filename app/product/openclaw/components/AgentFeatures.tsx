"use client"

import * as React from "react"
import { Zap, MessageCircle, Sparkles, ShieldCheck, NetworkTree, Bot, CheckSquare, Lock } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function AgentFeatures() {
  const { t } = useLocalization()

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Feature 1: Zero Config */}
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-500 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.1),transparent_50%)] transition-colors"></div>
          <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(236,72,153,0.1)_8px,rgba(236,72,153,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(236,72,153,0.05)_8px,rgba(236,72,153,0.05)_16px)] opacity-40 pointer-events-none animate-pan-diagonal-fast"></div>
          
          <div className="mb-8 relative z-10 w-full rounded-xl dark:neu-recessed neu-recessed-light border dark:border-white/5 border-black/5 p-4 flex flex-col gap-3 bg-slate-50 dark:bg-black/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold dark:text-white text-slate-900">Strategy Agent</div>
                  <div className="text-[10px] dark:text-white/50 text-slate-500">Market Research</div>
                </div>
              </div>
              <div className="px-2 py-1 rounded bg-pink-500/10 border border-pink-500/20 text-pink-500 text-[10px] font-bold">
                Ready
              </div>
            </div>
            <div className="w-full h-8 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(236,72,153,0.3)]">
              One-Click Deploy
            </div>
          </div>
          
          <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-pink-500/5 flex items-center justify-center text-pink-500 mb-6 shadow-sm relative z-10 group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3 relative z-10">
            {t('openclaw.features.f1.title')}
          </h3>
          <p className="dark:text-white/60 text-slate-500 leading-relaxed relative z-10">
            {t('openclaw.features.f1.desc')}
          </p>
        </div>

        {/* Feature 2: Easiest to use */}
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-500 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] transition-colors"></div>
          <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(59,130,246,0.1)_10px,rgba(59,130,246,0.1)_20px)] opacity-40 pointer-events-none animate-expand-waves"></div>
          
          <div className="mb-8 relative z-10 w-full rounded-xl dark:neu-recessed neu-recessed-light border dark:border-white/5 border-black/5 p-4 flex flex-col gap-3 bg-slate-50 dark:bg-black/20">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full dark:bg-white/10 bg-black/10 shrink-0"></div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg rounded-tl-sm p-2 text-[10px] dark:text-white/80 text-slate-700 w-[85%]">
                Find 50 B2B SaaS companies using React and get their CTO&apos;s email.
              </div>
            </div>
            <div className="flex gap-2 flex-row-reverse">
              <div className="w-6 h-6 rounded-full bg-blue-500 shrink-0 flex items-center justify-center text-white shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                <Bot className="w-3 h-3" />
              </div>
              <div className="dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 rounded-lg rounded-tr-sm p-2 text-[10px] dark:text-white/80 text-slate-700 w-[85%]">
                Done! I found 50 matching accounts and 62 contacts. I&apos;ve added them to your CRM.
              </div>
            </div>
          </div>
          
          <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-blue-500/5 flex items-center justify-center text-blue-500 mb-6 shadow-sm relative z-10 group-hover:scale-110 transition-transform">
            <MessageCircle className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3 relative z-10">
            {t('openclaw.features.f2.title')}
          </h3>
          <p className="dark:text-white/60 text-slate-500 leading-relaxed relative z-10">
            {t('openclaw.features.f2.desc')}
          </p>
        </div>

        {/* Feature 3: State of the art */}
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-500 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_50%)] transition-colors"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(16,185,129,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(16,185,129,0.3)_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-40 [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] pointer-events-none animate-pan-diagonal-fast"></div>
          
          <div className="mb-8 relative z-10 w-full rounded-xl dark:neu-recessed neu-recessed-light border dark:border-white/5 border-black/5 p-4 flex flex-col gap-2 bg-slate-50 dark:bg-black/20 font-mono text-[10px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-emerald-500">
                <NetworkTree className="w-3 h-3" />
                <span className="font-bold">Neural Router</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
            </div>
            <div className="flex items-center gap-2 p-1.5 rounded dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5">
              <div className="text-emerald-500">→</div>
              <div className="dark:text-white text-slate-800">Task: Complex Reasoning</div>
              <div className="ml-auto text-emerald-500 bg-emerald-500/10 px-1 rounded">GPT-4o</div>
            </div>
            <div className="flex items-center gap-2 p-1.5 rounded dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5">
              <div className="text-emerald-500">→</div>
              <div className="dark:text-white text-slate-800">Task: Web Scraping</div>
              <div className="ml-auto text-emerald-500 bg-emerald-500/10 px-1 rounded">Claude 3.5 Sonnet</div>
            </div>
            <div className="flex items-center gap-2 p-1.5 rounded dark:bg-white/5 bg-black/5 border dark:border-white/5 border-black/5 opacity-50">
              <div className="text-emerald-500">→</div>
              <div className="dark:text-white text-slate-800">Task: Data Formatting</div>
              <div className="ml-auto text-emerald-500 bg-emerald-500/10 px-1 rounded">Llama 3 70B</div>
            </div>
          </div>
          
          <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-emerald-500/5 flex items-center justify-center text-emerald-500 mb-6 shadow-sm relative z-10 group-hover:scale-110 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3 relative z-10">
            {t('openclaw.features.f3.title')}
          </h3>
          <p className="dark:text-white/60 text-slate-500 leading-relaxed relative z-10">
            {t('openclaw.features.f3.desc')}
          </p>
        </div>

        {/* Feature 4: Secure */}
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-500 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_50%)] transition-colors"></div>
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_8px,rgba(249,115,22,0.1)_8px,rgba(249,115,22,0.1)_16px)] opacity-40 pointer-events-none animate-pan-lines"></div>
          
          <div className="mb-8 relative z-10 w-full rounded-xl dark:neu-recessed neu-recessed-light border dark:border-white/5 border-black/5 p-4 flex flex-col gap-2 bg-slate-50 dark:bg-black/20">
            <div className="flex items-center gap-3 p-2 rounded-lg dark:bg-white/5 bg-black/5">
              <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center text-orange-500">
                <Lock className="w-3 h-3" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold dark:text-white text-slate-800">SOC 2 Type II</div>
                <div className="text-[9px] dark:text-white/50 text-slate-500">Enterprise Grade</div>
              </div>
              <CheckSquare className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex items-center gap-3 p-2 rounded-lg dark:bg-white/5 bg-black/5">
              <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center text-orange-500">
                <ShieldCheck className="w-3 h-3" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold dark:text-white text-slate-800">Zero Data Training</div>
                <div className="text-[9px] dark:text-white/50 text-slate-500">Your data is yours</div>
              </div>
              <CheckSquare className="w-4 h-4 text-orange-500" />
            </div>
            <div className="w-full h-1 bg-orange-500/20 rounded-full mt-2 overflow-hidden">
               <div className="h-full bg-orange-500 w-full shadow-[0_0_10px_rgba(249,115,22,0.8)]"></div>
            </div>
          </div>
          
          <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-orange-500/5 flex items-center justify-center text-orange-500 mb-6 shadow-sm relative z-10 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-3 relative z-10">
            {t('openclaw.features.f4.title')}
          </h3>
          <p className="dark:text-white/60 text-slate-500 leading-relaxed relative z-10">
            {t('openclaw.features.f4.desc')}
          </p>
        </div>

      </div>
    </div>
  )
}

