'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/app/components/ui/table'
import { DocumentListHead, documentListShellClassName } from '@/app/components/documents/document-list'
import { ProcurementToolbarSkeleton } from './toolbar-skeleton'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import type { ReactNode } from 'react'

export function ProcurementListSkeleton({ columns = 4, board = false, stages = 5, minWidth }: {
  columns?: number; board?: boolean; stages?: number; minWidth?: string
}) {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingRecords')} aria-busy="true">
    {board ? <div aria-hidden="true" className="flex gap-4 overflow-x-auto">
      {Array.from({ length: stages }, (_, index) => <section key={index} className="min-w-64 flex-1 rounded-xl bg-muted/60 p-3">
        <Skeleton className="mb-3 h-5 w-32 motion-reduce:animate-none" />
        <Skeleton className="h-28 w-full rounded-lg motion-reduce:animate-none" />
      </section>)}
    </div> : <div aria-hidden="true" className={documentListShellClassName()}><Table className={minWidth}>
      <TableHeader><TableRow>{Array.from({ length: columns }, (_, index) => <DocumentListHead key={index}>
        <Skeleton className="h-3 w-16 motion-reduce:animate-none" />
      </DocumentListHead>)}</TableRow></TableHeader>
      <TableBody>{Array.from({ length: 6 }, (_, row) => <TableRow key={row}>
        {Array.from({ length: columns }, (_, cell) => <TableCell key={cell} className="px-4 py-3">
          {cell === 0 ? <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full motion-reduce:animate-none" />
            <div className="min-w-0 space-y-2"><Skeleton className="h-4 w-36 motion-reduce:animate-none" /><Skeleton className="h-3 w-20 motion-reduce:animate-none" /></div>
          </div> : <Skeleton className="h-4 w-20 motion-reduce:animate-none" />}
        </TableCell>)}
      </TableRow>)}</TableBody>
    </Table></div>}
  </div>
}

export function ProcurementListLoading({ columns = 4, minWidth, children }: {
  columns?: number; minWidth?: string; children?: ReactNode
}) {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="flex h-[calc(100dvh-var(--topbar-height,64px))] w-full min-w-0 flex-1 flex-col bg-muted/30">
    <ProcurementToolbarSkeleton />
    <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 md:p-6 lg:p-8">
      {children ?? <ProcurementListSkeleton columns={columns} minWidth={minWidth} />}
    </div>
  </div>
}

/** Detail screens have tabs/status, not list search/filter controls. */
export function DetailToolbarSkeleton() {
  return <StickyHeader><div aria-hidden="true" className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
    <div className="flex min-w-0 max-w-full gap-2 overflow-hidden">
      {[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-8 w-20 shrink-0 rounded-full motion-reduce:animate-none" />)}
    </div>
    <Skeleton className="h-7 w-28 rounded-full motion-reduce:animate-none" />
  </div></StickyHeader>
}