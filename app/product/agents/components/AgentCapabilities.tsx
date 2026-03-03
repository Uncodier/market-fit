"use client"

import * as React from "react"
import { Globe, Code, Settings, Zap, NetworkTree } from "@/app/components/ui/icons"

export function AgentCapabilities() {
  return (
    <div className="w-full mt-24">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tighter dark:text-white text-slate-900 mb-6">
          Potenciados por <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">OpenClaw</span>
        </h2>
        <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-3xl mx-auto font-light">
          Nuestros agentes utilizan la infraestructura open source de OpenClaw.ai, permitiendo capacidades que van más allá de un simple chatbot. Tienen acceso real para hacer trabajo real.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 mb-6">
            <Globe className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">Control de Navegador</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            Los agentes pueden navegar por la web, llenar formularios, extraer datos de cualquier sitio y realizar investigaciones profundas como si fueran humanos.
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 mb-6">
            <Code className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">Acceso al Sistema</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            Capacidad para leer y escribir archivos, ejecutar comandos en terminal y correr scripts. Trabajan directamente en el entorno de desarrollo cuando es necesario.
          </p>
        </div>

        <div className="rounded-xl dark:neu-base neu-base-light p-8 border dark:border-white/5 border-black/5 hover:-translate-y-1 transition-transform duration-300">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-6">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-3">Skills & Plugins</h3>
          <p className="dark:text-white/60 text-slate-500 text-sm leading-relaxed">
            Arquitectura extensible que permite agregar habilidades personalizadas. Incluso pueden escribir su propio código para aprender nuevas funciones en tiempo real.
          </p>
        </div>

      </div>

      {/* Terminal Mockup */}
      <div className="mt-16 w-full max-w-4xl mx-auto rounded-xl overflow-hidden shadow-2xl border dark:border-white/10 border-black/10 dark:bg-[#0a0a0c] bg-slate-900">
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-black/40">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
          </div>
          <div className="mx-auto text-xs font-mono text-white/50">openclaw-agent — bash</div>
        </div>
        <div className="p-6 font-mono text-sm md:text-base text-slate-300 space-y-3 overflow-x-auto">
          <div className="flex gap-4">
            <span className="text-emerald-400 shrink-0">$</span>
            <span className="text-slate-300">openclaw onboard --role "Sales_SDR"</span>
          </div>
          <div className="text-blue-400">Loading OpenClaw core...</div>
          <div className="text-purple-400">Initializing persistent memory... ✓</div>
          <div className="text-orange-400">Connecting to WhatsApp interface... ✓</div>
          <div className="flex gap-4">
            <span className="text-emerald-400 shrink-0">$</span>
            <span className="text-slate-300">openclaw execute "Encuentra leads en LinkedIn y envíales un email"</span>
          </div>
          <div className="text-slate-400">&gt; Navegando a LinkedIn...</div>
          <div className="text-slate-400">&gt; Extrayendo datos de perfiles (15 encontrados)...</div>
          <div className="text-slate-400">&gt; Generando emails personalizados...</div>
          <div className="text-emerald-400 font-bold">✓ Tarea completada. Esperando aprobación en WhatsApp.</div>
          <div className="flex gap-4 mt-4 animate-pulse">
            <span className="text-emerald-400 shrink-0">$</span>
            <span className="w-2.5 h-5 bg-slate-300 inline-block"></span>
          </div>
        </div>
      </div>
      {/* Bring your own OpenClaw */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full dark:bg-white/5 bg-black/5 border dark:border-white/10 border-black/10">
          <div className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-sm dark:text-white/80 text-slate-700">
            ¿Ya tienes tu propio OpenClaw? Usa nuestro <a href="#" className="text-orange-500 hover:text-orange-400 font-medium underline underline-offset-4">Skill oficial de Makinari</a> para conectarlo.
          </span>
        </div>
      </div>
    </div>
  )
}
