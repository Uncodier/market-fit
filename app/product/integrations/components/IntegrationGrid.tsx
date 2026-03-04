"use client"

import React, { useState } from "react"
import Link from "next/link"
import { integrations, categories } from "../integrations-data"

export function IntegrationGrid() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")

  const filteredIntegrations = integrations.filter(integration => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          integration.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = activeCategory === "All" || integration.category === activeCategory
    
    return matchesSearch && matchesCategory
  })

  return (
    <section className="py-24 max-w-7xl mx-auto px-6 lg:px-12 w-full border-t dark:border-white/[0.04] border-black/5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 mb-4 tracking-tight">
            Explore Integrations
          </h2>
          <p className="dark:text-white/50 text-slate-500 text-lg max-w-xl">
            Over 100+ integrations available. Connect your tools and automate your workflows in minutes.
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
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0a0a0c] border border-black/10 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 dark:text-white transition-all shadow-sm"
            placeholder="Search apps..."
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
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
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
          {filteredIntegrations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredIntegrations.map(app => (
                <Link 
                  href={`/product/integrations/${app.id}`}
                  key={app.id}
                  className="group relative p-6 rounded-2xl dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all duration-300 hover:shadow-lg dark:hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] flex flex-col h-full cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-black/50 border dark:border-white/5 border-black/5 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                      {app.icon}
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {app.isOpenClaw && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                          Open Claw
                        </span>
                      )}
                      {app.status === 'beta' && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                          Beta
                        </span>
                      )}
                      {app.status === 'coming_soon' && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10">
                          Soon
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-1">
                    {app.name}
                  </h3>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-3">
                    {app.category}
                  </div>
                  
                  <p className="text-sm dark:text-slate-400 text-slate-500 leading-relaxed flex-1">
                    {app.description}
                  </p>
                  
                  <div className="mt-6 flex items-center text-sm font-medium text-slate-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                    Connect
                    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="w-full py-20 flex flex-col items-center justify-center text-center border border-dashed dark:border-white/10 border-black/10 rounded-2xl">
              <div className="w-16 h-16 rounded-full dark:bg-white/5 bg-slate-100 flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-slate-400">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h3 className="text-lg font-bold dark:text-white text-slate-900 mb-2">No integrations found</h3>
              <p className="dark:text-slate-400 text-slate-500 max-w-sm">
                We couldn't find any integrations matching "{searchQuery}". Try adjusting your filters or search term.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-20 pt-10 border-t dark:border-white/10 border-black/10 flex flex-col md:flex-row items-center justify-between gap-6 bg-slate-50 dark:bg-white/[0.02] p-8 rounded-2xl">
        <div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-2">Can't find what you're looking for?</h3>
          <p className="dark:text-slate-400 text-slate-500 max-w-lg text-sm">
            We're constantly adding new integrations. Let us know which app you want us to connect next, or build it yourself using our open API.
          </p>
        </div>
        <div className="flex gap-4">
          <a href="mailto:contact@makinari.com?subject=App%20Integration%20Request" className="px-6 py-2.5 rounded-full dark:bg-white bg-slate-900 dark:text-black text-white text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap">
            Request App
          </a>
          <a href="https://docs.makinari.com/rest-api" target="_blank" rel="noreferrer" className="px-6 py-2.5 rounded-full dark:bg-white/10 bg-black/5 dark:text-white text-slate-900 text-sm font-bold hover:bg-black/10 dark:hover:bg-white/20 transition-all whitespace-nowrap">
            View API Docs
          </a>
        </div>
      </div>
    </section>
  )
}
