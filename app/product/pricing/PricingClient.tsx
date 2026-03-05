"use client"

import React from "react"
import { PricingSection } from "@/app/components/auth/sections/PricingSection"
import { FeatureComparisonTable } from "@/app/components/auth/sections/FeatureComparisonTable"
import { VariableCostsSection } from "@/app/components/auth/sections/VariableCostsSection"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"
import Link from "next/link"
import { ArrowRight } from "@/app/components/ui/icons"

export function PricingClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-8 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>
            {t('footer.product.pricing') || 'Pricing'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('pricing.page.title.start') || 'Simple, '}<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">{t('pricing.page.title.highlight') || 'Transparent'}</span>{t('pricing.page.title.end') || ' Pricing'}
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            {t('pricing.page.subtitle') || 'Start with a 12-month proof of concept. No hidden fees. Only pay for the usage you actually consume.'}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link href="/auth?mode=register" className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] flex items-center justify-center gap-2 group">
              Start with Makinari
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/product/partner-commissions" className="w-full sm:w-auto px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center">
              View Partner Commissions
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <PricingSection />
      
      {/* Comparison Table */}
      <FeatureComparisonTable />

      {/* Variable Costs & Examples */}
      <VariableCostsSection />

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
