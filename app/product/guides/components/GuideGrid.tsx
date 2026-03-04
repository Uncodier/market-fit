"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { guides } from "../guides-data"
import { glossaryTerms } from "../glossary-data"
import { ArrowRight } from "@/app/components/ui/icons"

export function GuideGrid() {
  return (
    <React.Suspense fallback={<div className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full flex justify-center"><div className="animate-pulse w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/50"></div></div>}>
      <GuideGridContent />
    </React.Suspense>
  )
}

function GuideGridContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('category')
  
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState(categoryParam || "All")

  const categories = ["All", "Strategy", "Outbound", "Inbound", "Sales", "Marketing", "Glossary"]

  const isGlossary = activeCategory === "Glossary"

  const filteredGuides = guides.filter(guide => {
    const matchesSearch = guide.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          guide.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = guide.categories?.includes(activeCategory) || guide.category === activeCategory
    
    return matchesSearch && matchesCategory
  })

  const filteredTerms = glossaryTerms.filter(item => 
    item.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full border-t dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-white" id="glossary">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">
            Explore Guides
          </h2>
          <p className="dark:text-white/50 text-slate-500 text-lg max-w-xl">
            Actionable tactics and comprehensive resources for growth.
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
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0a0a0c] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:text-white transition-all shadow-sm"
            placeholder={isGlossary ? "Search terms..." : "Search guides..."}
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
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1">
          {isGlossary ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTerms.length > 0 ? (
                filteredTerms.map((item) => (
                  <Link 
                    key={item.id}
                    href={`/product/guides/glossary/${item.id}`}
                    className="p-6 rounded-2xl dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 hover:border-blue-500/30 dark:hover:border-blue-500/30 transition-all duration-300 group block"
                  >
                    <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-3 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                      {item.term}
                    </h3>
                    <p className="text-sm dark:text-slate-400 text-slate-500 leading-relaxed">
                      {item.definition}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border border-dashed dark:border-white/10 border-black/10 rounded-2xl">
                  <div className="w-16 h-16 rounded-full dark:bg-white/5 bg-slate-100 flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-slate-400">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-2">No terms found</h3>
                  <p className="dark:text-slate-400 text-slate-500 max-w-sm">
                    We couldn't find any terms matching "{searchQuery}". Try adjusting your search term.
                  </p>
                </div>
              )}
            </div>
          ) : (
            filteredGuides.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGuides.map(guide => {
                  const colorClass = getColorClasses(guide.color || '')
                  
                  return (
                    <Link 
                      href={`/product/guides/${guide.id}`}
                      key={guide.id}
                      className={`group relative p-6 rounded-2xl dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 transition-all duration-300 flex flex-col h-full cursor-pointer hover:shadow-lg ${colorClass}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-black/50 border dark:border-white/5 border-black/5 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                          {React.cloneElement(guide.icon as React.ReactElement, { className: `w-6 h-6 ${colorClass.split(' ')[0]}` })}
                        </div>
                        {guide.status === 'beta' && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                            Beta
                          </span>
                        )}
                        {guide.status === 'coming_soon' && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                            Soon
                          </span>
                        )}
                      </div>
                      
                      <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-1 group-hover:text-current transition-colors">
                        {guide.name}
                      </h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-3 flex flex-wrap items-center gap-1.5">
                        {guide.categories?.filter(c => c !== 'All').map((cat, i) => (
                          <span key={i} className="uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px]">{cat}</span>
                        ))}
                      </div>
                      
                      <p className="text-sm dark:text-slate-400 text-slate-500 leading-relaxed flex-1">
                        {guide.description}
                      </p>
                      
                      <div className="mt-6 flex items-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 duration-300">
                        Read guide
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="w-full py-20 flex flex-col items-center justify-center text-center border border-dashed dark:border-white/10 border-black/10 rounded-2xl">
                <div className="w-16 h-16 rounded-full dark:bg-white/5 bg-slate-100 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-slate-400">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-2">No guides found</h3>
                <p className="dark:text-slate-400 text-slate-500 max-w-sm">
                  We couldn't find any guides matching "{searchQuery}". Try adjusting your filters or search term.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}