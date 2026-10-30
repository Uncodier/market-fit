'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { DetailToolbarSkeleton } from '../procurement/ui/list-loading'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'

export function PurchaseDocumentSkeleton() {
  return <article aria-hidden="true" className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
    <header className="flex flex-wrap justify-between gap-4 border-b border-border bg-muted/50 p-6">
      <div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-32" /></div>
      <div className="space-y-2"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-4 w-28" /></div>
    </header>
    <section className="grid gap-6 border-b border-border p-6 sm:grid-cols-2">{[0, 1].map(index => <div key={index} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>)}</section>
    <section className="space-y-4 p-4 sm:p-6"><Skeleton className="h-5 w-32" />{[0, 1, 2].map(index => <div key={index} className="grid grid-cols-4 gap-3 border-b py-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /></div>)}<Skeleton className="ml-auto h-24 w-48 max-w-full" /></section>
  </article>
}

export function RequestDetailSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30">
    <DetailToolbarSkeleton />
    <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="mx-auto grid w-full max-w-[1240px] min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,800px)_minmax(320px,1fr)]">
        <PurchaseDocumentSkeleton />
        <aside aria-hidden="true" className="min-w-0 space-y-4"><Skeleton className="h-9 w-full rounded-full" />{[0, 1, 2].map(index => <Skeleton key={index} className="h-24 w-full rounded-xl" />)}</aside>
      </div>
    </div>
  </div>
}