"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"

import Link from "next/link"
import { ArrowRight } from "@/app/components/ui/icons"

export function ApiClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('api.hero.badge') || 'Developers'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('api.hero.title1') || 'Connect Your '} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{t('api.hero.title2') || 'Systems & AI'}</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            {t('api.hero.description') || 'The Makinari platform is fully programmable. Connect your AI models directly through our MCP Server or build custom integrations with our REST API.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4">
            <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 group">
              {t('api.hero.cta.start') || 'Start with Makinari'}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="https://docs.makinari.com/mcp-server" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
              {t('api.hero.cta.docs') || 'Read Docs'}
            </a>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row gap-12 w-full">
        
        {/* MCP Server Card */}
        <div className="flex-1 rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col border border-black/5 dark:border-white/5 transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.1),transparent_50%)]"></div>
          <div className="absolute inset-0 dark:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(6,182,212,0.1)_8px,rgba(6,182,212,0.1)_16px)] bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(6,182,212,0.05)_8px,rgba(6,182,212,0.05)_16px)] opacity-[0.03] pointer-events-none animate-pan-diagonal-fast"></div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6 self-start">
              {t('api.mcp.badge') || 'Model Context Protocol'}
            </div>
            <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('api.mcp.title') || 'MCP Server'}</h3>
            <p className="dark:text-white/50 text-slate-500 leading-relaxed text-sm md:text-base mb-8">
              {t('api.mcp.description') || "The Model Context Protocol (MCP) server enables you to expose your tools and resources to AI models, facilitating seamless integration and context-aware interactions. Makinari's MCP server exposes over 30 tools covering messaging, lead management, content, campaigns, and reports."}
            </p>

            <div className="mt-auto bg-black/5 dark:bg-white/5 p-4 rounded-lg font-mono text-sm dark:text-white/80 text-slate-700 mb-8 border border-black/5 dark:border-white/10">
              <span className="text-pink-400">import</span> { '{' } <span className="text-cyan-400">MCPServer</span> { '}' } <span className="text-pink-400">from</span> <span className="text-emerald-400">'@makinari/mcp'</span>;<br/><br/>
              <span className="dark:text-white/30 text-black/30">{t('api.mcp.code.comment') || '// Start server or connect remotely'}</span><br/>
              <span className="text-pink-400">export default</span> <span className="text-blue-400">new</span> <span className="text-cyan-400">MCPServer</span>({ '{' }<br/>
              &nbsp;&nbsp;<span className="text-indigo-400">port</span>: <span className="text-orange-400">3000</span><br/>
              { '}' });
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://docs.makinari.com/mcp-server" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:scale-105 active:scale-95">
                {t('api.mcp.cta.docs') || 'Read MCP Docs'}
              </a>
              <a href="https://github.com/Makinari/API" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-all hover:scale-105 active:scale-95">
                {t('api.mcp.cta.github') || 'View on GitHub'}
              </a>
            </div>
          </div>
        </div>

        {/* REST API Card */}
        <div className="flex-1 rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col border border-black/5 dark:border-white/5 transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.1),transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[repeating-radial-gradient(circle_at_top,transparent,transparent_10px,rgba(168,85,247,0.1)_10px,rgba(168,85,247,0.1)_20px)] opacity-[0.03] pointer-events-none animate-expand-waves"></div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6 self-start">
              {t('api.rest.badge') || 'Programmatic Access'}
            </div>
            <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">{t('api.rest.title') || 'REST API'}</h3>
            <p className="dark:text-white/50 text-slate-500 leading-relaxed text-sm md:text-base mb-8">
              {t('api.rest.description') || "The Makinari REST API allows you to programmatically interact with the platform's core features. Manage robots, finder, and site visitors effortlessly. All endpoints are secured and versioned."}
            </p>

            <div className="mt-auto bg-black/5 dark:bg-white/5 p-4 rounded-lg font-mono text-sm dark:text-white/80 text-slate-700 mb-8 border border-black/5 dark:border-white/10">
              <span className="dark:text-white/30 text-black/30">{t('api.rest.code.comment') || '// Example cURL request'}</span><br/>
              <span className="text-pink-400">curl</span> -X GET \<br/>
              &nbsp;&nbsp;<span className="text-emerald-400">"https://api.makinari.io/v1/robots"</span> \<br/>
              &nbsp;&nbsp;-H <span className="text-emerald-400">"Authorization: Bearer YOUR_API_KEY"</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://docs.makinari.com/rest-api" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-105 active:scale-95">
                {t('api.rest.cta.docs') || 'Read API Reference'}
              </a>
              <a href="https://docs.makinari.com/first-steps/api-keys" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-all hover:scale-105 active:scale-95">
                {t('api.rest.cta.keys') || 'Get API Key'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
