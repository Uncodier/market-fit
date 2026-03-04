"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { LinkedInIcon, FacebookIcon, TikTokIcon } from "@/app/components/ui/social-icons"
import { useLocalization } from "@/app/context/LocalizationContext"

import { SiteHeader } from "@/app/components/navigation/SiteHeader"

export function AboutClient() {
  const { t } = useLocalization()
  
  const founders = [
    {
      name: "Sergio Prado",
      role: "CEO/CTO",
      image: "https://ui-avatars.com/api/?name=Sergio+Prado&size=400&background=F3E8FF&color=7C3AED", // Placeholder
      socials: [
        { icon: <LinkedInIcon size={16} className="transition-opacity" color="currentColor" />, href: "https://www.linkedin.com/in/spradox" },
        { icon: <FacebookIcon size={16} className="transition-opacity" color="currentColor" />, href: "https://www.facebook.com/spradox" },
        { icon: <TikTokIcon size={16} className="transition-opacity" color="currentColor" />, href: "https://www.tiktok.com/@spradox_" }
      ]
    },
    {
      name: "Zuko, Border Codie",
      role: "Chief Emotional Officer",
      image: "https://ui-avatars.com/api/?name=Zuko&size=400&background=D1FAE5&color=059669", // Placeholder
      socials: [
        { icon: <LinkedInIcon size={16} className="transition-opacity" color="currentColor" />, href: "https://www.linkedin.com/in/zuko-border-codie" },
        { icon: <TikTokIcon size={16} className="transition-opacity" color="currentColor" />, href: "https://www.tiktok.com/@zuko_border_codie" }
      ]
    },
    {
      name: "Alejandra Barragán",
      role: "COO",
      image: "https://ui-avatars.com/api/?name=Alejandra+Barragan&size=400&background=FFE4E6&color=E11D48", // Placeholder
      socials: [
        { icon: <LinkedInIcon size={16} className="transition-opacity" color="currentColor" />, href: "https://www.linkedin.com/in/alehba" }
      ]
    }
  ]
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-cyan-500/30 flex flex-col font-sans overflow-hidden min-h-screen">
      <SiteHeader />
      
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white dark:bg-transparent rounded-full blur-[100px] opacity-100 pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('footer.company.about') || 'About Us'}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 leading-tight drop-shadow-lg">
            {t('about.meet') || 'Meet'} <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{t('about.founders') || 'the Founders'}</span>
          </h1>
          <p className="text-lg md:text-xl dark:text-white/50 text-slate-500 max-w-2xl font-light leading-relaxed mb-16">
            {t('about.subtitle') || 'The minds behind innovative solutions, making tomorrow\'s tech today with expertise that shapes the future of business.'}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 w-full max-w-5xl mx-auto">
            {founders.map((founder, idx) => (
              <div key={idx} className="flex flex-col items-center group">
                <div className="w-full max-w-[280px] aspect-[4/5] rounded-[24px] overflow-hidden mb-6 relative dark:bg-[#0f0f13] bg-white border dark:border-white/10 border-black/10 transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:border-cyan-500/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={founder.image} 
                    alt={founder.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/10 rounded-[24px] pointer-events-none"></div>
                </div>
                
                <h3 className="text-xl font-bold dark:text-white text-slate-900 mb-1 tracking-tight group-hover:text-cyan-500 transition-colors">{founder.name}</h3>
                <p className="text-sm font-medium dark:text-slate-400 text-slate-500 mb-4 uppercase tracking-wider text-[10px] bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10">{founder.role}</p>
                
                <div className="flex items-center gap-4 justify-center">
                  {founder.socials.map((social, sIdx) => (
                    <a 
                      key={sIdx} 
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="dark:text-slate-400 text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors hover:scale-110 transform duration-200"
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </div>
  )
}
