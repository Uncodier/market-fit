'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSite } from '@/app/context/SiteContext'
import { ProcurementWorkspace, ProcurementToolbar, ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/app/components/ui/table'
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from '@/app/components/documents/document-list'
import { Pagination } from '@/app/components/ui/pagination'
import { ViewSelector, type ViewType } from '@/app/components/view-selector'
import { humanize } from '@/app/purchases/procurement/components/form-fields'
import { Button } from '@/app/components/ui/button'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { isRealSiteId } from '@/lib/demo-utils'
import type { Tender } from './schema'

export function TenderList() {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return <p className="p-6">Select a real workspace to manage tenders.</p>
  return <WorkspaceList key={currentSite.id} siteId={currentSite.id} />
}
function WorkspaceList({ siteId }: { siteId: string }) {
  const [rows, setRows] = useState<Tender[]>([]), [count, setCount] = useState(0)
  const [page, setPage] = useState(0), [status, setStatus] = useState(''), [search, setSearch] = useState('')
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [reload, setReload] = useState(0)
  const [view, setView] = useState<ViewType>('table')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => { setLoading(true); setError('') }, 0)
    fetch(`/api/procurement/tenders?site_id=${siteId}&page=${page}&status=${status}&search=${encodeURIComponent(search)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { clearTimeout(timer); if (!controller.signal.aborted) { setRows(result.tenders); setCount(result.count); setError('') } })
      .catch(reason => { clearTimeout(timer); if (!controller.signal.aborted) setError(reason.message || 'Unable to load tenders') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, page, status, search, reload])
  const visibleRows = rows.filter(row => row.title.toLowerCase().includes(search.toLowerCase()))
  const stages = ['draft', 'published', 'closed', 'cancelled']
  return <ProcurementWorkspace title={'Tenders'} toolbar={<ProcurementToolbar search={search} onSearch={value => { setSearch(value); setPage(0) }} placeholder="Search tenders" status={status || 'all'} onStatus={value => { setStatus(value === 'all' ? '' : value); setPage(0) }}
    statuses={[{ value: 'all', label: 'All tenders' }, ...stages.map(value => ({ value, label: humanize(value) }))]}
    actions={<Button variant="ghost" size="sm" asChild><Link href="/tenders">Public directory</Link></Button>}
    viewSelector={<ViewSelector currentView={view} onViewChange={setView} />} />}>
    <TopBarPrimaryActions><Button size="sm" asChild><Link href="/purchases/tenders/new">Create tender</Link></Button></TopBarPrimaryActions>
    <ProcurementState loading={loading} error={error} empty={!loading && !error && !visibleRows.length} emptyTitle="No tenders match this view." description="Adjust your filters or create a new tender." onRetry={() => setReload(value => value + 1)} />
    {!loading && !error && <>
      {view === 'table' && !!visibleRows.length && <div className={documentListShellClassName()}><Table><TableHeader><TableRow>
        <DocumentListHead>Tender</DocumentListHead><DocumentListHead>Status</DocumentListHead><DocumentListHead>Net amount</DocumentListHead><DocumentListHead>Participation closes</DocumentListHead>
      </TableRow></TableHeader><TableBody>{visibleRows.map(row => <DocumentListRow key={row.id}>
        <TableCell className="px-4 py-3"><Link aria-label={row.title} href={`/purchases/tenders/${row.id}`}><EntityCell name={row.title} secondary={`Version ${row.version}`} secondaryMono={false} /></Link></TableCell>
        <TableCell className="px-4 py-3"><StatusDot status={row.status} label={humanize(row.status)} /></TableCell>
        <TableCell className="px-4 py-3 text-sm">{row.currency} {(Number(row.net_amount_minor) / 100).toFixed(2)}</TableCell><TableCell className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.participation_deadline).toLocaleString('en')}</TableCell>
      </DocumentListRow>)}</TableBody></Table></div>}
      {view === 'kanban' && <><p className="text-xs text-muted-foreground">Read-only board for this page. Open a tender to perform authorized transitions.</p><div className="flex gap-4 overflow-x-auto">{stages.map(stage => <section key={stage} className="min-w-64 flex-1 rounded-xl bg-muted/60 p-3"><h2 className="mb-3 flex justify-between text-sm font-medium">{humanize(stage)}<span>{visibleRows.filter(row => row.status === stage).length}</span></h2><div className="space-y-3">{visibleRows.filter(row => row.status === stage).map(row => <Link key={row.id} href={`/purchases/tenders/${row.id}`} className="block rounded-lg border bg-card p-4 shadow-sm"><EntityCell name={row.title} /><p className="mt-3 text-sm text-muted-foreground">{row.currency} {(Number(row.net_amount_minor) / 100).toFixed(2)}</p></Link>)}</div></section>)}</div></>}
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{count} tenders · Page {page + 1}</p><Pagination currentPage={page + 1} totalPages={Math.ceil(count / 50)} onPageChange={value => setPage(value - 1)} /></div>
    </>}
  </ProcurementWorkspace>
}
