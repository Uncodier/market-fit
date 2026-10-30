'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { DetailToolbarSkeleton } from '@/app/purchases/procurement/ui/list-loading'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function SupplierDetailSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30">
    <DetailToolbarSkeleton />
    <div aria-hidden="true" className="min-h-0 min-w-0 flex-1 space-y-6 overflow-auto bg-background px-4 py-5 lg:px-8">
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start"><div className="flex min-w-0 gap-3"><Skeleton className="h-11 w-11 shrink-0 rounded-full" /><div className="min-w-0 space-y-2"><Skeleton className="h-6 w-64 max-w-full" /><Skeleton className="h-4 w-48 max-w-full" /><Skeleton className="h-3 w-40 max-w-full" /></div></div><Skeleton className="h-8 w-32" /></header>
      <div className="!mt-5 flex flex-col border-t border-border/50 lg:flex-row">
        <main className="w-full min-w-0 pt-5 lg:flex-1 lg:pr-8"><div className="space-y-4 rounded-xl border p-6"><Skeleton className="h-5 w-40" /><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /></div></main>
        <aside className="w-full shrink-0 pt-5 lg:w-[340px] lg:border-l lg:border-border/50 lg:pl-8 xl:w-[380px]"><div className="space-y-5 lg:sticky lg:top-0">{Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-full" /></div>)}</div></aside>
      </div>
    </div>
  </div>
}