"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ChevronDown, Menu, X } from "@/app/components/ui/icons"

export function SiteHeader() {
  const { t } = useLocalization()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null)

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    
    // Close mobile menu if window is resized to desktop size
    const handleResize = () => {
      if (window.innerWidth >= 1024 && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener('resize', handleResize)
    }
  }, [mobileMenuOpen])

  type NavItemType = {
    label: string;
    href?: string;
    isExternal?: boolean;
    divider?: boolean;
  }

  type NavSectionType = {
    title: string;
    columns: number;
    items: NavItemType[];
  }

  const navItems: NavSectionType[] = [
    {
      title: t('footer.product') || 'Product',
      columns: 2,
      items: [
        { label: t('footer.product.crm') || 'CRM', href: '/product/crm' },
        { label: t('footer.product.outbound') || 'Outbound', href: '/product/outbound' },
        { label: t('footer.product.inbound') || 'Inbound', href: '/product/inbound' },
        { label: t('footer.product.cms') || 'Content Engine', href: '/product/cms' },
        { label: t('footer.product.support') || 'Support & CS', href: '/product/support' },
        { label: t('footer.product.reporting') || 'Reporting & Analytics', href: '/product/reporting' },
        { label: t('footer.product.features') || 'Features', href: '/product/features' },
        { label: t('footer.product.agents') || 'AI Agents', href: '/product/agents' },
        { label: t('footer.product.api') || 'API & MCP Server', href: '/product/api' },
        { label: t('footer.product.pricing') || 'Pricing', href: '/product/pricing' },
      ]
    },
    {
      title: t('footer.gtm') || 'GTM & Use Cases',
      columns: 1,
      items: [
        { label: t('footer.gtm.b2b') || 'B2B', href: '/product/use-cases?category=B2B' },
        { label: t('footer.gtm.b2c') || 'B2C', href: '/product/use-cases?category=B2C' },
        { label: t('footer.gtm.b2b2b') || 'B2B2B', href: '/product/use-cases?category=B2B2B' },
        { label: t('footer.gtm.b2b2c') || 'B2B2C', href: '/product/use-cases?category=B2B2C' },
        { divider: true, label: "divider1" },
        { label: t('footer.gtm.solopreneur') || 'Solopreneurs', href: '/product/use-cases?category=Solopreneurs' },
        { label: t('footer.gtm.smb') || 'SMBs', href: '/product/use-cases?category=SMBs' },
        { label: t('footer.gtm.startups') || 'Startups', href: '/product/use-cases?category=Startups' },
        { label: t('footer.gtm.scaleups') || 'Scale Ups', href: '/product/use-cases?category=Scale Ups' },
        { label: t('footer.gtm.enterprise') || 'Enterprise', href: '/product/use-cases?category=Enterprise' },
      ]
    },
    {
      title: t('footer.resources') || 'Resources',
      columns: 1,
      items: [
        { label: t('footer.resources.docs') || 'Documentation', href: 'https://docs.makinari.com', isExternal: true },
        { label: t('footer.resources.api') || 'API Reference', href: 'https://docs.makinari.com/rest-api', isExternal: true },
        { label: t('footer.resources.community') || 'Community', href: 'https://chat.whatsapp.com/GWwzWDcCYpdA6aPBBvkp5a?mode=gi_t', isExternal: true },
        { label: t('footer.resources.blog') || 'Blog', href: '#blog' },
        { label: t('footer.resources.guides') || 'Guides', href: '/product/guides' },
        { label: t('footer.resources.gtmEngineering') || 'GTM Engineering', href: '/resources/gtm-engineering' },
        { label: t('footer.resources.agents') || 'Resources for Agents', href: '/resources/agents' },
        { label: t('footer.resources.changelog') || 'Changelog', href: '/product/changelog' },
        { label: t('footer.product.openclaw') || 'Open Claw', href: '/product/openclaw' },
        { label: t('footer.product.integrations') || 'Integrations', href: '/product/integrations' },
      ]
    }
  ]
  
  return (
    <>
      <header className="w-full self-start py-4 px-6 lg:px-12 border-b dark:border-white/5 border-black/5 bg-white/80 dark:bg-[#030303]/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#030303]/60 sticky top-0 z-[70] transform-gpu" style={{ WebkitTransform: 'translate3d(0,0,0)', willChange: 'transform' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 z-50">
          <Image 
            src="/images/combination_mark.png"
            alt="Makinari Logo"
            width={100}
            height={24}
            className="h-5 w-auto object-contain dark:brightness-0 dark:invert"
            priority
          />
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1 h-full flex-1 justify-center">
          {navItems.map((section) => (
            <div key={section.title} className="group h-full flex items-center relative">
              <button className="px-4 py-2 rounded-full font-inter text-sm font-medium dark:text-white/70 text-slate-600 hover:text-slate-900 dark:hover:text-white dark:hover:bg-white/5 hover:bg-black/5 transition-all flex items-center gap-1.5 font-inter">
                {section.title}
                <ChevronDown size={14} className="opacity-50 group-hover:rotate-180 transition-transform duration-300" />
              </button>
              
              {/* Dropdown Panel */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top scale-95 group-hover:scale-100 w-max z-50 pointer-events-none group-hover:pointer-events-auto">
                <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl shadow-2xl p-6 relative overflow-hidden">
                  <div className={`grid ${section.columns === 2 ? 'grid-cols-2 w-[440px]' : 'grid-cols-1 w-[240px]'} gap-x-8 gap-y-1`}>
                    {section.items.map((item, idx) => {
                      if (item.divider) {
                        return <div key={`div-${idx}`} className="col-span-full h-px dark:bg-white/10 bg-black/5 my-2" />
                      }
                      
                      const LinkWrapper = ({ children }: { children: React.ReactNode }) => {
                        if (item.isExternal) {
                          return <a href={item.href} target="_blank" rel="noreferrer" className="block text-sm dark:text-white/70 text-slate-600 hover:text-black dark:hover:text-white transition-colors py-2 font-inter">{children}</a>
                        }
                        return <Link href={item.href!} className="block text-sm dark:text-white/70 text-slate-600 hover:text-black dark:hover:text-white transition-colors py-2 font-inter">{children}</Link>
                      }

                      return (
                        <div key={item.label}>
                          <LinkWrapper>
                            {item.label}
                          </LinkWrapper>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 relative z-50">
          <div className="hidden lg:flex items-center gap-3">
            <Link href="/auth" className="text-sm font-medium px-4 py-2 rounded-full font-inter dark:text-white/80 text-slate-700 hover:text-black dark:hover:text-white dark:hover:bg-white/5 hover:bg-black/5 transition-all font-inter">
              {t('auth.signInLink') || 'Log in'}
            </Link>
            <Link href="/auth?mode=register" className="text-sm font-medium bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full font-inter font-bold hover:opacity-90 transition-opacity shadow-sm">
              {t('pricing.free.cta') || 'Start with Makinari'}
            </Link>
          </div>
          
          {/* Mobile Menu Toggle */}
          <button 
            className="lg:!hidden p-2 -mr-2 dark:text-white text-black transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div 
        className={`fixed inset-0 bg-white dark:bg-[#0a0a0a] z-[60] lg:hidden transition-all duration-300 ease-out flex flex-col pt-[80px] pb-8 overflow-y-auto ${
          mobileMenuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex flex-col w-full h-full px-6">
          <div className="flex-1 flex flex-col gap-1">
            {navItems.map((section) => (
              <div key={section.title} className="flex flex-col">
                <button 
                  className="flex items-center justify-between w-full py-4 text-[19px] font-semibold dark:text-white text-slate-900 font-inter"
                  onClick={() => setOpenMobileSection(openMobileSection === section.title ? null : section.title)}
                >
                  {section.title}
                  <ChevronDown 
                    size={20} 
                    className={`transition-transform duration-300 text-slate-400 ${openMobileSection === section.title ? 'rotate-180' : ''}`} 
                  />
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openMobileSection === section.title ? 'max-h-[800px] opacity-100 mb-2' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="flex flex-col gap-1 pt-2 pb-4 px-5 bg-slate-50 dark:bg-white/[0.02] rounded-2xl">
                    {section.items.map((item, idx) => {
                      if (item.divider) return <div key={`m-div-${idx}`} className="h-px w-full dark:bg-white/10 bg-black/5 my-2" />;
                      
                      return item.isExternal ? (
                        <a 
                          key={item.label}
                          href={item.href} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[16px] py-2.5 dark:text-white/70 text-slate-600 hover:text-slate-900 dark:hover:text-white font-inter block w-full transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link 
                          key={item.label}
                          href={item.href!} 
                          className="text-[16px] py-2.5 dark:text-white/70 text-slate-600 hover:text-slate-900 dark:hover:text-white font-inter block w-full transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col gap-3 mt-8 pt-6 border-t dark:border-white/10 border-black/10">
            <Link 
              href="/auth" 
              className="w-full py-3.5 text-center text-[16px] font-semibold dark:bg-white/10 bg-slate-100 dark:text-white text-slate-900 rounded-full font-inter hover:bg-slate-200 dark:hover:bg-white/20 transition-all font-inter"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('auth.signInLink') || 'Log in'}
            </Link>
            <Link 
              href="/auth?mode=register" 
              className="w-full py-3.5 text-center text-[16px] font-semibold bg-black dark:bg-white text-white dark:text-black rounded-full font-inter font-bold hover:opacity-90 transition-opacity shadow-sm"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t('pricing.free.cta') || 'Start with Makinari'}
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

