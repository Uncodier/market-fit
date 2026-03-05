"use client"

import React from "react"
import Link from "next/link"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"
import { changelogData } from "./changelog-data"

export default function ChangelogPage() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-indigo-500/30 flex flex-col overflow-hidden min-h-screen">
      
      {/* Main Content */}
      <section className="pt-24 pb-12 max-w-5xl mx-auto px-6 lg:px-12 flex-1 w-full relative z-10">
        <div className="mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-slate-900 dark:text-white">
            {t('changelog.title') || 'Changelog'}
          </h1>
          <p className="text-lg dark:text-white/60 text-slate-500 font-medium">
            {t('changelog.subtitle') || 'New updates and improvements to Makinari.'}
          </p>
        </div>
        <div className="space-y-16 md:space-y-20 relative">
          
          {changelogData.map((release, index) => (
            <div key={index} className="flex flex-col md:flex-row gap-6 md:gap-16 relative group z-10">
              
              {/* Left Side: Date */}
              <div className="md:w-32 flex-shrink-0 pt-4 flex flex-col items-start md:items-start relative">
                <span className="text-sm font-bold text-slate-800 dark:text-white mb-1">{release.date}</span>
                <span className="text-xs text-slate-500 dark:text-white/50">{release.date}</span>
              </div>

              {/* Right Side: Card */}
              <Link 
                href={`/product/changelog/${release.id}`}
                className="flex-1 bg-[#f0f4f8] dark:bg-[#0f0f13] rounded-[2rem] p-8 md:p-10 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-transparent dark:hover:border-white/10"
              >
                <h2 className="text-2xl md:text-[28px] font-bold dark:text-white text-slate-900 mb-6 tracking-tight leading-tight">
                  {release.title}
                </h2>
                
                <p className="dark:text-white/70 text-slate-600 text-base leading-relaxed mb-8 font-medium">
                  {release.description}
                </p>
                
                <ul className="space-y-4">
                  {release.highlights.map((change: string, changeIndex: number) => (
                    <li key={changeIndex} className="flex items-start gap-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 mt-0.5 shrink-0"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      <span className="text-sm md:text-base text-slate-500 dark:text-white/60 font-medium">
                        {change}
                      </span>
                    </li>
                  ))}
                </ul>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
