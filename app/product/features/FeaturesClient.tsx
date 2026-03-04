"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { FeatureGrid } from "./components/FeatureGrid"
import { MockupSlider } from "@/app/components/auth/sections/MockupSlider"

export function FeaturesClient() {
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-violet-500 mr-2 animate-pulse"></span>
            Features
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            Complete Toolkit for <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500">Revenue Operations</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-8">
            Everything you need to automate your entire sales process, from lead generation to closing deals.
          </p>
        </div>
      </section>

      {/* Dynamic Slider Section */}
      <section className="relative w-full py-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-[#030303] bg-slate-50/50">
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12">
          <MockupSlider />
        </div>
      </section>

      {/* Feature Grid Directory */}
      <FeatureGrid />

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
