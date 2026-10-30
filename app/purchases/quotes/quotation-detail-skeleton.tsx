'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'

export function QuotationDetailSkeleton() {
  const { t } = useProcurementI18n()
  return <div className="min-w-0 flex-1" role="status" aria-busy="true" aria-label={t('procurement.common.loadingContent')}>
    <StickyHeader><div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3" aria-hidden="true">
      <Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="h-7 w-28 shrink-0 rounded-full" />
    </div></StickyHeader>
    <div className="px-4 py-5 lg:px-8" aria-hidden="true">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 gap-3"><Skeleton className="h-11 w-11 shrink-0 rounded-full" /><div className="min-w-0 space-y-2">
          <Skeleton className="h-6 w-64 max-w-full" /><Skeleton className="h-4 w-48 max-w-full" /><Skeleton className="h-3 w-40 max-w-full" />
        </div></div><div className="flex shrink-0 gap-2"><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-20" /></div>
      </header>
      <div className="mt-5 flex flex-col border-t border-border/50 lg:flex-row">
        <main className="w-full min-w-0 pt-5 lg:flex-1 lg:pr-8"><div className="space-y-6">
          <div className="grid gap-4 rounded-xl border border-border/60 p-5 sm:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="space-y-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-full" /></div>)}</div>
          <Skeleton className="h-36 w-full rounded-xl" /><Skeleton className="h-64 w-full rounded-xl" />
        </div></main>
        <aside className="mt-5 w-full shrink-0 border-t border-border/50 pt-5 lg:mt-0 lg:w-[340px] lg:border-l lg:border-t-0 lg:pl-8 xl:w-[380px]">
          <div className="space-y-4 lg:sticky lg:top-[calc(var(--topbar-height,64px)+96px)]">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-8 w-full" />)}</div>
        </aside>
      </div>
    </div>
  </div>
}