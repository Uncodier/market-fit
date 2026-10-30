'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { TenderSubmissionEntry } from './submission-entry'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { PdpCtaButton } from '@/app/components/commerce/pdp/PdpCtaButton'
import { PdpMetricChips } from '@/app/components/commerce/pdp/PdpMetricChips'
import { PdpMobileBuyBar } from '@/app/components/commerce/pdp/PdpMobileBuyBar'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { TenderHeader, TenderFooter } from './public-header'
import { tenderDetailClasses } from './detail-presentation'
import { TenderBuyerContext, TenderProcessGuide } from './detail-context'
import type { PublicTenderRow } from './public-data'
import { DemoSubmissionPreview } from '@/app/home/submissions/demo-submission-preview'
import { demoPortalOpportunities } from '@/lib/demo-data/procurement-portal'

/** Only the already-public snapshot crosses this presentation boundary. */
export function TenderDetailView({ siteSlug, tenderSlug, tender, closed = true, error, demo = false }: {
  siteSlug: string; tenderSlug: string; tender?: PublicTenderRow; closed?: boolean; error?: string; demo?: boolean
}) {
  const { t, message, valueLabel, formatDate, formatNumber } = useProcurementI18n()
  const searchParams = useSearchParams()
  const [proposalOpen, setProposalOpen] = useState(searchParams.get('submit') === '1')
  const { user } = useAuthContext()
  const [submittedBy, setSubmittedBy] = useState<string | null>(null)
  const submitted = !!user && submittedBy === `${user.id}:${tender?.publication_id}`
  const utcDate = (value: string) => formatDate(value, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
  if (error || !tender) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TenderHeader siteSlug={siteSlug} />
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
          <div role="alert" className="space-y-3 py-8">
            <h1 className="text-2xl font-bold">{t('procurement.portal.public.detailLoadFailed')}</h1>
            <p>{message(error)}</p>
            <Button variant="outline" asChild>
              <Link href={`/tenders/${siteSlug}/${tenderSlug}`}>{t('procurement.common.retry')}</Link>
            </Button>
          </div>
        </main>
        <TenderFooter />
      </div>
    )
  }
  const terms = tender.snapshot
  const participation = t(closed ? 'procurement.portal.public.closed' : 'procurement.portal.public.open')
  const submissionCta = submitted ? (
    <Button asChild size="lg" className="w-full"><Link href="/home/submissions">{t('procurement.portal.public.mySubmissions')}</Link></Button>
  ) : closed ? (
    <Button disabled size="lg" className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold rounded-xl">
      {participation}
    </Button>
  ) : (
    <PdpCtaButton onClick={() => setProposalOpen(true)}>
      {demo ? 'Preview proposal' : t('procurement.portal.public.submit')}
    </PdpCtaButton>
  )

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 lg:pb-0">
      <TenderHeader siteSlug={siteSlug} />
      <main className={tenderDetailClasses.main}>
        {demo && tenderSlug === 'demo-tender-awarded' && <div className="mb-6"><a className="underline" href="https://app.makinari.com/purchases/orders/demo-order-workplace?client=demo-procurement">View awarded order</a></div>}
        <nav aria-label={t('procurement.portal.public.navigation')} className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground break-words">
          <Link className="hover:underline" href="/tenders">{t('procurement.portal.public.tenders')}</Link>
          <span aria-hidden="true">/</span>
          <Link className="hover:underline min-w-0" href={`/tenders/${siteSlug}`}>{tender.site_name ?? siteSlug}</Link>
        </nav>
        <header className="mb-8 max-w-4xl">
          <PdpMetricChips className="mb-4" chips={[
            { label: valueLabel(terms.participation) },
            { label: participation },
          ]} />
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight break-words">{terms.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{t('procurement.portal.detail.publishedBy', { buyer: tender.site_name ?? siteSlug })}</p>
          <p className="mt-4 whitespace-pre-wrap break-words text-muted-foreground leading-relaxed">{terms.description}</p>
        </header>
        <div className={tenderDetailClasses.grid}>
          <div className="min-w-0 space-y-8">
            <TenderBuyerContext tender={tender} siteSlug={siteSlug} />
            <section aria-labelledby="tender-requirements" id="requirements" className="scroll-mt-28">
              <h2 id="tender-requirements" className={tenderDetailClasses.sectionTitle}>
                {t('procurement.portal.public.requirements')}
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">{t('procurement.portal.detail.requirementsHint')}</p>
              <div className={tenderDetailClasses.requirements}>
                {terms.requirements.map((line, index) => (
                  <article key={line.id} className={tenderDetailClasses.requirement}>
                    <h3 className="font-bold text-sm sm:text-base mb-2 text-foreground">
                      {t('procurement.portal.public.requirement', { number: formatNumber(index + 1), quantity: formatNumber(line.quantity), unit: line.unit })}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm sm:text-base text-muted-foreground leading-relaxed">{line.description}</p>
                  </article>
                ))}
              </div>
            </section>
            <TenderProcessGuide participation={terms.participation} openingPolicy={terms.opening_policy} />
          </div>

          <div className={tenderDetailClasses.summary}>
            <section aria-labelledby="tender-participation" className={tenderDetailClasses.actionPanel}>
              <h2 id="tender-participation" className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
                {t('procurement.portal.public.participation')}
              </h2>
              <p className="font-semibold mb-4">{participation}</p>
              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground break-words">
                <p>{t(`procurement.portal.detail.${terms.participation === 'open' ? 'openHint' : terms.participation === 'invitation_only' ? 'invitationHint' : 'approvedHint'}`)}</p>
                <p>{t('procurement.portal.public.policies', { participation: valueLabel(terms.participation), opening: valueLabel(terms.opening_policy) })}</p>
                <p className="rounded-xl bg-muted/60 p-4 font-semibold text-foreground"><time dateTime={terms.participation_deadline}>{t('procurement.portal.public.closes', { date: utcDate(terms.participation_deadline) })}</time></p>
                {terms.opening_policy === 'after_close' && <p><time dateTime={terms.opening_at}>{t('procurement.portal.public.opening', { date: utcDate(terms.opening_at) })}</time></p>}
                <dl className="flex justify-between gap-4 border-t pt-4"><dt>{t('procurement.portal.detail.currency')}</dt><dd className="font-semibold text-foreground">{terms.currency}</dd></dl>
              </div>
              <div className="mt-6 sm:mt-8">{submissionCta}</div>
              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{t('procurement.portal.detail.finalHint')}</p>
              <a href="#requirements" className="mt-4 inline-flex text-sm font-semibold underline underline-offset-4">{t('procurement.portal.detail.reviewTitle')}</a>
              <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">{t('procurement.portal.public.publishedVersion', { version: formatNumber(tender.version) })}</p>
            </section>
          </div>
        </div>
        <p className="mt-12 sm:mt-16 lg:mt-20 border-t pt-8 text-sm text-muted-foreground leading-relaxed">
          {t('procurement.portal.public.disclaimer')}
        </p>
      </main>
      <TenderFooter />
      <PdpMobileBuyBar fullWidthCta>{submissionCta}</PdpMobileBuyBar>
      {!closed && (demo ? <DemoSubmissionPreview opportunity={demoPortalOpportunities.find(row => row.publication_id === tender.publication_id) ?? demoPortalOpportunities[0]} open={proposalOpen} onCancel={() => setProposalOpen(false)} /> : <TenderSubmissionEntry publicationId={tender.publication_id} open={proposalOpen} onClose={() => setProposalOpen(false)} onSubmitted={() => { if (user) setSubmittedBy(`${user.id}:${tender.publication_id}`) }} returnTo={`/tenders/${siteSlug}/${tenderSlug}?submit=1`} />)}
    </div>
  )
}