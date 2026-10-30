'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { SectionCard } from '@/app/components/ui/section-card'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

/** One full detail fallback for route navigation, site hydration and initial retrieval. */
export function TenderDetailSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="min-w-0 flex-1 p-0">
    <StickyHeader>
      <div aria-hidden="true" className="flex w-full min-w-0 flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="flex min-w-0 flex-1 gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-8 w-24 shrink-0 rounded-full motion-reduce:animate-none" />)}
        </div>
        <div className="flex max-w-full gap-1 overflow-hidden rounded-full bg-muted/30 p-1 md:shrink-0">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-7 w-16 shrink-0 rounded-full motion-reduce:animate-none" />)}
        </div>
      </div>
    </StickyHeader>
    <div aria-hidden="true" className="px-4 lg:px-8 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full motion-reduce:animate-none" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-64 max-w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-32 max-w-full motion-reduce:animate-none" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-full motion-reduce:animate-none" />
          <Skeleton className="h-8 w-36 rounded-full motion-reduce:animate-none" />
          <Skeleton className="h-8 w-8 rounded-full motion-reduce:animate-none" />
        </div>
      </header>
      <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
        <main className="w-full min-w-0 lg:flex-1 pt-5 lg:pr-8">
          <SectionCard className="space-y-4 p-5">
            <Skeleton className="h-5 w-40 max-w-full motion-reduce:animate-none" />
            {Array.from({ length: 3 }, (_, index) => <div key={index} className="flex gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full motion-reduce:animate-none" />
              <Skeleton className="h-16 flex-1 rounded-lg motion-reduce:animate-none" />
            </div>)}
          </SectionCard>
          <SectionCard className="mt-5 space-y-3 p-5">
            <Skeleton className="h-5 w-40 motion-reduce:animate-none" />
            <Skeleton className="h-8 w-48 max-w-full motion-reduce:animate-none" />
          </SectionCard>
        </main>
        <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 border-t lg:border-t-0 lg:border-l border-border/50">
          <div className="space-y-5 lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)]">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36 motion-reduce:animate-none" />
              <Skeleton className="h-4 w-full motion-reduce:animate-none" />
              <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-4 w-48 max-w-full motion-reduce:animate-none" />
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, index) => <div key={index} className="flex items-start justify-between gap-4">
                <Skeleton className="h-4 w-28 motion-reduce:animate-none" />
                <Skeleton className="h-4 w-20 motion-reduce:animate-none" />
              </div>)}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full motion-reduce:animate-none" />
              <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
            </div>
            <Skeleton className="h-3 w-full motion-reduce:animate-none" />
          </div>
        </aside>
      </div>
    </div>
  </div>
}