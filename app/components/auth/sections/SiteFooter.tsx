"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { LinkedInIcon, GitHubIcon, TikTokIcon } from "@/app/components/ui/social-icons"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization, SupportedLocale } from "@/app/context/LocalizationContext"

export function SiteFooter() {
  const { theme } = useTheme();
  const { locale, setLocale, t } = useLocalization();
  const isDark = theme === "dark";
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full dark:bg-[#030303] bg-white border-t dark:border-white/[0.04] border-black/5 py-16 px-6 lg:px-12 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3 mb-6">
              <Image 
                src={isDark ? "/images/combination_mark_white.png" : "/images/combination_mark.png"}
                alt="Makinari" 
                width={100} 
                height={24} 
                className="h-5 w-auto object-contain"
              />
            </Link>
            <p className="dark:text-white/50 text-slate-500 text-sm max-w-sm mb-8 leading-relaxed font-light font-inter">
              {t('footer.tagline') || 'The Revenue Operations Platform with AI agents that actually perform tasks for you. Scale your outbound, content, and growth automatically.'}
            </p>
            <div className="flex items-center gap-4">
              <a href="https://tiktok.com/@makinari.com" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center hover:dark:bg-white/10 bg-black/10 transition-colors group font-inter">
                <TikTokIcon size={18} color={isDark ? "#fff" : "#000"} className="opacity-70 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="https://linkedin.com/in/makinari" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center hover:dark:bg-white/10 bg-black/10 transition-colors group font-inter">
                <LinkedInIcon size={18} color={isDark ? "#fff" : "#000"} className="opacity-70 group-hover:opacity-100 transition-opacity" />
              </a>
              <a href="https://github.com/makinari-org" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full dark:bg-white/5 bg-black/5 flex items-center justify-center hover:dark:bg-white/10 bg-black/10 transition-colors group font-inter">
                <GitHubIcon size={18} color={isDark ? "#fff" : "#000"} className="opacity-70 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="dark:text-white font-semibold mb-6 font-inter">{t('footer.product') || 'Product'}</h4>
            <ul className="space-y-4">
              <li><Link href="/product/crm" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.crm') || 'CRM'}</Link></li>
              <li><Link href="/product/outbound" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.outbound') || 'Outbound'}</Link></li>
              <li><Link href="/product/inbound" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.inbound') || 'Inbound'}</Link></li>
              <li><Link href="/product/cms" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.cms') || 'Content Engine (CMS)'}</Link></li>
              <li><Link href="/product/support" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.support') || 'Support & CS'}</Link></li>
              <li><Link href="/product/features" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.features') || 'Features'}</Link></li>
              <li><Link href="/product/agents" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.agents') || 'AI Agents'}</Link></li>
              <li><Link href="/product/api" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.api') || 'API & MCP Server'}</Link></li>
              <li><Link href="/product/integrations" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.integrations') || 'Integrations'}</Link></li>
              <li><Link href="/product/pricing" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.pricing') || 'Pricing'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="dark:text-white font-semibold mb-6 font-inter">{t('footer.gtm') || 'GTM & Use Cases'}</h4>
            <ul className="space-y-4">
              <li><Link href="/product/use-cases?category=B2B" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.gtm.b2b') || 'B2B'}</Link></li>
              <li><Link href="/product/use-cases?category=B2C" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.gtm.b2c') || 'B2C'}</Link></li>
              <li><Link href="/product/use-cases?category=B2B2B" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.gtm.b2b2b') || 'B2B2B'}</Link></li>
              <li><Link href="/product/use-cases?category=B2B2C" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.gtm.b2b2c') || 'B2B2C'}</Link></li>
              <li><Link href="/product/use-cases" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter font-medium mt-2 pt-2 border-t dark:border-white/10 border-black/10 inline-block w-full">{t('footer.gtm.bySize') || 'By Size'}</Link></li>
              <li><Link href="/product/use-cases?category=Solopreneurs" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter pl-2 border-l-2 dark:border-white/20 border-black/20">{t('footer.gtm.solopreneur') || 'Solopreneurs'}</Link></li>
              <li><Link href="/product/use-cases?category=SMBs" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter pl-2 border-l-2 dark:border-white/20 border-black/20">{t('footer.gtm.smb') || 'SMBs'}</Link></li>
              <li><Link href="/product/use-cases?category=Startups" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter pl-2 border-l-2 dark:border-white/20 border-black/20">{t('footer.gtm.startups') || 'Startups'}</Link></li>
              <li><Link href="/product/use-cases?category=Scale Ups" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter pl-2 border-l-2 dark:border-white/20 border-black/20">{t('footer.gtm.scaleups') || 'Scale Ups'}</Link></li>
              <li><Link href="/product/use-cases?category=Enterprise" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter pl-2 border-l-2 dark:border-white/20 border-black/20">{t('footer.gtm.enterprise') || 'Enterprise'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="dark:text-white font-semibold mb-6 font-inter">{t('footer.resources') || 'Resources'}</h4>
            <ul className="space-y-4">
              <li><a href="https://docs.makinari.com" target="_blank" rel="noreferrer" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.docs') || 'Documentation'}</a></li>
              <li><a href="https://docs.makinari.com/rest-api" target="_blank" rel="noreferrer" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.api') || 'API Reference'}</a></li>
              <li><a href="https://chat.whatsapp.com/GWwzWDcCYpdA6aPBBvkp5a?mode=gi_t" target="_blank" rel="noreferrer" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.community') || 'Community'}</a></li>
              <li><Link href="#blog" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.blog') || 'Blog'}</Link></li>
              <li><Link href="/product/guides" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.guides') || 'Guides'}</Link></li>
              <li><Link href="/resources/gtm-engineering" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.gtmEngineering') || 'GTM Engineering'}</Link></li>
              <li><Link href="/product/changelog" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.resources.changelog') || 'Changelog'}</Link></li>
              <li><Link href="/product/openclaw" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.product.openclaw') || 'Open Claw'}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="dark:text-white font-semibold mb-6 font-inter">{t('footer.company') || 'Company'}</h4>
            <ul className="space-y-4">
              <li><Link href="/about" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.company.about') || 'About Us'}</Link></li>
              <li><a href="https://linkedin.com/in/makinari" target="_blank" rel="noreferrer" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.company.careers') || 'Careers'}</a></li>
              <li><a href="mailto:contact@makinari.com" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.company.contact') || 'Contact'}</a></li>
              <li><Link href="/privacy" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.company.privacy') || 'Privacy Policy'}</Link></li>
              <li><Link href="/terms" className="dark:text-white/50 text-slate-500 hover:dark:text-white text-sm transition-colors font-inter">{t('footer.company.terms') || 'Terms of Service'}</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t dark:border-white/[0.04] border-black/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="dark:text-white/40 text-slate-500 text-xs flex-1 font-inter font-medium">
            © {currentYear} {t('footer.rightsReserved') || 'Makinari Inc. All rights reserved.'}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-xs dark:text-white/40 text-slate-500">
            <span className="flex items-center gap-2 font-inter">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              {t('footer.allSystemsOperational') || 'All systems operational'}
            </span>
            <div className="flex items-center gap-4">
              <LanguageSelector locale={locale} setLocale={setLocale} t={t} />
              <ThemeSelector />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="flex items-center gap-2 border-l dark:border-white/10 border-black/10 pl-4 h-4">
      <button
        onClick={() => setTheme("light")}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors font-inter ${
          theme === "light" 
            ? "bg-black/10 dark:bg-white/10 bg-black/10 text-black dark:text-white" 
            : "text-black/40 dark:text-white/40 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white text-slate-900"
        }`}
        title="Light Mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors font-inter ${
          theme === "dark" 
            ? "bg-black/10 dark:bg-white/10 bg-black/10 text-black dark:text-white" 
            : "text-black/40 dark:text-white/40 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white text-slate-900"
        }`}
        title="Dark Mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors font-inter ${
          theme === "system" 
            ? "bg-black/10 dark:bg-white/10 bg-black/10 text-black dark:text-white" 
            : "text-black/40 dark:text-white/40 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white text-slate-900"
        }`}
        title="System Preference"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </button>
    </div>
  )
}

function LanguageSelector({ locale, setLocale, t }: { locale: SupportedLocale, setLocale: (l: SupportedLocale) => void, t: (k: string) => string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const languages: { code: SupportedLocale; name: string }[] = [
    { code: 'en', name: t('language.en') || 'English' },
    { code: 'es', name: t('language.es') || 'Español' },
    { code: 'fr', name: t('language.fr') || 'Français' },
    { code: 'de', name: t('language.de') || 'Deutsch' },
    { code: 'ja', name: t('language.ja') || '日本語' },
  ];

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 hover:text-black dark:hover:text-white transition-colors py-1 font-inter"
        title="Select Language"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span>{languages.find(l => l.code === locale)?.name || 'English'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute bottom-full right-0 mb-2 w-40 bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-xl shadow-xl overflow-hidden z-50 py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLocale(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between font-inter ${
                  locale === lang.code 
                    ? 'text-black dark:text-white font-medium bg-black/5 dark:bg-white/5' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang.name}
                {locale === lang.code && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
