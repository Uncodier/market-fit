'use client'

import { Skeleton } from '@/app/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/app/components/ui/table'
import { DocumentListHead, documentListShellClassName } from '@/app/components/documents/document-list'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

function RevisionTableSkeleton() {
  return <div className={documentListShellClassName()}>
    <Table className="table-auto" style={{ minWidth: '720px' }}>
      <TableHeader><TableRow>{[0, 1, 2, 3].map(column => <DocumentListHead key={column}><Skeleton className="h-4 w-24" /></DocumentListHead>)}</TableRow></TableHeader>
      <TableBody>{[0, 1, 2, 3].map(row => <TableRow key={row}>{[0, 1, 2, 3].map(column => <TableCell key={column}><Skeleton className="h-6 w-full" /></TableCell>)}</TableRow>)}</TableBody>
    </Table>
    <div className="flex justify-center p-4"><Skeleton className="h-9 w-48 rounded-full" /></div>
  </div>
}

export function CredentialsSkeleton({ contentOnly = false }: { contentOnly?: boolean }) {
  const { t } = useProcurementI18n()
  return <section role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true"
    data-account-skeleton="credentials" className="min-w-0 space-y-6">
    {!contentOnly && <div aria-hidden="true" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-8 w-52 max-w-full" /><Skeleton className="h-10 w-40" /></div>
      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
    </div>}
    <div aria-hidden="true" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-7 w-48" /><div className="flex gap-2"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-28" /></div></div>
      <RevisionTableSkeleton />
    </div>
  </section>
}

export function SubmissionsSkeleton() {
  const { t } = useProcurementI18n()
  return <section role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true"
    data-account-skeleton="submissions" className="space-y-6">
    <div aria-hidden="true" className="flex min-h-[72px] w-full flex-wrap items-center justify-between gap-3 py-3 bg-transparent">
      <div className="flex gap-1 rounded-full bg-muted/30 p-0.5">{[0, 1, 2].map(tab => <Skeleton key={tab} className="h-7 w-24 rounded-full" />)}</div>
      <Skeleton className="h-9 w-36" />
    </div>
    <div aria-hidden="true" className="space-y-3"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-3/4" /><RevisionTableSkeleton /></div>
  </section>
}

export function AccountProfileSkeleton({ credentials = false }: { credentials?: boolean }) {
  const { t } = useProcurementI18n()
  return <div className="min-w-0 space-y-8">
    <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" data-account-skeleton="profile"
      className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full space-y-8">
      <div aria-hidden="true" className="flex flex-col items-center text-center space-y-4 py-8">
        <Skeleton className="h-24 w-24 rounded-full" /><div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-5 w-48" /></div>
      </div>
      <div aria-hidden="true" className="space-y-4"><div className="rounded-xl border divide-y">{[0, 1].map(row => <div key={row} className="p-4 flex items-center gap-3"><Skeleton className="h-5 w-5" /><Skeleton className="h-5 w-40" /></div>)}</div><Skeleton className="h-11 w-full" /></div>
    </div>
    {credentials && <CredentialsSkeleton />}
  </div>
}