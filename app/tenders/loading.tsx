'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { TenderHeader, TenderFooter } from './public-header'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export default function Loading() {
  const { t } = useProcurementI18n()
  return <div className="flex flex-col min-h-screen bg-background"><TenderHeader /><main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12" aria-label={t('procurement.portal.public.loading')} aria-busy="true">
    <div className="flex flex-col md:flex-row gap-8 items-start">
      <aside aria-hidden="true" className="w-full md:w-64 shrink-0 space-y-8 hidden md:block pb-4 md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:overflow-y-auto"><div><Skeleton className="h-6 w-32 mb-4" /><div className="space-y-1">{[1, 2, 3].map(i => <Skeleton key={i} className="h-11 w-full rounded-lg" />)}</div></div>
        {[0, 1].map(group => <div key={group} className="space-y-3"><Skeleton className="h-5 w-32" />{[0, 1, 2].map(row => <Skeleton key={row} className="h-9 w-full" />)}</div>)}
      </aside>
      <div aria-hidden="true" className="flex-1 min-w-0 w-full">
      <div className="space-y-4 mb-8"><Skeleton className="h-5 w-48" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-10 max-w-2xl w-full" /></div>
      <div className="md:hidden sticky top-[72px] z-30 -mx-4 pt-2 pb-4 mb-4 bg-background/95"><div className="flex gap-3 overflow-x-auto px-4 py-2">{[0, 1, 2].map(index => <Skeleton key={index} className="h-11 w-24 shrink-0 rounded-full" />)}</div></div>
      <div className="md:hidden mb-6 space-y-6">{[0, 1].map(group => <div key={group} className="space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>)}</div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-4 w-48" /><Skeleton className="h-9 w-32 rounded-full" /></div>
      <Skeleton className="md:hidden mb-4 h-3 w-full" />
      <div className="space-y-3">{Array.from({ length: 6 }, (_, index) =>
        <div key={index} className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <div><Skeleton className="h-5 w-40 mb-3" /><Skeleton className="h-7 w-2/3" /><Skeleton className="mt-2 h-5 w-5/6" /><Skeleton className="mt-4 h-4 w-40" /></div>
            <div className="space-y-5"><Skeleton className="h-12 w-full" /><Skeleton className="h-5 w-28" /></div>
          </div>
        </div>)}</div>
    </div>
    </div>
  </main><TenderFooter /></div>
}