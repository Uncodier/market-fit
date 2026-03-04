"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"

export function ApiClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            Developers
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            Connect Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Systems & AI</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            The Makinari platform is fully programmable. Connect your AI models directly through our MCP Server or build custom integrations with our REST API.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row gap-12 w-full">
        
        {/* MCP Server Card */}
        <div className="flex-1 rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col border border-black/5 dark:border-white/5 transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.1),transparent_50%)]"></div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6 self-start">
              Model Context Protocol
            </div>
            <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">MCP Server</h3>
            <p className="dark:text-white/50 text-slate-500 leading-relaxed text-sm md:text-base mb-8">
              The Model Context Protocol (MCP) server enables you to expose your tools and resources to AI models, facilitating seamless integration and context-aware interactions. Makinari's MCP server exposes over 30 tools covering messaging, lead management, content, campaigns, and reports.
            </p>

            <div className="mt-auto bg-black/5 dark:bg-white/5 p-4 rounded-lg font-mono text-sm dark:text-white/80 text-slate-700 mb-8 border border-black/5 dark:border-white/10">
              <span className="text-pink-400">import</span> { '{' } <span className="text-cyan-400">MCPServer</span> { '}' } <span className="text-pink-400">from</span> <span className="text-emerald-400">'@makinari/mcp'</span>;<br/><br/>
              <span className="dark:text-white/30 text-black/30">// Start server or connect remotely</span><br/>
              <span className="text-pink-400">export default</span> <span className="text-blue-400">new</span> <span className="text-cyan-400">MCPServer</span>({ '{' }<br/>
              &nbsp;&nbsp;<span className="text-indigo-400">port</span>: <span className="text-orange-400">3000</span><br/>
              { '}' });
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://docs.makinari.com/mcp-server" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:scale-105 active:scale-95">
                Read MCP Docs
              </a>
              <a href="https://github.com/Makinari/API" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-all hover:scale-105 active:scale-95">
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* REST API Card */}
        <div className="flex-1 rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 md:p-12 flex flex-col border border-black/5 dark:border-white/5 transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.1),transparent_50%)]"></div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="inline-flex items-center rounded-full dark:neu-black-chip-inward neu-white-chip-inward px-3 py-1 text-xs font-bold mb-6 self-start">
              Programmatic Access
            </div>
            <h3 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">REST API</h3>
            <p className="dark:text-white/50 text-slate-500 leading-relaxed text-sm md:text-base mb-8">
              The Makinari REST API allows you to programmatically interact with the platform's core features. Manage robots, finder, and site visitors effortlessly. All endpoints are secured and versioned.
            </p>

            <div className="mt-auto bg-black/5 dark:bg-white/5 p-4 rounded-lg font-mono text-sm dark:text-white/80 text-slate-700 mb-8 border border-black/5 dark:border-white/10">
              <span className="dark:text-white/30 text-black/30">// Example cURL request</span><br/>
              <span className="text-pink-400">curl</span> -X GET \<br/>
              &nbsp;&nbsp;<span className="text-emerald-400">"https://api.makinari.io/v1/robots"</span> \<br/>
              &nbsp;&nbsp;-H <span className="text-emerald-400">"Authorization: Bearer YOUR_API_KEY"</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a href="https://docs.makinari.com/rest-api" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-105 active:scale-95">
                Read API Reference
              </a>
              <a href="https://docs.makinari.com/first-steps/api-keys" target="_blank" rel="noreferrer" className="flex-1 py-3 px-6 rounded-full text-center text-sm font-bold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-all hover:scale-105 active:scale-95">
                Get API Key
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
