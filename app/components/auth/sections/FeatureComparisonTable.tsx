"use client"

import React from "react"
import { Check, X } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function FeatureComparisonTable() {
  const { t } = useLocalization();

  const comparisonData = [
    {
      category: t('comparison.cat1') || "Usage Limits",
      features: [
        { name: t('comparison.f1') || "Connected Social Networks", free: t('comparison.f1.free') || "Up to 5", startup: t('comparison.f1.startup') || "Unlimited", gtm: t('comparison.f1.gtm') || "Unlimited" },
        { name: t('comparison.f2') || "Web Channel", free: true, startup: true, gtm: true },
        { name: t('comparison.f3') || "Custom Email Account", free: t('comparison.bringYourOwn') || "Bring your own", startup: true, gtm: true },
        { name: t('comparison.f4') || "WhatsApp Account", free: t('comparison.bringYourOwn') || "Bring your own", startup: true, gtm: true },
        { name: t('comparison.f5') || "Phone Number Account", free: t('comparison.bringYourOwn') || "Bring your own", startup: true, gtm: true },
      ]
    },
    {
      category: t('comparison.cat2') || "Support & API",
      features: [
        { name: t('comparison.f6') || "Support Level", free: t('comparison.f6.free') || "Standard", startup: t('comparison.f6.startup') || "Priority", gtm: t('comparison.f6.gtm') || "Priority 24/7" },
        { name: t('comparison.f7') || "Community Access", free: true, startup: true, gtm: true },
        { name: t('comparison.f8') || "API Access", free: false, startup: true, gtm: true },
      ]
    },
    {
      category: t('comparison.cat3') || "Advanced Services",
      features: [
        { name: t('comparison.f9') || "Included Credits", free: t('comparison.f9.free') || "30 / mo", startup: t('comparison.f9.startup') || "100 / mo", gtm: t('comparison.f9.gtm') || "500 / mo" },
        { name: t('comparison.f10') || "Dedicated GTM Engineer", free: false, startup: false, gtm: true },
        { name: t('comparison.f11') || "Web Analytics Tracking", free: false, startup: false, gtm: true },
        { name: t('comparison.f12') || "Ad Assignment", free: false, startup: false, gtm: true },
        { name: t('comparison.f13') || "Advanced Integrations", free: false, startup: false, gtm: true },
        { name: t('comparison.f14') || "Variable costs based on sales performance", free: false, startup: false, gtm: true },
      ]
    }
  ]

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
    <div id="compare" className="w-full max-w-7xl mx-auto py-24 relative z-10 px-6 lg:px-12">
      <div className="text-center mb-16 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[100px] bg-violet-500/10 blur-[60px] pointer-events-none rounded-full"></div>
        <h3 className="text-3xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
          {t('comparison.title') || 'Compare Features'}
        </h3>
        <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
          {t('comparison.subtitle') || 'A detailed breakdown of what is included in each plan to help you choose the right one for your needs.'}
        </p>
      </div>

      <div className="rounded-2xl dark:neu-base neu-base-light overflow-hidden border dark:border-white/[0.08] border-black/10 backdrop-blur-md shadow-2xl relative">
        {/* Glow behind the startup column */}
        <div className="absolute top-0 bottom-0 left-[40%] w-[20%] pointer-events-none hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-fuchsia-500/5 to-transparent"></div>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-violet-500/50 to-fuchsia-500/50 shadow-[0_0_15px_rgba(167,139,250,0.5)]"></div>
        </div>

        <div className="overflow-x-auto relative z-10 w-full pb-4">
          <table className="w-full text-left border-collapse min-w-[500px] md:min-w-[800px]">
            <thead>
              <tr className="border-b dark:border-white/[0.08] border-black/10">
                <th className="py-4 px-4 md:py-6 md:px-8 font-bold dark:text-white text-slate-900 w-[120px] md:w-[40%] sticky left-0 dark:bg-[#08080a] bg-[#f8f9fa] z-20 shadow-[1px_0_0_rgba(255,255,255,0.04)] dark:shadow-[1px_0_0_rgba(0,0,0,0.1)]">{t('comparison.header.feature') || 'Feature'}</th>
                <th className="py-4 px-2 md:py-6 md:px-6 font-bold dark:text-white text-slate-900 text-center w-[120px] md:w-[20%] text-sm md:text-base">{t('pricing.free.title') || 'Free'}</th>
                <th className="py-4 px-2 md:py-6 md:px-6 font-bold text-center w-[120px] md:w-[20%] relative text-sm md:text-base">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500 text-base md:text-lg">{t('pricing.startup.title') || 'Startup'}</span>
                </th>
                <th className="py-4 px-2 md:py-6 md:px-6 font-bold dark:text-white text-slate-900 text-center w-[120px] md:w-[20%] text-sm md:text-base">{t('pricing.gtm.title') || 'GTM'}</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((category, idx) => (
                <React.Fragment key={idx}>
                  <tr className="bg-slate-100/50 dark:bg-white/[0.03] border-b dark:border-white/[0.08] border-black/10">
                    <td colSpan={4} className="py-3 px-4 md:py-4 md:px-8 text-[10px] md:text-xs font-bold uppercase tracking-widest dark:text-violet-300/70 text-violet-700/70 sticky left-0 dark:bg-white/[0.01] bg-slate-100/50 z-20">
                      {category.category}
                    </td>
                  </tr>
                  {category.features.map((feature, fIdx) => (
                    <tr 
                      key={fIdx} 
                      className="border-b dark:border-white/[0.04] border-black/5 last:border-0 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-4 px-4 md:py-5 md:px-8 text-xs md:text-sm dark:text-white/80 text-slate-600 sticky left-0 dark:bg-[#08080a] bg-[#f8f9fa] group-hover:dark:bg-[#0f0f13] group-hover:bg-[#f1f3f5] z-10 transition-colors shadow-[1px_0_0_rgba(255,255,255,0.04)] dark:shadow-[1px_0_0_rgba(0,0,0,0.1)]">
                        {feature.name}
                      </td>
                      <td className="py-4 px-2 md:py-5 md:px-6 text-center dark:text-white/70 text-slate-500 text-xs md:text-sm">
                        {renderValue(feature.free)}
                      </td>
                      <td className="py-4 px-2 md:py-5 md:px-6 text-center dark:text-white text-slate-900 bg-violet-500/[0.02] dark:bg-violet-500/[0.02] text-xs md:text-sm">
                        {renderValue(feature.startup, true)}
                      </td>
                      <td className="py-4 px-2 md:py-5 md:px-6 text-center dark:text-white/70 text-slate-500 text-xs md:text-sm">
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