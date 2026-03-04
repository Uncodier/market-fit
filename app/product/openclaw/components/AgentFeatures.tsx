"use client"

import * as React from "react"
import { Zap, MessageCircle, Sparkles, ShieldCheck } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function AgentFeatures() {
  const { t } = useLocalization()

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Feature 1: Zero Config */}
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.1),transparent_50%)] transition-colors"></div>
          
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500 mb-6 border border-pink-500/20 shadow-sm relative z-10">
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
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_50%)] transition-colors"></div>
          
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6 border border-blue-500/20 shadow-sm relative z-10">
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
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_50%)] transition-colors"></div>
          
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20 shadow-sm relative z-10">
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
        <div className="rounded-2xl dark:neu-panel neu-panel-light p-8 flex flex-col border dark:border-white/[0.04] border-black/5 relative group overflow-hidden transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-[#09090b]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.05),transparent_50%)] group-hover:bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.1),transparent_50%)] transition-colors"></div>
          
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6 border border-orange-500/20 shadow-sm relative z-10">
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
