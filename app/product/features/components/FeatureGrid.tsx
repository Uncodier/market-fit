"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { features } from "../features-data"
import { ArrowRight } from "@/app/components/ui/icons"

export function FeatureGrid() {
  return (
    <React.Suspense fallback={<div className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/50"></div></div>}>
      <FeatureGridContent />
    </React.Suspense>
  )
}

function FeatureGridContent() {
  const { t } = useLocalization();
  const searchParams = useSearchParams()
  const stageParam = searchParams.get('stage')
  
  const [searchQuery, setSearchQuery] = useState("")
  const [activeStage, setActiveStage] = useState(stageParam || "All")

  const stages = ["All", "Find", "Contact", "Sell", "Manage"]

  const filteredFeatures = features.filter(feature => {
    const matchesSearch = feature.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          feature.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStage = activeStage === "All" || feature.stage === activeStage
    
    return matchesSearch && matchesStage
  })

  // Color mappings for different stages
  const getColorClasses = (color: string) => {
    switch(color) {
      case 'orange': return 'text-orange-500 hover:border-orange-500/50 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.1)]';
      case 'blue': return 'text-blue-500 hover:border-blue-500/50 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]';
      case 'emerald': return 'text-emerald-500 hover:border-emerald-500/50 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]';
      case 'violet': return 'text-violet-500 hover:border-violet-500/50 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.1)]';
      default: return 'text-slate-500 hover:border-slate-500/50 group-hover:shadow-[0_0_15px_rgba(148,163,184,0.1)]';
    }
  }

  return (
    <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full border-t dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">
            {t('features_page.grid.title') || 'Explore All Features'}
          </h2>
          <p className="dark:text-white/50 text-slate-500 text-lg max-w-xl">
            {t('features_page.grid.subtitle') || 'Browse through our complete toolkit designed to automate your entire revenue operations process.'}
          </p>
        </div>
        
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0a0a0c] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 dark:text-white transition-all shadow-sm"
            placeholder={t('features_page.grid.search_placeholder') || "Search features..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Categories (Stages) */}
        <div className="w-full lg:w-48 flex-shrink-0">
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 gap-1.5 scrollbar-hide">
            {stages.map(stage => (
              <button
                key={stage}
                onClick={() => setActiveStage(stage)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  activeStage === stage
                    ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                }`}
              >
                {stage === 'All' ? (t('features_page.grid.all_features') || 'All Features') : (t(`features_page.grid.stage_${stage.toLowerCase()}`) || stage)}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1">
          {filteredFeatures.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFeatures.map(feature => {
                const colorClass = getColorClasses(feature.color || '')
                
                return (
                  <Link 
                    href={`/product/features/${feature.id}`}
                    key={feature.id}
                    className={`group relative p-6 rounded-2xl dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 transition-all duration-300 flex flex-col h-full cursor-pointer hover:shadow-lg ${colorClass}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-slate-50 dark:bg-black/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                        {React.cloneElement(feature.icon as React.ReactElement, { className: `w-6 h-6 ${colorClass.split(' ')[0]}` })}
                      </div>
                      {feature.status === 'beta' && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                          {t('features_page.grid.beta') || 'Beta'}
                        </span>
                      )}
                      {feature.status === 'coming_soon' && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                          {t('features_page.grid.soon') || 'Soon'}
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-1 group-hover:text-current transition-colors">
                      {feature.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 flex items-center gap-1.5">
                      <span className="uppercase tracking-wider">{t(`features_page.grid.stage_${feature.stage.toLowerCase()}`) || feature.stage}</span>
                      <span>•</span>
                      <span>{feature.category}</span>
                    </div>
                    
                    <p className="text-sm dark:text-slate-400 text-slate-500 leading-relaxed flex-1">
                      {feature.description}
                    </p>
                    
                    <div className="mt-6 flex items-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 duration-300">
                      {t('features_page.grid.learn_more') || 'Learn more'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="w-full py-20 flex flex-col items-center justify-center text-center border border-dashed dark:border-white/10 border-black/10 rounded-2xl">
              <div className="w-16 h-16 rounded-full font-inter font-bold dark:bg-white/5 bg-slate-100 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-slate-400">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-2">{t('features_page.grid.no_features') || 'No features found'}</h3>
              <p className="dark:text-slate-400 text-slate-500 max-w-sm">
                {t('features_page.grid.no_features_desc_part1') || "We couldn't find any features matching"} "{searchQuery}". {t('features_page.grid.no_features_desc_part2') || "Try adjusting your filters or search term."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
