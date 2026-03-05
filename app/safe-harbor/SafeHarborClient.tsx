"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { SiteHeader } from "@/app/components/navigation/SiteHeader"
import { useLocalization } from "@/app/context/LocalizationContext"

export function SafeHarborClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-cyan-500/30 flex flex-col  overflow-hidden min-h-screen">
      <SiteHeader />
      
      {/* Content Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 w-fit">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('footer.company.safeHarbor') || 'Safe Harbor Policy'}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 leading-tight drop-shadow-lg">
            Safe Harbor <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Policy</span>
          </h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-light leading-relaxed">
            <p className="mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">1. Forward-Looking Statements</h2>
            <p className="mb-4">
              This document, as well as our website, products, and other communications, may contain "forward-looking statements" within the meaning of the Private Securities Litigation Reform Act of 1995. These statements are based on our current expectations, estimates, forecasts, and projections about our business, industry, and the markets in which we operate.
            </p>
            <p className="mb-6">
              Forward-looking statements can often be identified by words such as "anticipate," "believe," "estimate," "expect," "intend," "may," "plan," "project," "target," "will," or similar expressions. These statements are not guarantees of future performance and involve known and unknown risks, uncertainties, and other factors that may cause our actual results, performance, or achievements to be materially different from any future results, performance, or achievements expressed or implied by such forward-looking statements.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">2. Product Roadmaps and Future Capabilities</h2>
            <p className="mb-4">
              Any information about future product capabilities, roadmaps, or release dates provided by Makinari, whether on our website, in presentations, or through other communications, is intended for informational purposes only.
            </p>
            <p className="mb-6">
              The development, release, and timing of any features or functionality described for our products remain at the sole discretion of Makinari. Customers should base their purchasing decisions solely upon features and functionality that are currently available. Our roadmaps do not represent a commitment, obligation, or promise to deliver any specific feature or functionality within any specified timeframe.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">3. AI Performance and Limitations</h2>
            <p className="mb-4">
              Our products utilize artificial intelligence, machine learning, and large language models (LLMs). While we strive for accuracy and reliability, AI-generated outputs, recommendations, or automated actions may be incomplete, inaccurate, or inappropriate for specific contexts.
            </p>
            <p className="mb-6">
              Users should independently verify the accuracy and suitability of any AI-generated content or actions. Makinari disclaims any liability for business losses, damages, or unintended consequences resulting from reliance on AI-automated workflows, agent executions, or system inferences. The performance of AI agents depends heavily on the accuracy and completeness of the data and instructions provided by the user.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">4. Non-Reliance</h2>
            <p className="mb-6">
              You should not rely upon forward-looking statements, product roadmaps, or AI performance estimates as predictions of future events. Makinari assumes no obligation to update any forward-looking statements or product roadmaps to reflect events or circumstances after the date they were made, except as required by law.
            </p>
            
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">5. Contact Us</h2>
            <p className="mb-6">
              If you have questions regarding our Safe Harbor Policy, please contact us at legal@makinari.com.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
