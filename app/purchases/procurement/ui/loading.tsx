'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { ProcurementToolbarSkeleton } from './toolbar-skeleton'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

/** The shell owns the sidebar/TopBar; only full-screen fallbacks own a toolbar. */
export function ProcurementLoading({ compact = false }: { compact?: boolean }) {
  const { t } = useProcurementI18n()
  const content = (
    <div className="space-y-4 rounded-xl border bg-background p-6" aria-hidden="true">
      <Skeleton className="h-6 w-48" />
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
    </div>
  )
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className={compact ? 'w-full space-y-4' : 'flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30'}>
    {compact ? content : <>
      <ProcurementToolbarSkeleton />
      <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 md:p-6 lg:p-8">{content}</div>
    </>}
  </div>
}