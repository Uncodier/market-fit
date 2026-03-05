"use client"

import React from "react"
import { SiteFooter } from "@/app/components/auth/sections/SiteFooter"
import { SiteHeader } from "@/app/components/navigation/SiteHeader"
import { useLocalization } from "@/app/context/LocalizationContext"

export function DpaClient() {
  const { t } = useLocalization()
  
  return (
    <div className="relative w-full dark:bg-[#030303] bg-white dark:text-white text-slate-900 selection:bg-cyan-500/30 flex flex-col  overflow-hidden min-h-screen">
      <SiteHeader />
      
      {/* Content Section */}
      <section className="relative w-full pt-32 pb-16 border-b dark:border-white/[0.04] border-black/5 dark:bg-black-paper bg-white-paper bg-white">
        <div className="relative z-10 w-full max-w-4xl mx-auto px-6 lg:px-12 flex flex-col">
          <div className="inline-flex items-center rounded-full dark:neu-black-chip neu-white-chip px-4 py-1.5 text-sm font-bold mb-8 w-fit">
            <span className="flex h-2 w-2 rounded-full bg-cyan-500 mr-2 animate-pulse"></span>
            {t('footer.company.dpa') || 'Data Processing Agreement'}
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-8 leading-tight drop-shadow-lg">
            Data Processing <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Agreement</span>
          </h1>
          
          <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 font-light leading-relaxed">
            <p className="mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">1. Scope and Application</h2>
            <p className="mb-6">
              This Data Processing Agreement ("DPA") supplements the Terms of Service between Makinari ("Processor") and the customer ("Controller"). It reflects the parties' agreement regarding the processing of personal data on behalf of the Controller in connection with the Services provided by Makinari under the Terms of Service.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">2. Processing of Personal Data</h2>
            <p className="mb-4">
              <strong>Controller Instructions:</strong> We shall process Customer Personal Data only on documented instructions from the Controller, including with regard to transfers of personal data to a third country or an international organization, unless required to do so by applicable law to which the Processor is subject.
            </p>
            <p className="mb-6">
              <strong>Nature and Purpose:</strong> The processing of Customer Personal Data is carried out to provide the Services as described in the Terms of Service, which includes storing data, providing AI-agent automation, routing data to large language models, and facilitating customer relationship management.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">3. Sub-processing</h2>
            <p className="mb-4">
              The Controller provides general authorization for the Processor to engage sub-processors to process Customer Personal Data on behalf of the Controller. The Processor currently engages third-party sub-processors to provide infrastructure services, AI capabilities, and customer support.
            </p>
            <p className="mb-6">
              The Processor will ensure that any sub-processor it engages provides sufficient guarantees to implement appropriate technical and organizational measures in such a manner that the processing will meet the requirements of applicable data protection laws.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">4. Data Subject Rights</h2>
            <p className="mb-6">
              We shall, taking into account the nature of the processing, assist the Controller by appropriate technical and organizational measures, insofar as this is possible, for the fulfillment of the Controller's obligation to respond to requests for exercising the data subject's rights laid down in applicable data protection laws. We will promptly notify the Controller if we receive a request from a data subject under any data protection laws in respect of Customer Personal Data.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">5. Security</h2>
            <p className="mb-6">
              Taking into account the state of the art, the costs of implementation and the nature, scope, context and purposes of processing as well as the risk of varying likelihood and severity for the rights and freedoms of natural persons, the Processor shall implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk.
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">6. International Transfers</h2>
            <p className="mb-6">
              Any transfer of Customer Personal Data outside the European Economic Area (EEA), the United Kingdom, or Switzerland to countries which do not ensure an adequate level of data protection shall be governed by appropriate safeguards, such as the Standard Contractual Clauses (SCCs).
            </p>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-10 mb-4">7. Contact Us</h2>
            <p className="mb-6">
              If you have any questions or require an executed copy of this DPA, please contact us at privacy@makinari.com.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
