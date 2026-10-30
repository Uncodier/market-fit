'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

export function ProcurementEditorFieldsSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="space-y-5">
    <div aria-hidden="true" className="space-y-5">
      <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
      <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-20 w-full" /></div>
      <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(index => <div key={index} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>)}</div>
      <div className="space-y-3 rounded border p-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-20 w-full" /><div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></div>
    </div>
  </div>
}

/** The current create/edit routes are dialogs, including on direct navigation. */
export function ProcurementEditorLoading() {
  const { t } = useProcurementI18n()
  return <Dialog open><DialogContent size="lg" showClose={false} busy>
    <DialogHeader><DialogTitle className="sr-only">{t('procurement.common.loadingContent')}</DialogTitle><DialogDescription className="sr-only">{t('procurement.common.loadingContent')}</DialogDescription>
      <div aria-hidden="true" className="space-y-2"><Skeleton className="h-6 w-48 max-w-full" /><Skeleton className="h-4 w-full" /></div>
    </DialogHeader>
    <DialogBody><ProcurementEditorFieldsSkeleton /></DialogBody>
    <DialogFooter><div aria-hidden="true" className="flex gap-2"><Skeleton className="h-9 w-24 rounded-full" /><Skeleton className="h-9 w-36 rounded-full" /></div></DialogFooter>
  </DialogContent></Dialog>
}