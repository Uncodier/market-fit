"use client"

import React from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { changelogData } from "../changelog-data"

export default function ChangelogDetailClient({ id }: { id: string }) {
  const release = changelogData.find((r) => r.id === id)

  if (!release) {
    notFound()
  }

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-indigo-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Main Content */}
      <section className="pt-24 pb-12 max-w-4xl mx-auto px-6 lg:px-12 flex-1 w-full relative z-10">
        <Link href="/product/changelog" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-indigo-500 transition-colors mb-8 group">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-2 group-hover:-translate-x-1 transition-transform">
            <path d="M19 12H5"></path>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Changelog
        </Link>
        
        <div className="bg-[#f0f4f8] dark:bg-[#0f0f13] rounded-[2rem] p-8 md:p-12 shadow-sm border border-transparent dark:border-white/10">
          
          <div className="inline-flex items-center rounded-full bg-slate-200/50 dark:bg-white/5 px-4 py-1.5 text-xs font-bold mb-6 text-slate-600 dark:text-white/70 uppercase tracking-widest font-display">
            Release {release.version} • {release.date}
          </div>
          
          <h1 className="text-4xl md:text-[44px] font-extrabold tracking-tight mb-8 leading-tight font-display text-slate-900 dark:text-white">
            {release.title}
          </h1>
          
          <h2 className="text-2xl font-bold dark:text-white text-slate-900 mb-6 font-display">
            Overview
          </h2>
          <p className="dark:text-white/70 text-slate-600 text-lg leading-relaxed mb-10">
            {release.description}
          </p>
          
          <h2 className="text-2xl font-bold dark:text-white text-slate-900 mb-6 font-display">
            Key Changes
          </h2>
          <ul className="space-y-4 mb-10 bg-white/50 dark:bg-white/5 rounded-2xl p-6 md:p-8 border border-white/20 dark:border-white/5">
            {release.highlights.map((change: string, changeIndex: number) => (
              <li key={changeIndex} className="flex items-start gap-4">
                <span className="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 p-1.5 rounded-full mt-0.5 shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span className="text-base md:text-lg text-slate-600 dark:text-white/70 font-medium leading-relaxed">
                  {change}
                </span>
              </li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold dark:text-white text-slate-900 mb-6 font-display">
            Developer Notes
          </h2>
          <div className="prose prose-slate dark:prose-invert prose-lg max-w-none text-slate-600 dark:text-white/70">
            <p>
              {release.details}
            </p>
          </div>
          
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
