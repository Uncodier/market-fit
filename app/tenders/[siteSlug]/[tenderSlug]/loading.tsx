'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { PdpMobileBuyBar } from '@/app/components/commerce/pdp/PdpMobileBuyBar'
import { TenderHeader, TenderFooter } from '../../public-header'
import { tenderDetailClasses } from '../../detail-presentation'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

/** PDP skeleton spacing and CTA surfaces, without product images or prices. */
export default function Loading() {
  const { t } = useProcurementI18n()
  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 lg:pb-0">
      <TenderHeader />
      <main aria-label={t('procurement.portal.public.loadingDetail')} aria-busy="true" className={tenderDetailClasses.main}>
        <div aria-hidden="true">
          <Skeleton className="h-5 w-48 mb-6" />
          <div className="mb-8 max-w-4xl space-y-4">
            <div className="flex gap-3"><Skeleton className="h-8 w-36 rounded-full" /><Skeleton className="h-8 w-24 rounded-full" /></div>
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className={tenderDetailClasses.grid}>
            <div className="min-w-0 space-y-8">
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2].map(card => <div key={card} className="rounded-2xl border p-6 space-y-4"><Skeleton className="h-5 w-5" /><Skeleton className="h-4 w-32" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-12 w-full" /></div>)}
              </div>
              <div>
                <Skeleton className="h-7 w-40 mb-4 sm:mb-6" />
                <div className={tenderDetailClasses.requirements}>
                  {[1, 2, 3].map(row => (
                    <div key={row} className={tenderDetailClasses.requirement}>
                      <Skeleton className="h-5 w-3/4 mb-3" />
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-5/6" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border p-6 space-y-5"><Skeleton className="h-7 w-48" />{[1, 2, 3].map(step => <Skeleton key={step} className="h-16 w-full" />)}</div>
            </div>
            <div className={tenderDetailClasses.summary}>
              <div className={tenderDetailClasses.actionPanel}>
                <Skeleton className="h-7 w-40 mb-4 sm:mb-6" />
                <Skeleton className="h-5 w-24 mb-4" />
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
                <Skeleton className="mt-6 sm:mt-8 w-full h-12 sm:h-14 rounded-xl" />
                <Skeleton className="mt-4 h-3 w-full" />
              </div>
            </div>
          </div>
          <div className="mt-12 sm:mt-16 lg:mt-20 border-t pt-8">
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
        </div>
      </main>
      <TenderFooter />
      <PdpMobileBuyBar fullWidthCta>
        <div aria-hidden="true"><Skeleton className="h-12 sm:h-14 w-full rounded-xl" /></div>
      </PdpMobileBuyBar>
    </div>
  )
}