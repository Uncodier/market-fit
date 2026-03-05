"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { SiteHeader } from "@/app/components/navigation/SiteHeader"
import { useLocalization } from "@/app/context/LocalizationContext"

export function CookiesClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-cyan-500/30 flex flex-col  overflow-hidden min-h-screen">
      <SiteHeader />
      
      {/* Content Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 w-fit">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('footer.company.cookies') || 'Cookie Policy'}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 leading-tight drop-shadow-lg">
            Cookie <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Policy</span>
          </h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-light leading-relaxed">
            <p className="mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">1. What Are Cookies</h2>
            <p className="mb-6">
              Cookies are small data files that are placed on your computer or mobile device when you visit a website. Cookies are widely used by website owners in order to make their websites work, or to work more efficiently, as well as to provide reporting information. Cookies set by the website owner (Makinari) are called "first-party cookies." Cookies set by parties other than the website owner are called "third-party cookies."
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">2. Why We Use Cookies</h2>
            <p className="mb-4">
              We use first- and third-party cookies for several reasons. Some cookies are required for technical reasons in order for our Website and Services to operate, and we refer to these as "essential" or "strictly necessary" cookies. Other cookies also enable us to track and target the interests of our users to enhance the experience on our Online Properties. Third parties serve cookies through our Website for advertising, analytics, and other purposes.
            </p>
            <p className="mb-6">
              The specific types of first- and third-party cookies served through our Website and the purposes they perform are described below:
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">3. Types of Cookies We Use</h2>
            <ul className="list-disc pl-6 mb-6 space-y-4">
              <li>
                <strong>Essential Cookies:</strong> These cookies are strictly necessary to provide you with services available through our Website and to use some of its features, such as access to secure areas, maintaining your session state, and ensuring authentication.
              </li>
              <li>
                <strong>Performance and Functionality Cookies:</strong> These cookies are used to enhance the performance and functionality of our Website but are non-essential to their use. However, without these cookies, certain functionality (like videos or personalization) may become unavailable.
              </li>
              <li>
                <strong>Analytics and Customization Cookies:</strong> These cookies collect information that is used either in aggregate form to help us understand how our Website is being used or how effective our marketing campaigns are, or to help us customize our Website for you.
              </li>
              <li>
                <strong>Advertising Cookies:</strong> These cookies are used to make advertising messages more relevant to you. They perform functions like preventing the same ad from continuously reappearing, ensuring that ads are properly displayed for advertisers, and in some cases selecting advertisements that are based on your interests.
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">4. Managing Cookies</h2>
            <p className="mb-4">
              You have the right to decide whether to accept or reject cookies. You can exercise your cookie rights by setting your preferences in the Cookie Consent Manager. The Cookie Consent Manager allows you to select which categories of cookies you accept or reject. Essential cookies cannot be rejected as they are strictly necessary to provide you with services.
            </p>
            <p className="mb-6">
              You can also set or amend your web browser controls to accept or refuse cookies. If you choose to reject cookies, you may still use our website though your access to some functionality and areas of our website may be restricted. As the means by which you can refuse cookies through your web browser controls vary from browser-to-browser, you should visit your browser's help menu for more information.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">5. Contact Us</h2>
            <p className="mb-6">
              If you have any questions about our use of cookies or other technologies, please email us at privacy@makinari.com.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
