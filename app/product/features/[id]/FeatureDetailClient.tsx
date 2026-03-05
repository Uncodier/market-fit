"use client"

import React from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { ChevronLeft, CheckCircle2, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"

export function FeatureDetailClient({ feature }: { feature: any }) {
  const { t } = useLocalization();
  // Color configuration based on feature color
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

  const theme = colorConfig[feature.color as keyof typeof colorConfig] || colorConfig.emerald;
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] ${theme.bgBlur} rounded-full blur-[100px] opacity-100 pointer-events-none`}></div>
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12">
          <Link href="/product/features" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            {t('features_page.detail.back') || 'Back to features'}
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-[#0f0f13] border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg p-4 flex-shrink-0">
              {React.cloneElement(feature.icon as React.ReactElement, { className: "w-full h-full object-contain" })}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {feature.name}
                </h1>
                {feature.status === 'beta' && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${theme.bgAccent}`}>
                    {t('features_page.detail.beta') || 'Beta'}
                  </span>
                )}
                {feature.status === 'coming_soon' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                    {t('features_page.detail.soon') || 'Soon'}
                  </span>
                )}
              </div>
              <div className={`font-medium mb-4 flex items-center gap-2 ${theme.textAccent}`}>
                <span className="font-semibold uppercase tracking-wider text-xs px-2 py-0.5 rounded border border-current">{t(`features_page.grid.stage_${feature.stage.toLowerCase()}`) || feature.stage}</span>
                <span>•</span>
                <span>{feature.category}</span>
              </div>
              <p className="text-lg md:text-xl dark:text-white/60 text-slate-500 max-w-2xl font-light leading-relaxed">
                {feature.description}
              </p>
            </div>
            
            <div className="w-full md:w-auto mt-4 md:mt-0 flex flex-col sm:flex-row md:flex-col gap-3">
              {feature.status === 'coming_soon' ? (
                <button 
                  className="px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  disabled
                >
                  {t('features_page.detail.join_waitlist') || 'Join Waitlist'}
                </button>
              ) : (
                <Link 
                  href="/auth?mode=register"
                  className={`px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center gap-2 group ${theme.btnPrimary}`}
                >
                  {t('features_page.detail.start_with_makinari') || 'Start with Makinari'}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
              <a 
                href="https://docs.makinari.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center"
              >
                {t('features_page.detail.read_docs') || 'Read Docs'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 max-w-5xl mx-auto px-6 lg:px-12 w-full flex-1 flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t('features_page.detail.about') || 'About this feature'}</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <p>
              {feature.name} {t('features_page.detail.about_desc_part1') || 'is a core capability within the'} {t(`features_page.grid.stage_${feature.stage.toLowerCase()}`) || feature.stage} {t('features_page.detail.about_desc_part2') || 'stage of Makinari. Designed to help revenue teams work more efficiently, this feature integrates seamlessly with the rest of the platform to create a unified workflow from end to end.'}
            </p>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('features_page.detail.key_capabilities') || 'Key Capabilities'}</h3>
            <ul className="space-y-3 mb-8">
              {[1, 2, 3].map((item) => (
                <li key={item} className="flex items-start">
                  <CheckCircle2 size={20} className={`${theme.checkColor} mr-3 mt-0.5 flex-shrink-0`} />
                  <span className="text-slate-600 dark:text-slate-300">
                    {t('features_page.detail.streamline') || 'Streamline your workflow and increase productivity with'} {feature.name} {t('features_page.detail.automation_capabilities') || 'automation capabilities.'}
                  </span>
                </li>
              ))}
            </ul>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('features_page.detail.why_matters') || 'Why it matters'}</h3>
            <p className="text-slate-600 dark:text-slate-300">
              {t('features_page.detail.why_matters_part1') || 'When using'} {feature.name}, {t('features_page.detail.why_matters_part2') || 'teams typically see a significant reduction in manual work and a corresponding increase in output. By keeping this functionality natively within Makinari, you eliminate the need for third-party point solutions and complicated API integrations.'}
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="p-6 rounded-2xl dark:bg-[#0f0f13] bg-slate-50 border dark:border-white/5 border-black/5">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('features_page.detail.feature_details') || 'Feature Details'}</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('features_page.detail.stage') || 'Stage'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t(`features_page.grid.stage_${feature.stage.toLowerCase()}`) || feature.stage}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('features_page.detail.category') || 'Category'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{feature.category}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('features_page.detail.availability') || 'Availability'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t('features_page.detail.included') || 'Included in all plans'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">{t('features_page.detail.status') || 'Status'}</span>
                <span className="font-medium capitalize text-slate-900 dark:text-white">
                  {t(`features_page.detail.status_${feature.status}`) || feature.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">{t('features_page.detail.resources') || 'Resources'}</h4>
              <Link href="#" className={`flex items-center text-sm font-medium transition-colors ${theme.textAccent} ${theme.hoverText}`}>
                {feature.name} {t('features_page.detail.setup_guide') || 'Setup Guide'}
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
