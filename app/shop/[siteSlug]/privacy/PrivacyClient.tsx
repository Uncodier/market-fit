"use client"

import Link from "next/link"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ArrowLeft, Shield, User, Mail, Phone, Lock, Database } from "@/app/components/ui/icons"

export function PrivacyClient({ siteSlug, site }: { siteSlug: string, site: any }) {
  const { t } = useLocalization()

  return (
    <div className="flex-1 bg-[#fafafa] dark:bg-black w-full text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10 h-14 flex items-center justify-center">
        <div className="absolute left-0 top-0 bottom-0 flex items-center px-4">
          <Link
            href={`/shop/${siteSlug}`}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:inline-block">
              {t('shop.backToShop') || 'Back to shop'}
            </span>
          </Link>
        </div>
        <h1 className="text-base font-bold text-gray-900 dark:text-white truncate px-12">
          {t('shop.privacy.title') || 'Privacy Policy'}
        </h1>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          
          <div className="p-6 md:p-8 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-gray-950 flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full text-primary">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{site?.name} {t('shop.privacy.title') || 'Privacy Policy'}</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {t('shop.privacy.lastUpdated') || 'Last updated'}: {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-10">
            {/* Introduction */}
            <section>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('shop.privacy.intro') || `We are committed to protecting your privacy. This page explains what information we collect when you register and interact with our store, and how we use it to provide you with the best shopping experience.`}
              </p>
            </section>

            {/* What we collect */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/10 pb-2">
                <Database className="w-5 h-5 text-gray-400" />
                {t('shop.privacy.dataCollection.title') || 'Information We Collect'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                {t('shop.privacy.dataCollection.desc') || 'When you create an account, we collect the following information:'}
              </p>
              
              <ul className="grid sm:grid-cols-2 gap-4 mt-4">
                <li className="flex items-start gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                  <User className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 dark:text-gray-100 font-medium">{t('auth.name') || 'Name'}</strong>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('shop.privacy.dataCollection.nameDesc') || 'To personalize your experience and address you correctly.'}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                  <Mail className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 dark:text-gray-100 font-medium">{t('auth.email') || 'Email address'}</strong>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('shop.privacy.dataCollection.emailDesc') || 'For secure authentication, order confirmations, and essential updates.'}</span>
                  </div>
                </li>
                <li className="flex items-start gap-3 bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-white/5">
                  <Phone className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-gray-900 dark:text-gray-100 font-medium">{t('auth.phone') || 'Phone number'} <span className="text-xs font-normal text-gray-400">({t('auth.optional') || 'optional'})</span></strong>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('shop.privacy.dataCollection.phoneDesc') || 'For faster communication regarding your orders or deliveries.'}</span>
                  </div>
                </li>
              </ul>
            </section>

            {/* How we use it */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/10 pb-2">
                <Shield className="w-5 h-5 text-gray-400" />
                {t('shop.privacy.usage.title') || 'How We Use Your Data'}
              </h3>
              <ul className="space-y-3 text-gray-600 dark:text-gray-300 list-disc list-outside ml-5">
                <li className="pl-1 leading-relaxed">
                  <strong>{t('shop.privacy.usage.accountManagement') || 'Account Management'}: </strong>
                  {t('shop.privacy.usage.accountManagementDesc') || 'To create and secure your personal workspace or shopping account.'}
                </li>
                <li className="pl-1 leading-relaxed">
                  <strong>{t('shop.privacy.usage.orderFulfillment') || 'Order Fulfillment'}: </strong>
                  {t('shop.privacy.usage.orderFulfillmentDesc') || 'To process transactions, track orders, and provide customer support.'}
                </li>
                <li className="pl-1 leading-relaxed">
                  <strong>{t('shop.privacy.usage.communication') || 'Communication'}: </strong>
                  {t('shop.privacy.usage.communicationDesc') || 'To send you important notifications regarding your purchases or account security.'}
                </li>
              </ul>
            </section>

            {/* Security */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/10 pb-2">
                <Lock className="w-5 h-5 text-gray-400" />
                {t('shop.privacy.security.title') || 'Security & Storage'}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {t('shop.privacy.security.desc') || 'Your personal information is encrypted and stored securely using industry-standard infrastructure provided by Supabase. We do not sell your personal data to third parties. Access to your data is strictly limited to authorized systems required to process your orders.'}
              </p>
            </section>

          </div>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>{t('shop.privacy.poweredBy') || 'Powered securely by'} Makinari</p>
        </div>
      </div>
    </div>
  )
}
