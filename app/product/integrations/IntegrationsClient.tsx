"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"
import { IntegrationGrid } from "./components/IntegrationGrid"
import Link from "next/link"
import { ArrowRight } from "@/app/components/ui/icons"

export function IntegrationsClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
            {t('footer.product.integrations') || 'Integrations'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('integrations.hero.title1') || 'Connect Your '} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">{t('integrations.hero.title2') || 'Entire Stack'}</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            {t('integrations.hero.description') || 'Sync data across your favorite tools. From CRMs to communication channels, we integrate with everything you need.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 group">
              {t('integrations.hero.cta.start') || 'Start with Makinari'}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/product/features" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
              {t('integrations.hero.cta.features') || 'Explore all features'}
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* OmniChannel Bento from Landing */}
          <div className="w-full h-[450px] rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col items-center text-center justify-between transition-all duration-500">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_50%)]"></div>
            <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(59,130,246,0.1)_8px,rgba(59,130,246,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(59,130,246,0.05)_8px,rgba(59,130,246,0.05)_16px)] opacity-40 pointer-events-none animate-pan-diagonal-fast"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6">
                {t('integrations.omni.badge') || 'Omnichannel'}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('integrations.omni.title') || 'Channel automation'}</h3>
              <p className="dark:text-white/50 text-slate-500 text-sm">
                {t('integrations.omni.description') || 'Connect Email, WhatsApp, LinkedIn, and more. Orchestrate all communications in one place.'}
              </p>
            </div>

            <div className="relative w-full h-48 mt-8 flex items-center justify-center pointer-events-none">
              <div className="relative z-30 w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-[2px] shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                <div className="w-full h-full bg-[#0a0a0c] rounded-[14px] flex items-center justify-center">
                  <img src="/images/logo.png" alt="Makinari" className="w-8 h-8 object-contain" />
                </div>
              </div>
              <div className="absolute inset-0 animate-spin-super-slow flex items-center justify-center pointer-events-none">
                <div className="absolute w-[160px] h-[160px] rounded-full border dark:border-white/[0.05] border-black/10"></div>
                <div className="absolute w-[240px] h-[240px] rounded-full border dark:border-white/[0.03] border-black/5"></div>
                <div className="absolute -top-3 w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                  <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div className="absolute top-[15%] -right-2 w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(34,197,94,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                </div>
                <div className="absolute -bottom-1 right-[25%] w-10 h-10 rounded-full dark:bg-[#121214] bg-white border dark:border-white/10 border-black/10 shadow-[0_0_15px_rgba(0,119,181,0.3)] flex items-center justify-center animate-[spin_40s_linear_infinite_reverse]">
                  <svg className="w-5 h-5 text-[#0077b5]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* MCP Server */}
          <div className="w-full h-[450px] lg:col-span-2 rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d4_2px,transparent_2px),linear-gradient(to_bottom,#06b6d4_2px,transparent_2px)] bg-[size:2rem_2rem] opacity-[0.05] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)]"></div>
            
            <div className="relative z-10 max-w-lg">
              <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-mono font-bold mb-6">
                {t('integrations.mcp.badge') || '~/developer-first'}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('integrations.mcp.title') || 'Open source MCP & APIs'}</h3>
              <p className="dark:text-white/50 text-slate-500 text-sm leading-relaxed">
                {t('integrations.mcp.description') || "Connect your custom backend infrastructure directly with Makinari's AI engine using the Model Context Protocol. Easily expose local DBs and APIs."}
              </p>
            </div>

            <div className="relative z-10 mt-8 rounded-md border dark:border-white/10 border-black/10 dark:bg-[#09090b] bg-white shadow-2xl overflow-hidden group-hover:-translate-y-2 transition-transform duration-500 w-full max-w-xl self-end">
              <div className="flex items-center px-4 py-2 border-b dark:border-white/5 border-black/5 bg-black/40">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                </div>
              </div>
              <div className="p-4 font-mono text-xs md:text-sm dark:text-white/80 text-slate-500 overflow-hidden text-left dark:bg-[#09090b] bg-white">
                <span className="text-pink-400">import</span> { '{' } <span className="text-cyan-300">MCPServer</span> { '}' } <span className="text-pink-400">from</span> <span className="text-emerald-300">'@makinari/mcp'</span>;<br/><br/>
                <span className="text-pink-400">export default</span> <span className="text-blue-400">new</span> <span className="text-cyan-300">MCPServer</span>({ '{' }<br/>
                &nbsp;&nbsp;<span className="text-indigo-300">port</span>: <span className="text-orange-300">3000</span>,<br/>
                &nbsp;&nbsp;<span className="text-indigo-300">tools</span>: [{ '{' }<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-indigo-300">name</span>: <span className="text-emerald-300">'fetch_leads'</span>,<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-indigo-300">handler</span>: <span className="text-pink-400">async</span> () { '=>' } <span className="text-blue-400">await</span> <span className="text-cyan-300">db</span>.<span className="text-indigo-300">query</span>(<span className="text-emerald-300">'SELECT * FROM leads'</span>)<br/>
                &nbsp;&nbsp;{ '}' }]<br/>
                { '}' });
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Grid like Zapier */}
      <IntegrationGrid />

      {/* Global Animations for OmniChannel Component */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin-super-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-super-slow { animation: spin-super-slow 40s linear infinite; }
      `}} />

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
