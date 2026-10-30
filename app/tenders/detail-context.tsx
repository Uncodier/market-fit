'use client'

import Link from 'next/link'
import { MapPin, FileText, ShieldCheck } from '@/app/components/ui/icons'
import { TenderSiteLogo, TenderSiteCountries } from './site-branding'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import type { PublicTenderRow } from './public-data'

const key = (name: string) => `procurement.portal.detail.${name}`

/** Explain only published terms; workspace locations are not public delivery addresses. */
export function TenderBuyerContext({ tender, siteSlug }: { tender: PublicTenderRow; siteSlug: string }) {
  const { t } = useProcurementI18n()
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <section aria-labelledby="tender-buyer" className="rounded-2xl border bg-card p-5 sm:p-6 min-w-0">
        <div className="mb-3"><TenderSiteLogo logo={tender.site_logo_url} name={tender.site_name ?? siteSlug} /></div>
        <h2 id="tender-buyer" className="text-sm font-medium text-muted-foreground">{t(key('buyer'))}</h2>
        <p className="mt-2 text-lg font-bold break-words">{tender.site_name ?? siteSlug}</p>
        <TenderSiteCountries regions={tender.facets?.regions} className="mt-2" />
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(key('buyerHint'))}</p>
        <Link href={`/tenders/${siteSlug}`} className="inline-flex mt-4 text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">{t(key('buyerTenders'))}</Link>
      </section>
      <section aria-labelledby="tender-location" className="rounded-2xl border bg-card p-5 sm:p-6 min-w-0">
        <MapPin aria-hidden={true} className="h-5 w-5 text-muted-foreground mb-3" />
        <h2 id="tender-location" className="text-sm font-medium text-muted-foreground">{t(key('location'))}</h2>
        <p className="mt-2 text-base font-semibold">{t(key('locationMissing'))}</p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(key('locationHint'))}</p>
      </section>
    </div>
  )
}

export function TenderProcessGuide({ participation, openingPolicy }: { participation: string; openingPolicy: string }) {
  const { t, valueLabel, formatNumber } = useProcurementI18n()
  const eligibility = participation === 'open' ? 'openHint' : participation === 'invitation_only' ? 'invitationHint' : 'approvedHint'
  return (
    <section aria-labelledby="tender-guide" className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 id="tender-guide" className="text-xl font-bold">{t(key('howItWorks'))}</h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(key('intro'))}</p>
      <ol className="mt-6 space-y-5">
        {['review', 'prepare', 'submit'].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{formatNumber(index + 1)}</span>
            <div><h3 className="text-sm font-semibold">{t(key(`${step}Title`))}</h3><p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t(key(`${step}Hint`))}</p></div>
          </li>
        ))}
      </ol>
      <div className="mt-6 border-t pt-5 space-y-3">
        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <ShieldCheck aria-hidden={true} className="inline h-4 w-4 mr-2" />{t(key('eligibility'))}
          </summary>
          <p className="pt-2 text-sm text-muted-foreground leading-relaxed">{t(key(eligibility))}</p>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-semibold py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <FileText aria-hidden={true} className="inline h-4 w-4 mr-2" />{t(key('openingQuestion'))}
          </summary>
          <p className="pt-2 text-sm text-muted-foreground leading-relaxed">{valueLabel(openingPolicy)}. {t(key(openingPolicy === 'on_receipt' ? 'receiptHint' : 'openingHint'))}</p>
        </details>
      </div>
    </section>
  )
}