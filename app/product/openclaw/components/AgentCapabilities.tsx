"use client"

import * as React from "react"
import { Globe, Code, Zap, Plug, Target, Database } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function AgentCapabilities() {
  const { t } = useLocalization()

  return (
    <div className="w-full mt-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
          {t('openclaw.capabilities.title.start')}<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">{t('openclaw.capabilities.title.highlight')}</span>
        </h2>
        <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-3xl mx-auto font-light">
          {t('openclaw.capabilities.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{t('openclaw.capabilities.c1.title')}</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            {t('openclaw.capabilities.c1.desc')}
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 mb-6">
            <Code className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{t('openclaw.capabilities.c2.title')}</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            {t('openclaw.capabilities.c2.desc')}
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{t('openclaw.capabilities.c3.title')}</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            {t('openclaw.capabilities.c3.desc')}
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
            <Plug className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{t('openclaw.capabilities.c4.title')}</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            {t('openclaw.capabilities.c4.desc')}
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{t('openclaw.capabilities.c5.title')}</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            {t('openclaw.capabilities.c5.desc')}
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">{t('openclaw.capabilities.c6.title')}</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            {t('openclaw.capabilities.c6.desc')}
          </p>
        </div>

      </div>

      {/* Terminal Mockup */}
      <div className="mt-16 w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border dark:border-white/10 border-black/10 dark:bg-[#0a0a0c] bg-slate-900">
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/40">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
          </div>
          <div className="mx-auto text-xs font-mono text-white/50">openclaw-agent — bash</div>
        </div>
        <div className="p-6 font-mono text-sm md:text-base text-slate-300 space-y-3 overflow-x-auto">
          <div className="flex gap-4">
            <span className="text-emerald-400 shrink-0">$</span>
            <span className="text-slate-300">{t('openclaw.terminal.prompt1')}</span>
          </div>
          <div className="text-blue-400">{t('openclaw.terminal.loading')}</div>
          <div className="text-purple-400">{t('openclaw.terminal.memory')}</div>
          <div className="text-orange-400">{t('openclaw.terminal.whatsapp')}</div>
          <div className="flex gap-4">
            <span className="text-emerald-400 shrink-0">$</span>
            <span className="text-slate-300">{t('openclaw.terminal.prompt2')}</span>
          </div>
          <div className="text-slate-400">{t('openclaw.terminal.navigating')}</div>
          <div className="text-slate-400">{t('openclaw.terminal.extracting')}</div>
          <div className="text-slate-400">{t('openclaw.terminal.generating')}</div>
          <div className="text-emerald-400 font-bold">{t('openclaw.terminal.completed')}</div>
          <div className="flex gap-4 mt-4 animate-pulse">
            <span className="text-emerald-400 shrink-0">$</span>
            <span className="w-2.5 h-5 bg-slate-300 inline-block"></span>
          </div>
        </div>
      </div>
      {/* Bring your own OpenClaw */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10">
          <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-sm dark:text-white/80 text-slate-700">
            {t('openclaw.byo.text')} <a href="#" className="text-orange-500 hover:text-orange-400 font-medium underline underline-offset-4">{t('openclaw.byo.link')}</a> {t('openclaw.byo.text2')}
          </span>
        </div>
      </div>
    </div>
  )
}
