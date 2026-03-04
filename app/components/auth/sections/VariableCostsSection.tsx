"use client"

import React from "react"
import { useLocalization } from "@/app/context/LocalizationContext"

const variableCosts = [
  { 
    label: "Partner ICP Lead Cost", 
    price: "50¢",
    description: "Costo por lead altamente cualificado generado por IA basado en tu Perfil de Partner Ideal."
  },
  { 
    label: "Outsourced Partner Meeting", 
    price: "20$",
    description: "Tarifa fija por cada reunión inicial agendada para reclutar un nuevo partner."
  },
  { 
    label: "Successful Partner Recruitment", 
    price: "10$",
    description: "Bono aplicado cuando la reunión resulta en la firma de un nuevo partner."
  },
  { 
    label: "API Call / Deep Research", 
    price: "1¢",
    description: "Costo por cada petición a la API de IA o extracción profunda de datos en web."
  },
  { 
    label: "1M Input Tokens", 
    price: "1$",
    description: "Costo de procesamiento por 1 millón de tokens de texto enviados a nuestros modelos de IA."
  },
  { 
    label: "1M Output Tokens", 
    price: "20$",
    description: "Costo de generación por 1 millón de tokens de texto producidos por nuestros modelos de IA."
  },
  { 
    label: "Audio Input Minute", 
    price: "50¢",
    description: "Costo por minuto de audio procesado y transcrito por nuestra IA."
  },
  { 
    label: "Audio Output Minute", 
    price: "2$",
    description: "Costo por minuto de generación de voz sintética de alta calidad."
  },
  { 
    label: "AI Video Minute", 
    price: "20$",
    description: "Costo por minuto de contenido en video personalizado generado por IA."
  },
]

export function VariableCostsSection() {
  const { t } = useLocalization()

  return (
    <section className="relative w-full py-24 border-t dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-[#ffffff] overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.05),transparent_60%)]" />
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
            Costos Variables & <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">Créditos Adicionales</span>
          </h2>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
            Paga solo por lo que utilizas. Recarga créditos en cualquier momento para escalar tu alcance en la adquisición de partners.
          </p>
        </div>

        {/* Grid of costs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-24">
          {variableCosts.map((cost, idx) => (
            <div
              key={idx}
              className="rounded-xl dark:neu-base neu-base-light overflow-hidden relative group p-6 md:p-8 flex flex-col justify-center border dark:border-white/[0.06] border-black/5 backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:-translate-x-1 hover:border-violet-500/30 hover:shadow-[10px_10px_0px_rgba(255,255,255,0.05)]"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="text-sm dark:text-white/70 text-slate-500 font-medium mb-1">{cost.label}</h3>
                  <p className="text-xs dark:text-white/40 text-slate-400 font-light mb-4 line-clamp-2 md:line-clamp-none">{cost.description}</p>
                </div>
                <div className="text-3xl md:text-4xl font-bold dark:text-white text-slate-900 tracking-tight mt-auto">
                  {cost.price}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Practical Usage Examples */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-bold tracking-tighter dark:text-white text-slate-900 mb-4">
              Ejemplos de Uso Práctico
            </h3>
            <p className="text-md dark:text-white/50 text-slate-500 max-w-2xl mx-auto font-light">
              Descubre cómo funciona nuestro sistema de créditos en escenarios del mundo real.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Example 1 */}
            <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/[0.06] border-black/5 backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:-translate-x-1 hover:border-violet-500/30 hover:shadow-[10px_10px_0px_rgba(255,255,255,0.05)]">
              <h4 className="text-xl font-bold dark:text-white text-slate-900 mb-4 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 text-sm font-bold shadow-inner">1</span>
                Campaña de Reclutamiento
              </h4>
              <p className="dark:text-white/70 text-slate-500 mb-6 text-sm font-light">
                Genera 1,000 perfiles de partners altamente segmentados usando IA y enriquecelos con investigación profunda.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex justify-between items-center text-sm">
                  <span className="dark:text-white/60 text-slate-500">1,000 Perfiles de Partners Generados por IA</span>
                  <span className="dark:text-white text-slate-900 font-medium">$500.00</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="dark:text-white/60 text-slate-500">2,000 Llamadas a la API / Deep Research</span>
                  <span className="dark:text-white text-slate-900 font-medium">$20.00</span>
                </li>
              </ul>
              <div className="pt-4 border-t dark:border-white/[0.06] border-black/5 flex justify-between items-center">
                <span className="font-bold dark:text-white text-slate-900">Costo Estimado Total</span>
                <span className="text-xl font-bold text-violet-600 dark:text-violet-400">$520.00</span>
              </div>
            </div>

            {/* Example 2 */}
            <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/[0.06] border-black/5 backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:-translate-x-1 hover:border-orange-500/30 hover:shadow-[10px_10px_0px_rgba(255,255,255,0.05)]">
              <h4 className="text-xl font-bold dark:text-white text-slate-900 mb-4 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 text-sm font-bold shadow-inner">2</span>
                Cierre y Firma de Partners
              </h4>
              <p className="dark:text-white/70 text-slate-500 mb-6 text-sm font-light">
                Externaliza 50 reuniones de prospección y firma exitosamente a 10 nuevos distribuidores.
              </p>
              <ul className="space-y-3 mb-6">
                <li className="flex justify-between items-center text-sm">
                  <span className="dark:text-white/60 text-slate-500">50 Reuniones de Partners Externalizadas</span>
                  <span className="dark:text-white text-slate-900 font-medium">$1,000.00</span>
                </li>
                <li className="flex justify-between items-center text-sm">
                  <span className="dark:text-white/60 text-slate-500">10 Partners Firmados (Bono)</span>
                  <span className="dark:text-white text-slate-900 font-medium">$100.00</span>
                </li>
              </ul>
              <div className="pt-4 border-t dark:border-white/[0.06] border-black/5 flex justify-between items-center">
                <span className="font-bold dark:text-white text-slate-900">Costo Estimado Total</span>
                <span className="text-xl font-bold text-orange-600 dark:text-orange-400">$1,100.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
