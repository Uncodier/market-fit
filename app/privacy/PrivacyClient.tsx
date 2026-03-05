"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { SiteHeader } from "@/app/components/navigation/SiteHeader"
import { useLocalization } from "@/app/context/LocalizationContext"

export function PrivacyClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-cyan-500/30 flex flex-col  overflow-hidden min-h-screen">
      <SiteHeader />
      
      {/* Content Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 w-fit">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('footer.company.privacy') || 'Privacy Policy'}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 leading-tight drop-shadow-lg">
            Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Policy</span>
          </h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-light leading-relaxed">
            <p className="mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">1. Introduction</h2>
            <p className="mb-4">
              Welcome to Makinari ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about this privacy notice, or our practices with regards to your personal information, please contact us.
            </p>
            <p className="mb-6">
              When you visit our website, and more generally, use any of our services (the "Services", which include the Website), we appreciate that you are trusting us with your personal information. We take your privacy very seriously. In this privacy notice, we seek to explain to you in the clearest way possible what information we collect, how we use it, and what rights you have in relation to it.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">2. Information We Collect</h2>
            <p className="mb-4">
              We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.
            </p>
            <p className="mb-4">
              The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li><strong>Personal Information Provided by You.</strong> We collect names; phone numbers; email addresses; mailing addresses; contact preferences; billing addresses; and other similar information.</li>
              <li><strong>Payment Data.</strong> We may collect data necessary to process your payment if you make purchases, such as your payment instrument number, and the security code associated with your payment instrument.</li>
              <li><strong>Credentials.</strong> We collect passwords, password hints, and similar security information used for authentication and account access.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">
              We use personal information collected via our Services for a variety of business purposes described below. We process your personal information for these purposes in reliance on our legitimate business interests, in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-2">
              <li>To facilitate account creation and logon process.</li>
              <li>To post testimonials with your consent.</li>
              <li>To request feedback and to contact you about your use of our Services.</li>
              <li>To enable user-to-user communications with each user's consent.</li>
              <li>To manage user accounts and keep them in working order.</li>
              <li>To send administrative information to you.</li>
              <li>To protect our Services.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">4. Will Your Information Be Shared With Anyone?</h2>
            <p className="mb-6">
              We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations. We may process or share your data that we hold based on the following legal basis: Consent, Legitimate Interests, Performance of a Contract, or Legal Obligations.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">5. How Long Do We Keep Your Information?</h2>
            <p className="mb-6">
              We will only keep your personal information for as long as it is necessary for the purposes set out in this privacy notice, unless a longer retention period is required or permitted by law (such as tax, accounting or other legal requirements).
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">6. How Do We Keep Your Information Safe?</h2>
            <p className="mb-6">
              We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">7. Your Privacy Rights</h2>
            <p className="mb-6">
              Depending on where you are located, you may have certain rights under applicable data protection laws. These may include the right to request access and obtain a copy of your personal information, to request rectification or erasure, to restrict the processing of your personal information, and if applicable, to data portability.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">8. Controls for Do-Not-Track Features</h2>
            <p className="mb-6">
              Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">9. Updates to This Notice</h2>
            <p className="mb-6">
              We may update this privacy notice from time to time. The updated version will be indicated by an updated "Revised" date and the updated version will be effective as soon as it is accessible. We encourage you to review this privacy notice frequently to be informed of how we are protecting your information.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">10. Contact Us</h2>
            <p className="mb-6">
              If you have questions or comments about this notice, you may email us at contact@makinari.com.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
