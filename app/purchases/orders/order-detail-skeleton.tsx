'use client'

import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Skeleton } from '@/app/components/ui/skeleton'
import { PurchaseDocumentSkeleton } from '../requests/request-detail-skeleton'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'

export function PurchaseOrderDetailSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="flex min-h-[calc(100vh-var(--topbar-height,64px))] flex-1 flex-col bg-muted/30">
    <StickyHeader><div aria-hidden="true" className="flex w-full items-center justify-between gap-3 overflow-x-auto pt-0">
      <div className="flex shrink-0 gap-3"><Skeleton className="h-9 w-48 rounded-full" /><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-16" /></div><Skeleton className="h-7 w-32 shrink-0 rounded-full" />
    </div></StickyHeader>
    <div className="flex-1 overflow-auto p-4 md:p-6"><div className="mx-auto max-w-[800px] space-y-6"><PurchaseDocumentSkeleton /></div></div>
  </div>
}