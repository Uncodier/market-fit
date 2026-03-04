"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { ChevronLeft, ArrowRight, BookOpen } from "@/app/components/ui/icons"
import Link from "next/link"

export function GlossaryDetailClient({ termData }: { termData: any }) {
  const colorConfig = {
    orange: {
      bgBlur: "bg-orange-500/10 dark:bg-orange-500/5",
      btnPrimary: "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]",
      textAccent: "text-orange-600 dark:text-orange-400",
      bgAccent: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
      hoverText: "hover:text-orange-700 dark:hover:text-orange-300"
    },
    blue: {
      bgBlur: "bg-blue-500/10 dark:bg-blue-500/5",
      btnPrimary: "bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]",
      textAccent: "text-blue-600 dark:text-blue-400",
      bgAccent: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      hoverText: "hover:text-blue-700 dark:hover:text-blue-300"
    },
    emerald: {
      bgBlur: "bg-emerald-500/10 dark:bg-emerald-500/5",
      btnPrimary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]",
      textAccent: "text-emerald-600 dark:text-emerald-400",
      bgAccent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      hoverText: "hover:text-emerald-700 dark:hover:text-emerald-300"
    },
    violet: {
      bgBlur: "bg-violet-500/10 dark:bg-violet-500/5",
      btnPrimary: "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]",
      textAccent: "text-violet-600 dark:text-violet-400",
      bgAccent: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
      hoverText: "hover:text-violet-700 dark:hover:text-violet-300"
    }
  };

  const theme = colorConfig[termData.color as keyof typeof colorConfig] || colorConfig.emerald;
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] ${theme.bgBlur} rounded-full blur-[100px] opacity-100 pointer-events-none`}></div>
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12">
          <Link href="/product/guides?category=Glossary" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            Back to Glossary
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className={`w-24 h-24 rounded-2xl bg-slate-50 dark:bg-[#0f0f13] border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg p-4 flex-shrink-0 ${theme.textAccent}`}>
              <BookOpen size={64} />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {termData.term}
                </h1>
              </div>
              <div className={`font-medium mb-4 flex items-center gap-2 ${theme.textAccent}`}>
                <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 rounded border border-current">{termData.category}</span>
              </div>
              <p className="text-lg md:text-xl dark:text-white/60 text-slate-500 max-w-2xl font-light leading-relaxed">
                {termData.definition}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 max-w-5xl mx-auto px-6 lg:px-12 w-full flex-1 flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Understanding {termData.term.split(' ')[0]}</h2>
            <p>
              This concept is a core element in modern Go-To-Market strategies. When effectively implemented, 
              it allows teams to align their efforts and measure success predictably.
            </p>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">Why it matters</h3>
            <p>
              Understanding and mastering <strong>{termData.term}</strong> enables your team to optimize conversion rates, 
              reduce friction in the buyer journey, and ultimately scale your business more efficiently.
            </p>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">Related Strategies</h3>
            <p className="text-slate-600 dark:text-slate-300">
              For practical ways to apply this within your own workflow, check out our related guides or 
              reach out to see how Makinari can automate these processes for you.
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="p-6 rounded-2xl dark:bg-[#0f0f13] bg-slate-50 border dark:border-white/5 border-black/5">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Term Details</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">Domain</span>
                <span className="font-medium text-slate-900 dark:text-white">{termData.category}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">Complexity</span>
                <span className="font-medium text-slate-900 dark:text-white">Fundamental</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">Want more help?</h4>
              <Link href="#" className={`flex items-center text-sm font-medium transition-colors ${theme.textAccent} ${theme.hoverText}`}>
                Talk to a GTM expert
                <ArrowRight size={14} className="ml-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
