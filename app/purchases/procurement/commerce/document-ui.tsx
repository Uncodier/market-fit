'use client'

import { useState, type ReactNode } from 'react'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/app/components/ui/table'
import { DocumentListHead, DocumentListRow, documentListShellClassName } from '@/app/components/documents/document-list'
import { SearchInput } from '@/app/components/ui/search-input'
import { Tabs, TabsList, TabsTrigger } from '@/app/components/ui/tabs'
import { Pagination } from '@/app/components/ui/pagination'
import { Skeleton } from '@/app/components/ui/skeleton'
import { StickyHeader } from '@/app/components/ui/sticky-header'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { FileText } from '@/app/components/ui/icons'
import { AccountSearch } from '@/app/buyer/components/AccountSearch'

/** Neutral document presentation; no seller identity or commerce mutations. */
export function DocumentToolbar({ tabs, value, onChange, search, onSearch, actions, workspace = false, transparent = false }: {
  tabs: { value: string; label: string }[]; value: string; onChange: (value: string) => void
  search: string; onSearch: (value: string) => void; actions?: ReactNode; workspace?: boolean; transparent?: boolean
}) {
  const { t } = useProcurementI18n()
  const content = <div className={`flex min-h-[72px] w-full flex-wrap items-center justify-between gap-3 py-3 ${transparent ? 'bg-transparent' : 'bg-background'}`}>
    <div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto">
      <Tabs value={value} onValueChange={onChange}><TabsList className="h-8 rounded-full bg-muted/30 p-0.5">
        {tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value} className="rounded-full text-xs">{tab.label}</TabsTrigger>)}
      </TabsList></Tabs>
      {workspace ? <SearchInput placeholder={t('procurement.partners.commerce.search')} value={search} onChange={event => onSearch(event.target.value)} />
        : <AccountSearch placeholder={t('procurement.partners.commerce.search')} value={search} onChange={event => onSearch(event.target.value)} />}
    </div><div data-secondary-actions className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
  </div>
  return workspace ? <StickyHeader>{content}</StickyHeader> : <div>{content}</div>
}

export function DocumentTable<T extends { id: string }>({ rows, columns, loading, empty, emptyDescription = '', emptyIcon, compact = false }: {
  rows: T[]; columns: { label: string; render: (row: T) => ReactNode }[]; loading?: boolean; empty: string
  emptyDescription?: string; emptyIcon?: ReactNode; compact?: boolean
}) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / 20))
  const current = Math.min(page, pages)
  if (!loading && !rows.length) return <EmptyCard title={empty} description={emptyDescription} icon={emptyIcon ?? <FileText size={24} />}
    showHint={false} showShadow={!compact} contentClassName={compact ? 'min-h-[180px] py-6' : undefined} />
  return <div className={documentListShellClassName()}>
    <Table className="table-auto" style={{ minWidth: `${Math.max(480, columns.length * 180)}px` }}><TableHeader><TableRow>{columns.map(column => <DocumentListHead key={column.label}>{column.label}</DocumentListHead>)}</TableRow></TableHeader>
      <TableBody>{loading ? Array.from({ length: 4 }, (_, index) => <TableRow key={index}>{columns.map(column => <TableCell key={column.label}><Skeleton className="h-6 w-full" /></TableCell>)}</TableRow>)
        : rows.slice((current - 1) * 20, current * 20).map(row => <DocumentListRow key={row.id}>{columns.map(column => <TableCell key={column.label} className="break-words align-middle">{column.render(row)}</TableCell>)}</DocumentListRow>)}</TableBody>
    </Table><Pagination currentPage={current} totalPages={pages} onPageChange={setPage} />
  </div>
}

export function DocumentDialog({ open, onClose, title, description, busy, children }: {
  open: boolean; onClose: () => void; title: string; description: string; busy?: boolean; children: ReactNode
}) {
  const { t } = useProcurementI18n()
  return <Dialog open={open} onOpenChange={next => { if (!next && !busy) onClose() }}>
    <DialogContent size="lg" className="text-sm" closeLabel={t('procurement.navigation.closeDialog')} busy={busy} onInteractOutside={event => event.preventDefault()}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
}