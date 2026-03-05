"use client"

import * as React from "react"
import { Check, ArrowUpRight } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"

const getPlans = (t: (key: string) => string) => [
  {
    id: "free",
    title: t('pricing.free.title') || "POC",
    description: t('pricing.free.desc') || "12-Month Proof of Concept. Pay just for results and scale on demand",
    priceLabel: "$27",
    period: t('pricing.free.period') || " USD/year paid at the end of the year",
    color: "from-blue-400 to-cyan-400",
    hoverClass: "hover:border-blue-500 hover:shadow-[8px_8px_0px_rgba(59,130,246,1)]",
    patternColor: "rgba(59,130,246,0.1)",
    features: [
      t('pricing.free.f1') || "Up to 5 social networks",
      t('pricing.free.f2') || "Web channel",
      t('pricing.free.f3') || "Use your own Twilio and email",
      t('pricing.free.f4') || "Community access",
      t('pricing.free.f5') || "Standard support",
      t('pricing.free.f6') || "30 Credits",
    ],
    cta: t('pricing.free.cta') || "Start now",
    ctaHref: "https://buy.stripe.com/test_00gaGHeYa50579SbII",
    ctaExternal: true,
  },
  {
    id: "startup",
    title: t('pricing.startup.title') || "Startup",
    description: t('pricing.startup.desc') || "All Included",
    isPopular: true,
    priceLabel: "$99",
    period: t('pricing.period') || "/month",
    color: "from-violet-400 to-fuchsia-400",
    hoverClass: "hover:border-violet-500 hover:shadow-[8px_8px_0px_rgba(139,92,246,1)]",
    patternColor: "rgba(139,92,246,0.1)",
    features: [
      t('pricing.startup.f1') || "Unlimited social networks",
      t('pricing.startup.f2') || "Custom email account",
      t('pricing.startup.f3') || "WhatsApp account",
      t('pricing.startup.f4') || "Phone number account",
      t('pricing.startup.f5') || "API access",
      t('pricing.startup.f6') || "Priority support",
      t('pricing.startup.f7') || "100 Credits",
    ],
    cta: t('pricing.startup.cta') || "Buy now",
    ctaHref: "https://buy.stripe.com/test_8wM4ij6zM5053XGaEF",
    ctaExternal: true,
  },
  {
    id: "gtm",
    title: t('pricing.gtm.title') || "GTM",
    description: t('pricing.gtm.desc') || "High performance sales & marketing services",
    pricePrefix: t('pricing.gtm.prefix') || "from ",
    priceLabel: "$499",
    period: t('pricing.period') || "/month",
    color: "from-emerald-400 to-teal-400",
    hoverClass: "hover:border-emerald-500 hover:shadow-[8px_8px_0px_rgba(16,185,129,1)]",
    patternColor: "rgba(16,185,129,0.1)",
    features: [
      t('pricing.gtm.f1') || "Dedicated GTM engineer",
      t('pricing.gtm.f2') || "Web analytics tracking",
      t('pricing.gtm.f3') || "Ads assignment",
      t('pricing.gtm.f4') || "Advanced integrations",
      t('pricing.gtm.f5') || "24/7 Priority support",
      t('pricing.gtm.f6') || "500 Credits",
      t('pricing.gtm.f7') || "Variable costs based on sales performance",
    ],
    cta: t('pricing.gtm.cta') || "Contact us",
    ctaHref: "mailto:hello@makinari.com",
    ctaExternal: true,
  },
]

export function PricingSection({ showFullPricingButton = false }: { showFullPricingButton?: boolean }) {
  const { t } = useLocalization()
  const plans = getPlans(t)

  return (
    <section id="plans" className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.05),transparent_60%)]" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <div className="inline-flex items-center rounded-full font-inter dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6">
            <span className="w-1.5 h-1.5 rounded-full font-inter font-bold bg-violet-500 mr-2 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
            {t('pricing.badge') || 'Partner Acquisition'}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
            {t('pricing.title.start') || 'Budgets per'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">{t('pricing.title.highlight') || 'channel'}</span>
          </h2>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
            {t('pricing.subtitle') || 'Budgets exclusively oriented to prospecting and recruiting partners (distributors).'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, idx) => {
            const isPopular = "isPopular" in plan && plan.isPopular;
            
            return (
            <div
              key={plan.id}
              className={`rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col border backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:-translate-x-2 ${
                isPopular ? "border-violet-500/40 shadow-[0_0_30px_rgba(139,92,246,0.15)] md:-translate-y-2" : "dark:border-white/[0.06] border-black/5"
              } ${plan.hoverClass}`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${plan.color} opacity-5 blur-[50px] group-hover:opacity-10 transition-opacity duration-500`}></div>
              {/* Op-art geometric lines accent on hover */}
              <div 
                className="absolute inset-0 opacity-40 pointer-events-none animate-pan-diagonal-fast"
                style={{ backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 6px, ${plan.patternColor} 6px, ${plan.patternColor} 12px)` }}
              ></div>

              {isPopular && (
                <>
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.03)_8px,rgba(139,92,246,0.03)_16px)] pointer-events-none"></div>
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-80" />
                  <div className="absolute -top-1/2 -right-1/4 w-[150%] h-[150%] bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_60%)] pointer-events-none blur-3xl animate-pulse-slow"></div>
                  <div className="absolute top-6 right-6 inline-flex items-center rounded-full font-inter font-medium bg-violet-500/20 dark:bg-violet-500/20 border border-violet-500/30 dark:border-violet-500/30 px-3 py-1 text-[10px] tracking-widest uppercase text-violet-700 dark:text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.3)] z-20 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full font-inter font-medium bg-violet-600 dark:bg-violet-400 mr-2 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                    {t('pricing.mostPopular') || 'Más Popular'}
                  </div>
                </>
              )}
              <div className="relative z-10 flex flex-col h-full">
                <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-2">{plan.title}</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 mb-6 font-light">{plan.description}</p>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 dark:text-white/80 text-slate-500 text-sm">
                      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full font-inter font-bold bg-violet-500/20 flex items-center justify-center">
                        <Check size={12} className="text-violet-400" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-6 border-t dark:border-white/[0.06] border-black/5">
                  <div className="flex items-baseline gap-1 mb-6 flex-wrap">
                    {"pricePrefix" in plan && plan.pricePrefix && (
                      <span className="text-base font-normal dark:text-white/70 text-slate-500 align-baseline">{plan.pricePrefix}</span>
                    )}
                    <span className="text-4xl font-bold dark:text-white text-slate-900">{plan.priceLabel}</span>
                    <span className="dark:text-white/50 text-slate-500 text-sm font-light">{plan.period}</span>
                  </div>
                  {plan.ctaExternal ? (
                    <a
                      href={plan.ctaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block w-full py-3.5 px-6 rounded-md text-center font-inter text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
                        isPopular 
                          ? "neu-auth-btn text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                          : "dark:neu-button neu-button-light dark:text-white/85 text-slate-500 hover:dark:text-white text-slate-900"
                      }`}
                    >
                      {plan.cta}
                    </a>
                  ) : (
                    <Link
                      href={plan.ctaHref}
                      className={`block w-full py-3.5 px-6 rounded-md text-center font-inter text-sm font-medium transition-all duration-300 active:scale-[0.98] ${
                        isPopular 
                          ? "neu-auth-btn text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                          : "dark:neu-button neu-button-light dark:text-white/85 text-slate-500 hover:dark:text-white text-slate-900"
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {showFullPricingButton && (
          <div className="mt-16 text-center flex justify-center">
            <Link
              href="/product/pricing"
              className="inline-flex items-center text-sm font-medium font-inter text-violet-500 hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-300 transition-colors group"
            >
              {t('pricing.viewAll') || 'View full pricing'}
              <ArrowUpRight size={14} className="ml-1 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
