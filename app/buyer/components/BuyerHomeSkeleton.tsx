"use client"

import { Card, CardContent } from '@/app/components/ui/card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function BuyerHomeSkeleton({ cardCount = 6 }: { cardCount?: number }) {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true"
    data-account-skeleton="home" className="flex flex-col w-full gap-8 py-4 md:py-8 px-4">
    <div aria-hidden="true" className="flex flex-col sm:flex-row sm:items-center gap-4 mb-2">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Skeleton className="h-16 w-16 shrink-0 rounded-full border shadow-sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-4 w-32 max-w-full" />
        </div>
      </div>
    </div>
    <div aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: cardCount }, (_, index) => <Card key={index} data-home-card-skeleton className="h-full shadow-sm border-border/50">
        <CardContent className="p-5 flex flex-col h-full relative">
          <div className="mb-4 flex items-center justify-between"><Skeleton className="h-6 w-6" /></div>
          <Skeleton className="h-5 w-36 max-w-full mb-1" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </CardContent>
      </Card>)}
    </div>
  </div>
}