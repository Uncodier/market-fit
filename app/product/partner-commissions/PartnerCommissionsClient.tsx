"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Check, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"

export function PartnerCommissionsClient() {
  const { t } = useLocalization()

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Link href="/product/pricing" className="inline-flex items-center gap-2 text-sm font-medium dark:text-white/50 text-slate-500 hover:dark:text-white hover:text-slate-900 mb-8 transition-colors">
            <ArrowRight className="rotate-180" size={16} />
            {t('partners.hero.back') || 'Back to Pricing'}
          </Link>
          
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            {t('partners.hero.badge') || 'Revenue Share Model'}
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('partners.hero.title1') || 'Variable Cost per'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">{t('partners.hero.title2') || 'Partner'}</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-3xl font-light leading-relaxed mb-8">
            {t('partners.hero.description') || 'Once you acquire a partner through our prospecting channels, the model becomes performance-based (Revenue Share). Discover our recommended commission structure to retain and incentivize your distributors.'}
          </p>
        </div>
      </section>

      {/* Tiers Section */}
      <section className="relative w-full py-24 dark:bg-[#030303] bg-white flex-1">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter dark:text-white text-slate-900 mb-4">
              {t('partners.tiers.title') || 'Commission Tiers'}
            </h2>
            <p className="text-md dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
              {t('partners.tiers.description') || 'This is the margin you typically yield to a partner for each closed sale, depending on their historical sales volume.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Tier 1 */}
            <div className="rounded-2xl dark:neu-base neu-base-light p-8 border dark:border-white/[0.06] border-black/5 hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-300 dark:bg-slate-700" />
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{t('partners.tier1.title') || 'Silver Partner'}</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 font-light">{t('partners.tier1.description') || 'For new distributors with initial volume.'}</p>
              </div>
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black dark:text-white text-slate-900">15%</span>
                  <span className="text-sm dark:text-white/50 text-slate-500 font-light">{t('partners.tier.perSale') || '/ sale'}</span>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  t('partners.tier1.feature1') || "Up to $10k MRR generated",
                  t('partners.tier1.feature2') || "Standard sales support",
                  t('partners.tier1.feature3') || "Access to partner portal",
                  t('partners.tier1.feature4') || "Basic marketing materials"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm dark:text-white/80 text-slate-600 font-light">
                    <Check size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tier 2 */}
            <div className="rounded-2xl dark:neu-base neu-base-light p-8 border dark:border-emerald-500/30 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:-translate-y-4 transition-transform duration-500 relative overflow-hidden group md:-translate-y-2 z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
              <div className="absolute top-6 right-6 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 backdrop-blur-md">
                {t('partners.tier2.badge') || 'Standard'}
              </div>
              <div className="mb-6 relative">
                <h3 className="text-2xl font-bold mb-2 dark:text-white text-slate-900">{t('partners.tier2.title') || 'Gold Partner'}</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 font-light">{t('partners.tier2.description') || 'The ideal breakeven point for constant growth.'}</p>
              </div>
              <div className="mb-8 relative">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black dark:text-white text-slate-900">20%</span>
                  <span className="text-sm dark:text-white/50 text-slate-500 font-light">{t('partners.tier.perSale') || '/ sale'}</span>
                </div>
              </div>
              <ul className="space-y-4 relative">
                {[
                  t('partners.tier2.feature1') || "$10k - $50k MRR generated",
                  t('partners.tier2.feature2') || "Priority sales support",
                  t('partners.tier2.feature3') || "MDF (Market Development Funds) 2%",
                  t('partners.tier2.feature4') || "Qualified lead sharing"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm dark:text-white/80 text-slate-600 font-light">
                    <Check size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tier 3 */}
            <div className="rounded-2xl dark:neu-base neu-base-light p-8 border dark:border-white/[0.06] border-black/5 hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 dark:text-white text-slate-900">{t('partners.tier3.title') || 'Platinum Partner'}</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 font-light">{t('partners.tier3.description') || 'For enterprise agencies and high-volume consultants.'}</p>
              </div>
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black dark:text-white text-slate-900">30%</span>
                  <span className="text-sm dark:text-white/50 text-slate-500 font-light">{t('partners.tier.perSale') || '/ sale'}</span>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  t('partners.tier3.feature1') || "+$50k MRR generated",
                  t('partners.tier3.feature2') || "Dedicated Account Manager",
                  t('partners.tier3.feature3') || "MDF (Market Development Funds) 5%",
                  t('partners.tier3.feature4') || "Optional white-label & Full API"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm dark:text-white/80 text-slate-600 font-light">
                    <Check size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
