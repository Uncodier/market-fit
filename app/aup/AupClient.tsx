"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { SiteHeader } from "@/app/components/navigation/SiteHeader"
import { useLocalization } from "@/app/context/LocalizationContext"

export function AupClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-cyan-500/30 flex flex-col  overflow-hidden min-h-screen">
      <SiteHeader />
      
      {/* Content Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 w-fit">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('footer.company.aup') || 'Acceptable Use Policy'}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 leading-tight drop-shadow-lg">
            Acceptable Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Policy</span>
          </h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-light leading-relaxed">
            <p className="mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">1. Introduction</h2>
            <p className="mb-6">
              This Acceptable Use Policy ("AUP") outlines the unacceptable uses of Makinari's software, services, and network ("Services"). By accessing or using the Services, you agree to comply with this AUP. We reserve the right to modify this policy at any time, effective upon posting of the modified policy.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">2. Prohibited Uses</h2>
            <p className="mb-4">You may not use the Services for any illegal, harmful, or abusive activity, including but not limited to:</p>
            <ul className="list-disc pl-6 mb-6 space-y-4">
              <li>
                <strong>Illegal Activities:</strong> Using the Services in connection with criminal or civil violations of state, federal, or international laws, regulations, or other government requirements.
              </li>
              <li>
                <strong>Spam and Unsolicited Messaging:</strong> Transmitting massive amounts of unsolicited commercial messages ("spam") or interfering with the electronic mail services of other networks. You must adhere to anti-spam legislation such as the CAN-SPAM Act.
              </li>
              <li>
                <strong>Harmful Content:</strong> Creating, distributing, or storing material that is harmful, harassing, defamatory, obscene, fraudulent, or promotes violence or discrimination.
              </li>
              <li>
                <strong>Malicious Software:</strong> Distributing viruses, malware, trojan horses, worms, or any other malicious or destructive code or software.
              </li>
              <li>
                <strong>AI Misuse:</strong> Using our AI agents to automate deceptive practices, impersonate individuals without their consent, circumvent security controls, or engage in large-scale scraping that violates third-party terms of service.
              </li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">3. Security Violations</h2>
            <p className="mb-4">Any violation of the security of the Services or our network is prohibited and may result in criminal and civil liability. Such violations include:</p>
            <ul className="list-disc pl-6 mb-6 space-y-4">
              <li>Accessing data, servers, or accounts that you are not authorized to access.</li>
              <li>Probing, scanning, or testing the vulnerability of a system or network without authorization.</li>
              <li>Interfering with service to any user, host, or network, including via means of overloading, "flooding," "mailbombing," or "crashing."</li>
              <li>Forging any TCP/IP packet header or any part of the header information in any email or newsgroup posting.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">4. Enforcement</h2>
            <p className="mb-4">
              We reserve the right, but do not assume the obligation, to investigate any violation of this AUP or misuse of the Services. We may:
            </p>
            <ul className="list-disc pl-6 mb-6 space-y-4">
              <li>Investigate violations of this AUP or misuse of the Services.</li>
              <li>Suspend, modify, or terminate your access to the Services.</li>
              <li>Remove or disable access to any content or resource that violates this AUP.</li>
              <li>Report any activity that we suspect violates any law or regulation to appropriate law enforcement officials, regulators, or other appropriate third parties.</li>
            </ul>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">5. Contact Us</h2>
            <p className="mb-6">
              If you become aware of any violation of this policy by any person, please report it to us immediately at abuse@makinari.com.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
