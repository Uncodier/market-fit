"use client"

import * as React from "react"
import { Check } from "@/app/components/ui/icons"
import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"

const getPlans = (t: (key: string) => string) => [
  {
    id: "free",
    title: t('pricing.free.title') || "Gratis",
    description: t('pricing.free.desc') || "Paga solo por resultados y escala a demanda",
    priceLabel: "$0",
    period: t('pricing.period') || "/mes",
    features: [
      t('pricing.free.f1') || "Hasta 5 redes sociales",
      t('pricing.free.f2') || "Canal web",
      t('pricing.free.f3') || "Usa tu propio Twilio y correo",
      t('pricing.free.f4') || "Acceso a la comunidad",
      t('pricing.free.f5') || "Soporte estándar",
      t('pricing.free.f6') || "30 Créditos",
    ],
    cta: t('pricing.free.cta') || "Empezar ahora",
    ctaHref: "/auth?mode=register",
    ctaExternal: false,
  },
  {
    id: "startup",
    title: t('pricing.startup.title') || "Startup",
    description: t('pricing.startup.desc') || "Todo Incluido",
    isPopular: true,
    priceLabel: "$99",
    period: t('pricing.period') || "/mes",
    features: [
      t('pricing.startup.f1') || "Redes sociales ilimitadas",
      t('pricing.startup.f2') || "Cuenta de correo personalizada",
      t('pricing.startup.f3') || "Cuenta de WhatsApp",
      t('pricing.startup.f4') || "Cuenta de número telefónico",
      t('pricing.startup.f5') || "Acceso API",
      t('pricing.startup.f6') || "Soporte prioritario",
      t('pricing.startup.f7') || "100 Créditos",
    ],
    cta: t('pricing.startup.cta') || "Comprar",
    ctaHref: "/billing",
    ctaExternal: false,
  },
  {
    id: "gtm",
    title: t('pricing.gtm.title') || "GTM",
    description: t('pricing.gtm.desc') || "Servicios de ventas y marketing de alto rendimiento",
    pricePrefix: t('pricing.gtm.prefix') || "desde ",
    priceLabel: "$499",
    period: t('pricing.period') || "/mes",
    features: [
      t('pricing.gtm.f1') || "Ingeniero GTM dedicado",
      t('pricing.gtm.f2') || "Seguimiento de analítica web",
      t('pricing.gtm.f3') || "Asignación de anuncios",
      t('pricing.gtm.f4') || "Integraciones avanzadas",
      t('pricing.gtm.f5') || "Soporte prioritario 24/7",
      t('pricing.gtm.f6') || "500 Créditos",
    ],
    cta: t('pricing.gtm.cta') || "Contáctanos",
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
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-3 py-1 text-xs font-bold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-2 shadow-[0_0_8px_rgba(139,92,246,0.8)]"></span>
            {t('pricing.badge') || 'Adquisición de Partners'}
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
            {t('pricing.title.start') || 'Presupuestos por'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">{t('pricing.title.highlight') || 'canal'}</span>
          </h2>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
            {t('pricing.subtitle') || 'Presupuestos orientados exclusivamente a la prospección y reclutamiento de partners (distribuidores).'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, idx) => {
            const isPopular = "isPopular" in plan && plan.isPopular;
            
            return (
            <div
              key={plan.id}
              className={`rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-8 flex flex-col border backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:-translate-x-1 ${
                isPopular ? "border-violet-500/40 shadow-[0_0_30px_rgba(139,92,246,0.15)] md:-translate-y-4 hover:shadow-[10px_10px_0px_rgba(139,92,246,0.5)]" : "dark:border-white/[0.06] border-black/5 hover:border-violet-500/30 hover:shadow-[10px_10px_0px_rgba(255,255,255,0.05)]"
              }`}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {isPopular && (
                <>
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(139,92,246,0.03)_8px,rgba(139,92,246,0.03)_16px)] pointer-events-none"></div>
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-80" />
                  <div className="absolute -top-1/2 -right-1/4 w-[150%] h-[150%] bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_60%)] pointer-events-none blur-3xl animate-pulse-slow"></div>
                  <div className="absolute top-6 right-6 inline-flex items-center rounded-full bg-violet-500/20 dark:bg-violet-500/20 border border-violet-500/30 dark:border-violet-500/30 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-violet-700 dark:text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.3)] z-20 backdrop-blur-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400 mr-2 animate-pulse shadow-[0_0_8px_rgba(167,139,250,0.8)]"></span>
                    {t('pricing.mostPopular') || 'Más Popular'}
                  </div>
                </>
              )}
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 ${isPopular ? 'opacity-50' : ''}`} />
              <div className="relative z-10 flex flex-col h-full">
                <h3 className="text-2xl font-bold dark:text-white text-slate-900 mb-2">{plan.title}</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 mb-6 font-light">{plan.description}</p>

                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 dark:text-white/80 text-slate-500 text-sm">
                      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center">
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
                      className={`block w-full py-3.5 px-6 rounded-md text-center font-bold font-inter transition-all duration-300 active:scale-[0.98] ${
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
                      className={`block w-full py-3.5 px-6 rounded-md text-center font-bold font-inter transition-all duration-300 active:scale-[0.98] ${
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
              className="inline-flex items-center justify-center px-8 py-4 rounded-full text-base font-bold dark:text-white text-slate-900 border dark:border-white/10 border-black/10 hover:bg-slate-100 dark:hover:bg-white/5 transition-all hover:scale-105 active:scale-95 group shadow-sm dark:shadow-white/5"
            >
              {t('pricing.viewAll') || 'View full pricing'}
              <svg className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
