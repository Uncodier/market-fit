"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useCases } from "../use-cases-data"
import { ArrowRight } from "@/app/components/ui/icons"

export function UseCaseGrid() {
  return (
    <React.Suspense fallback={<div className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/50"></div></div>}>
      <UseCaseGridContent />
    </React.Suspense>
  )
}

function UseCaseGridContent() {
  const { t } = useLocalization()
  
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState(categoryParam || "All")

  const categories = ["All", "Solopreneurs", "SMBs", "Startups", "Scale Ups", "Enterprise", "B2B", "B2C", "B2B2B", "B2B2C"]

  const categoryDetails: Record<string, { title: string, description: string }> = {
    "All": {
      title: t('useCases.categories.all.title') || "All Models & Industries",
      description: t('useCases.categories.all.desc') || "Explore how Makinari adapts to any business model, providing AI-driven solutions to multiply your operational capacity and scale your go-to-market strategy."
    },
    "Solopreneurs": {
      title: t('useCases.categories.solopreneurs.title') || "Solopreneurs",
      description: t('useCases.categories.solopreneurs.desc') || "Multiply yourself. Automate your prospecting, client qualification, and follow-ups so you can focus on delivering value instead of chasing leads."
    },
    "SMBs": {
      title: t('useCases.categories.smbs.title') || "Small & Medium Businesses",
      description: t('useCases.categories.smbs.desc') || "Build a scalable sales and support engine without the overhead of hiring large commercial teams. Makinari agents work 24/7 to keep your pipeline full."
    },
    "Startups": {
      title: t('useCases.categories.startups.title') || "Startups",
      description: t('useCases.categories.startups.desc') || "Find Product-Market Fit faster. Rapidly test different messaging, target audiences, and outbound strategies to acquire your first users and scale efficiently."
    },
    "Scale Ups": {
      title: t('useCases.categories.scaleUps.title') || "Scale Ups",
      description: t('useCases.categories.scaleUps.desc') || "Pour fuel on the fire. Automate complex sales sequences, standardize your outreach, and handle massive lead volumes as you expand into new markets."
    },
    "Enterprise": {
      title: t('useCases.categories.enterprise.title') || "Enterprise Solutions",
      description: t('useCases.categories.enterprise.desc') || "Deploy robust, secure, and compliant AI agents across multiple departments. Streamline operations, reduce CAC at scale, and enhance customer experience."
    },
    "B2B": {
      title: t('useCases.categories.b2b.title') || "B2B Go-To-Market",
      description: t('useCases.categories.b2b.desc') || "Master complex sales cycles. Use Makinari to identify key decision-makers, personalize your cold outreach, and nurture high-value accounts automatically."
    },
    "B2C": {
      title: t('useCases.categories.b2c.title') || "B2C Go-To-Market",
      description: t('useCases.categories.b2c.desc') || "Engage thousands of users instantly. Automate onboarding, handle customer support inquiries, and drive conversion rates with personalized AI interactions."
    },
    "B2B2B": {
      title: t('useCases.categories.b2b2b.title') || "B2B2B Models",
      description: t('useCases.categories.b2b2b.desc') || "Manage multi-tiered distribution channels. Empower your partners and distributors with AI agents that help them sell your products more effectively."
    },
    "B2B2C": {
      title: t('useCases.categories.b2b2c.title') || "B2B2C Models",
      description: t('useCases.categories.b2b2c.desc') || "Bridge the gap between businesses and end consumers. Automate interactions across the entire value chain, from partner acquisition to consumer support."
    }
  }

  const filteredUseCases = useCases.filter(useCase => {
    const matchesSearch = useCase.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          useCase.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = useCase.categories?.includes(activeCategory) || useCase.category === activeCategory
    
    return matchesSearch && matchesCategory
  })

  // Color mappings
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
            {t('useCases.grid.title') || 'Explore Use Cases'}
          </h2>
          <p className="dark:text-white/50 text-slate-500 text-lg max-w-xl">
            {t('useCases.grid.subtitle') || 'See exactly how Makinari can transform your unique go-to-market strategy.'}
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
            placeholder={t('useCases.grid.search') || "Search use cases..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Categories */}
        <div className="w-full lg:w-48 flex-shrink-0">
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 gap-1.5 scrollbar-hide">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  activeCategory === category
                    ? "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                }`}
              >
                {category === 'All' ? (t('useCases.categories.all') || 'All Models') : categoryDetails[category]?.title || category}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Dynamic Category Header */}
          <div className="relative mb-8 min-h-[160px] md:min-h-[140px] rounded-2xl dark:bg-white/[0.03] bg-slate-50 border dark:border-white/10 border-black/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-transparent to-fuchsia-500/10 opacity-70"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/20 dark:bg-violet-500/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
            
            <div className="relative p-6 md:p-8 h-full flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="inline-flex items-center rounded-full dark:bg-white/10 bg-black/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider mb-3 text-violet-700 dark:text-violet-300 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
                    {activeCategory === 'All' ? (t('useCases.categories.all.overview') || 'Overview') : (categoryDetails[activeCategory]?.title || activeCategory)}
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold dark:text-white text-slate-900 mb-2 tracking-tight">
                    {categoryDetails[activeCategory]?.title || activeCategory}
                  </h3>
                  <p className="text-sm md:text-base dark:text-slate-400 text-slate-600 leading-relaxed max-w-2xl">
                    {categoryDetails[activeCategory]?.description || (t('useCases.categories.default.desc') || "Explore use cases for this category.")}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Grid */}
          {filteredUseCases.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredUseCases.map(useCase => {
                const colorClass = getColorClasses(useCase.color || '')
                
                return (
                <Link 
                  href={`/product/use-cases/${useCase.id}`}
                  key={useCase.id}
                  className={`group relative p-6 rounded-2xl dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 transition-all duration-300 flex flex-col h-full cursor-pointer hover:shadow-lg ${colorClass}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl dark:neu-pressed neu-pressed-light border dark:border-white/5 border-black/5 bg-slate-50 dark:bg-black/50 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      {React.cloneElement(useCase.icon as React.ReactElement, { className: `w-6 h-6 ${colorClass.split(' ')[0]}` })}
                    </div>
                    {useCase.status === 'beta' && (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                        {t('common.beta') || 'Beta'}
                      </span>
                    )}
                    {useCase.status === 'coming_soon' && (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                        {t('common.soon') || 'Soon'}
                      </span>
                    )}
                  </div>
                    
                    <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-1 group-hover:text-current transition-colors">
                      {useCase.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 flex flex-wrap items-center gap-1.5">
                      {useCase.categories?.filter(c => c !== 'All').map((cat, i) => (
                        <span key={i} className="uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px]">
                          {categoryDetails[cat]?.title || cat}
                        </span>
                      ))}
                    </div>
                    
                    <p className="text-sm dark:text-slate-400 text-slate-500 leading-relaxed flex-1">
                      {useCase.description}
                    </p>
                    
                    <div className="mt-6 flex items-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 duration-300">
                      {t('useCases.grid.viewUseCase') || 'View use case'}
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
              <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-2">{t('useCases.grid.empty.title') || 'No use cases found'}</h3>
              <p className="dark:text-slate-400 text-slate-500 max-w-sm">
                {t('useCases.grid.empty.subtitle') || "We couldn't find any use cases matching"} "{searchQuery}". {t('useCases.grid.empty.tryAgain') || "Try adjusting your filters or search term."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
