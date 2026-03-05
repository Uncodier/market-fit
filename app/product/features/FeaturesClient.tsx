"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { FeatureGrid } from "./components/FeatureGrid"
import { MockupSlider } from "@/app/components/auth/sections/MockupSlider"
import Link from "next/link"
import { ArrowRight } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function FeaturesClient() {
  const { t } = useLocalization()

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
            {t('features_page.badge') || 'Features'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('features_page.title_prefix') || 'Complete Toolkit for'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500">{t('features_page.title_highlight') || 'Revenue Operations'}</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            {t('features_page.subtitle') || 'Everything you need to automate your entire sales process, from lead generation to closing deals.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-violet-500 hover:bg-violet-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] flex items-center justify-center gap-2 group">
                {t('features_page.start_button') || 'Start with Makinari'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/product/use-cases" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
                {t('features_page.view_use_cases') || 'View Use Cases'}
              </Link>
          </div>
        </div>
      </section>

      {/* Dynamic Slider Section */}
      <section className="relative w-full py-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-slate-50/50">
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12">
          <MockupSlider />
        </div>
      </section>

      {/* Feature Grid Directory */}
      <FeatureGrid />

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
