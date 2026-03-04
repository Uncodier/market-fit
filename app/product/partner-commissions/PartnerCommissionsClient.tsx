"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Check, ArrowRight } from "@/app/components/ui/icons"
import Link from "next/link"

export function PartnerCommissionsClient() {
  const { t } = useLocalization()

  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-violet-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      
      {/* Hero Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <Link href="/product/pricing" className="inline-flex items-center gap-2 text-sm font-medium dark:text-white/50 text-slate-500 hover:dark:text-white hover:text-slate-900 mb-8 transition-colors">
            <ArrowRight className="rotate-180" size={16} />
            Volver a Precios
          </Link>
          
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-6">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            Modelo de Revenue Share
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            Costo Variable por <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">Partner</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-3xl font-light leading-relaxed mb-8">
            Una vez que adquieres un partner a través de nuestros canales de prospección, el modelo pasa a ser a base de resultados (Revenue Share). Conoce nuestra estructura de comisiones recomendada para retener e incentivar a tus distribuidores.
          </p>
        </div>
      </section>

      {/* Tiers Section */}
      <section className="relative w-full py-24 dark:bg-[#030303] bg-white flex-1">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter dark:text-white text-slate-900 mb-4">
              Tiers de Comisiones
            </h2>
            <p className="text-md dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
              Este es el margen que típicamente cedes a un partner por cada venta cerrada, dependiendo de su volumen histórico de ventas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Tier 1 */}
            <div className="rounded-2xl dark:neu-base neu-base-light p-8 border dark:border-white/[0.06] border-black/5 hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-300 dark:bg-slate-700" />
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Partner Silver</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 font-light">Para nuevos distribuidores con volumen inicial.</p>
              </div>
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black dark:text-white text-slate-900">15%</span>
                  <span className="text-sm dark:text-white/50 text-slate-500 font-light">/ venta</span>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  "Hasta $10k MRR generado",
                  "Soporte estándar de ventas",
                  "Acceso a portal de partners",
                  "Material de marketing básico"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm dark:text-white/80 text-slate-600 font-light">
                    <Check size={16} className="text-slate-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tier 2 */}
            <div className="rounded-2xl dark:neu-base neu-base-light p-8 border dark:border-emerald-500/30 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:-translate-y-4 transition-transform duration-500 relative overflow-hidden group md:-translate-y-2 z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
              <div className="absolute top-6 right-6 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 backdrop-blur-md">
                Estándar
              </div>
              <div className="mb-6 relative">
                <h3 className="text-2xl font-bold mb-2 dark:text-white text-slate-900">Partner Gold</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 font-light">El punto de equilibrio ideal para crecimiento constante.</p>
              </div>
              <div className="mb-8 relative">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black dark:text-white text-slate-900">20%</span>
                  <span className="text-sm dark:text-white/50 text-slate-500 font-light">/ venta</span>
                </div>
              </div>
              <ul className="space-y-4 relative">
                {[
                  "$10k - $50k MRR generado",
                  "Soporte prioritario de ventas",
                  "MDF (Fondos de Desarrollo) 2%",
                  "Lead sharing cualificado"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm dark:text-white/80 text-slate-600 font-light">
                    <Check size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tier 3 */}
            <div className="rounded-2xl dark:neu-base neu-base-light p-8 border dark:border-white/[0.06] border-black/5 hover:-translate-y-2 transition-transform duration-500 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2 dark:text-white text-slate-900">Partner Platinum</h3>
                <p className="text-sm dark:text-white/50 text-slate-500 font-light">Para agencias enterprise y consultoras de alto volumen.</p>
              </div>
              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black dark:text-white text-slate-900">30%</span>
                  <span className="text-sm dark:text-white/50 text-slate-500 font-light">/ venta</span>
                </div>
              </div>
              <ul className="space-y-4">
                {[
                  "+$50k MRR generado",
                  "Account Manager Dedicado",
                  "MDF (Fondos de Desarrollo) 5%",
                  "White-label opcional y API Full"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm dark:text-white/80 text-slate-600 font-light">
                    <Check size={16} className="text-indigo-400 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}