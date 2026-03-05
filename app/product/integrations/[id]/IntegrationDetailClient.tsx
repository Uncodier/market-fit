"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { ChevronLeft, CheckCircle2, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"

export function IntegrationDetailClient({ integration }: { integration: any }) {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12">
          <Link href="/product/integrations" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white mb-8 transition-colors">
            <ChevronLeft size={16} className="mr-1" />
            {t('integrations.detail.back') || 'Back to integrations'}
          </Link>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
            <div className="w-24 h-24 rounded-2xl bg-slate-50 dark:bg-[#0f0f13] border dark:border-white/10 border-black/10 flex items-center justify-center shadow-lg p-4 flex-shrink-0">
              {React.cloneElement(integration.icon as React.ReactElement, { className: "w-full h-full object-contain" })}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {integration.name}
                </h1>
                {integration.isOpenClaw && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                    {t('common.openclaw') || 'Open Claw'}
                  </span>
                )}
                {integration.isCore && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    {t('common.core') || 'Core'}
                  </span>
                )}
                {integration.status === 'beta' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                    {t('common.beta') || 'Beta'}
                  </span>
                )}
                {integration.status === 'coming_soon' && (
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                    {t('common.soon') || 'Soon'}
                  </span>
                )}
              </div>
              <div className="text-emerald-600 dark:text-emerald-400 font-medium mb-4">
                {t(`integrations.categories.${integration.category?.toLowerCase().replace(' & ', '')}`) || integration.category}
              </div>
              <p className="text-lg md:text-xl dark:text-white/60 text-slate-500 max-w-2xl font-light leading-relaxed">
                {integration.description}
              </p>
            </div>
            
            <div className="w-full md:w-auto mt-4 md:mt-0 flex flex-col sm:flex-row md:flex-col gap-3">
              {integration.status === 'coming_soon' ? (
                <button 
                  className="px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  disabled
                >
                  {t('integrations.detail.joinWaitlist') || 'Join Waitlist'}
                </button>
              ) : (
                <Link 
                  href="/auth?mode=register"
                  className="px-8 py-3.5 rounded-full font-inter font-bold transition-all shadow-sm flex items-center justify-center gap-2 group bg-emerald-500 hover:bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                >
                  {t('integrations.detail.start') || 'Start with Makinari'}
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              )}
              <a 
                href="https://docs.makinari.com"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-3.5 rounded-full font-inter font-bold dark:bg-white/5 bg-black/5 hover:dark:bg-white/10 hover:bg-black/10 dark:text-white text-slate-900 transition-colors border dark:border-white/10 border-black/10 flex items-center justify-center text-center"
              >
                {t('integrations.detail.readDocs') || 'Read Docs'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 max-w-5xl mx-auto px-6 lg:px-12 w-full flex-1 flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">{t('integrations.detail.about') || 'About this integration'}</h2>
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300">
            <p>
              {t('integrations.detail.connectWith') || 'Connect Makinari with '} {integration.name} {t('integrations.detail.aboutDescription') || ' to streamline your workflow and automate tasks across both platforms. Our deep integration allows you to sync data in real-time, trigger actions based on events, and manage everything from a single dashboard.'}
            </p>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('integrations.detail.keyFeatures') || 'Key Features'}</h3>
            <ul className="space-y-3 mb-8">
              {[1, 2, 3].map((item) => (
                <li key={item} className="flex items-start">
                  <CheckCircle2 size={20} className="text-emerald-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">
                    {t('integrations.detail.syncYour') || 'Sync your '} {integration.name} {t('integrations.detail.syncDescription') || ' data with Makinari in real-time to keep your team aligned.'}
                  </span>
                </li>
              ))}
            </ul>
            
            <h3 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-white">{t('integrations.detail.howItWorks') || 'How it works'}</h3>
            <p className="text-slate-600 dark:text-slate-300">
              {t('integrations.detail.setup') || 'Setting up the '} {integration.name} {t('integrations.detail.setupDescription') || ' integration takes just a few clicks. Once connected, you can configure specific rules and triggers to customize how data flows between the two platforms.'}
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-80 flex-shrink-0">
          <div className="p-6 rounded-2xl dark:bg-[#0f0f13] bg-slate-50 border dark:border-white/5 border-black/5">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">{t('integrations.detail.details') || 'Integration Details'}</h3>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('integrations.detail.developer') || 'Developer'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t('integrations.detail.makinariTeam') || 'Makinari Team'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('integrations.detail.category') || 'Category'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t(`integrations.categories.${integration.category?.toLowerCase().replace(' & ', '')}`) || integration.category}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b dark:border-white/5 border-black/5">
                <span className="text-slate-500">{t('integrations.detail.pricing') || 'Pricing'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{t('integrations.detail.included') || 'Included in all plans'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500">{t('integrations.detail.requirements') || 'Requirements'}</span>
                <span className="font-medium text-slate-900 dark:text-white">{integration.name} {t('integrations.detail.account') || ' Account'}</span>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3">{t('integrations.detail.support') || 'Support'}</h4>
              <Link href="#" className="flex items-center text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors">
                {t('integrations.detail.setupGuide') || 'Integration Setup Guide'}
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
