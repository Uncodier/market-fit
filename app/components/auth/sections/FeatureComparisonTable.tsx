"use client"

import React from "react"
import { Check, X } from "@/app/components/ui/icons"

const comparisonData = [
  {
    category: "Usage Limits",
    features: [
      { name: "Connected Social Networks", free: "Up to 5", startup: "Unlimited", gtm: "Unlimited" },
      { name: "Web Channel", free: true, startup: true, gtm: true },
      { name: "Custom Email Account", free: "Bring your own", startup: true, gtm: true },
      { name: "WhatsApp Account", free: "Bring your own", startup: true, gtm: true },
      { name: "Phone Number Account", free: "Bring your own", startup: true, gtm: true },
    ]
  },
  {
    category: "Support & API",
    features: [
      { name: "Support Level", free: "Standard", startup: "Priority", gtm: "Priority 24/7" },
      { name: "Community Access", free: true, startup: true, gtm: true },
      { name: "API Access", free: false, startup: true, gtm: true },
    ]
  },
  {
    category: "Advanced Services",
    features: [
      { name: "Included Credits", free: "30 / mo", startup: "100 / mo", gtm: "500 / mo" },
      { name: "Dedicated GTM Engineer", free: false, startup: false, gtm: true },
      { name: "Web Analytics Tracking", free: false, startup: false, gtm: true },
      { name: "Ad Assignment", free: false, startup: false, gtm: true },
      { name: "Advanced Integrations", free: false, startup: false, gtm: true },
    ]
  }
]

export function FeatureComparisonTable() {
  const renderValue = (value: boolean | string, isPremium: boolean = false) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check size={18} className={isPremium ? "text-fuchsia-500 mx-auto shadow-fuchsia-500/50 drop-shadow-md" : "text-violet-500 mx-auto"} />
      ) : (
        <X size={18} className="text-slate-300 dark:text-slate-700 mx-auto opacity-50" />
      )
    }
    return <span className={`text-sm ${isPremium ? "font-bold text-slate-900 dark:text-white" : "font-medium"}`}>{value}</span>
  }

  return (
    <div className="w-full max-w-7xl mx-auto py-24 relative z-10 px-6 lg:px-12">
      <div className="text-center mb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[100px] bg-violet-500/10 blur-[60px] pointer-events-none rounded-full"></div>
        <h3 className="text-3xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
          Compare Features
        </h3>
        <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
          A detailed breakdown of what is included in each plan to help you choose the right one for your needs.
        </p>
      </div>

      <div className="rounded-2xl dark:neu-base neu-base-light overflow-hidden border dark:border-white/[0.08] border-black/10 backdrop-blur-md shadow-2xl relative">
        {/* Glow behind the startup column */}
        <div className="absolute top-0 bottom-0 left-[40%] w-[20%] pointer-events-none hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-fuchsia-500/5 to-transparent"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/50 to-fuchsia-500/50 shadow-[0_0_15px_rgba(167,139,250,0.5)]"></div>
        </div>

        <div className="overflow-x-auto relative z-10 w-full pb-4">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b dark:border-white/[0.08] border-black/10">
                <th className="py-6 px-8 font-bold dark:text-white text-slate-900 w-[40%] sticky left-0 dark:bg-[#08080a] bg-[#f8f9fa] z-20 shadow-[1px_0_0_rgba(255,255,255,0.04)] dark:shadow-[1px_0_0_rgba(0,0,0,0.1)]">Feature</th>
                <th className="py-6 px-6 font-bold dark:text-white text-slate-900 text-center w-[20%]">Free</th>
                <th className="py-6 px-6 font-bold text-center w-[20%] relative">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500 text-lg">Startup</span>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-violet-500/20 border border-violet-500/30 px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase text-violet-700 dark:text-violet-300 whitespace-nowrap">
                    Most Popular
                  </div>
                </th>
                <th className="py-6 px-6 font-bold dark:text-white text-slate-900 text-center w-[20%]">GTM</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((category, idx) => (
                <React.Fragment key={idx}>
                  <tr className="bg-slate-100/50 dark:bg-white/[0.03] border-b dark:border-white/[0.08] border-black/10">
                    <td colSpan={4} className="py-4 px-8 text-xs font-bold uppercase tracking-widest dark:text-violet-300/70 text-violet-700/70 sticky left-0 dark:bg-white/[0.01] bg-slate-100/50 z-20">
                      {category.category}
                    </td>
                  </tr>
                  {category.features.map((feature, fIdx) => (
                    <tr 
                      key={fIdx} 
                      className="border-b dark:border-white/[0.04] border-black/5 last:border-0 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-5 px-8 text-sm dark:text-white/80 text-slate-600 sticky left-0 dark:bg-[#08080a] bg-[#f8f9fa] group-hover:dark:bg-[#0f0f13] group-hover:bg-[#f1f3f5] z-10 transition-colors shadow-[1px_0_0_rgba(255,255,255,0.04)] dark:shadow-[1px_0_0_rgba(0,0,0,0.1)]">
                        {feature.name}
                      </td>
                      <td className="py-5 px-6 text-center dark:text-white/70 text-slate-500">
                        {renderValue(feature.free)}
                      </td>
                      <td className="py-5 px-6 text-center dark:text-white text-slate-900 bg-violet-500/[0.02] dark:bg-violet-500/[0.02]">
                        {renderValue(feature.startup, true)}
                      </td>
                      <td className="py-5 px-6 text-center dark:text-white/70 text-slate-500">
                        {renderValue(feature.gtm)}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}