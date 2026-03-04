"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { ChevronLeft, CheckCircle2, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"

export function UseCaseDetailClient({ useCase }: { useCase: any }) {
  // Configuración de colores basada en el color de la feature
  const colorConfig = {
    orange: {
      bgBlur: "bg-orange-500/10 dark:bg-orange-500/5",
      btnPrimary: "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]",
      textAccent: "text-orange-600 dark:text-orange-400",
      bgAccent: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400 border-orange-200 dark:border-orange-500/20",
      checkColor: "text-orange-500",
      hoverText: "hover:text-orange-700 dark:hover:text-orange-300"
    },
    blue: {
      bgBlur: "bg-blue-500/10 dark:bg-blue-500/5",
      btnPrimary: "bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]",
      textAccent: "text-blue-600 dark:text-blue-400",
      bgAccent: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
      checkColor: "text-blue-500",
      hoverText: "hover:text-blue-700 dark:hover:text-blue-300"
    },
    emerald: {
      bgBlur: "bg-emerald-500/10 dark:bg-emerald-500/5",
      btnPrimary: "bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]",
      textAccent: "text-emerald-600 dark:text-emerald-400",
      bgAccent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20",
      checkColor: "text-emerald-500",
      hoverText: "hover:text-emerald-700 dark:hover:text-emerald-300"
    },
    violet: {
      bgBlur: "bg-violet-500/10 dark:bg-violet-500/5",
      btnPrimary: "bg-violet-500 hover:bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]",
      textAccent: "text-violet-600 dark:text-violet-400",
      bgAccent: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border-violet-200 dark:border-violet-500/20",
      checkColor: "text-violet-500",
      hoverText: "hover:text-violet-700 dark:hover:text-violet-300"
    }
  };

  const theme = colorConfig[useCase.color as keyof typeof colorConfig] || colorConfig.emerald;
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] ${theme.bgBlur} rounded-full blur-[100px] opacity-100 pointer-events-none`}></div>
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12">
          <Link href="/product/use-cases" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            Back to Use Cases
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-[#0f0f13] border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg p-4 flex-shrink-0">
              {React.cloneElement(useCase.icon as React.ReactElement, { className: "w-full h-full object-contain" })}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {useCase.name}
                </h1>
                {useCase.status === 'beta' && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.bgAccent}`}>
                    Beta
                  </span>
                )}
                {useCase.status === 'coming_soon' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                    Soon
                  </span>
                )}
              </div>
              <div className={`font-medium mb-4 flex items-center gap-2 ${theme.textAccent}`}>
                <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 rounded border border-current">{useCase.category}</span>
              </div>
              <p className="text-lg md:text-xl dark:text-white/60 text-slate-500 max-w-2xl font-light leading-relaxed">
                {useCase.description}
              </p>
            </div>
            
            <div className="w-full md:w-auto mt-4 md:mt-0 flex flex-col sm:flex-row md:flex-col gap-3">
              {useCase.status === 'coming_soon' ? (
                <button 
                  className="px-8 py-3.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  disabled
                >
                  Join Waitlist
                </button>
              ) : (
                <Link 
                  href="/auth"
                  className={`px-8 py-3.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center ${theme.btnPrimary}`}
                >
                  Start with Makinari
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 max-w-5xl mx-auto px-6 lg:px-12 w-full flex-1 flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">How Makinari helps {useCase.name}</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <p>
              Makinari empowers {useCase.name.toLowerCase()} businesses by providing an automated Go-To-Market 
              infrastructure. By using advanced AI agents, you can completely transform your {useCase.category} strategy, 
              generate more qualified leads, and close deals faster without adding headcount.
            </p>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">Key Workflows</h3>
            <ul className="space-y-3 mb-8">
              {[1, 2, 3].map((item) => (
                <li key={item} className="flex items-start">
                  <CheckCircle2 size={20} className={`${theme.checkColor} mr-3 mt-0.5 flex-shrink-0`} />
                  <span className="text-slate-600 dark:text-slate-300">
                    Set up personalized, automated outreach tailored precisely for your ideal customer profile.
                  </span>
                </li>
              ))}
            </ul>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">Expected Outcomes</h3>
            <p className="text-slate-600 dark:text-slate-300">
              Businesses in the {useCase.name} sector typically see an increase in booked meetings 
              within the first month of implementing Makinari. Our platform handles the repetitive 
              prospecting work, allowing your team to focus on building relationships and closing.
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="p-6 rounded-2xl dark:bg-[#0f0f13] bg-slate-50 border dark:border-white/5 border-black/5">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Implementation Details</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">Model</span>
                <span className="font-medium text-slate-900 dark:text-white">{useCase.category}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">Time to Value</span>
                <span className="font-medium text-slate-900 dark:text-white">Under 2 weeks</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">Supported</span>
                <span className="font-medium text-slate-900 dark:text-white">All Plans</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">Questions?</h4>
              <Link href="#" className={`flex items-center text-sm font-medium transition-colors ${theme.textAccent} ${theme.hoverText}`}>
                Talk to an industry expert
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
