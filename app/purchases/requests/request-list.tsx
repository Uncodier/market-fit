'use client'

import { useEffect, useState, type ReactNode } from 'react'
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
import { FilterSection } from '@/app/components/ui/mobile-filters-drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Badge } from '@/app/components/ui/badge'
import { isRealSiteId } from '@/lib/demo-utils'
import type { RequestSummary } from './schema'

export function RequestList({ approvals = false, toolbarStart }: { approvals?: boolean; toolbarStart?: ReactNode }) {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return <p className="p-6">Select a real workspace to view purchase requests.</p>
  return <WorkspaceList key={currentSite.id} siteId={currentSite.id} approvals={approvals} toolbarStart={toolbarStart} />
}
function WorkspaceList({ siteId, approvals, toolbarStart }: { siteId: string; approvals: boolean; toolbarStart?: ReactNode }) {
  const [rows, setRows] = useState<RequestSummary[]>([])
  const [count, setCount] = useState(0)
  const [canManage, setCanManage] = useState(false)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState(approvals ? 'submitted' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [view, setView] = useState<ViewType>('table')
  const [search, setSearch] = useState('')
  const [sourcing, setSourcing] = useState('all')
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => { setLoading(true); setError('') }, 0)
    fetch(`/api/procurement/requests?site_id=${siteId}&page=${page}&sourcing=${sourcing}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { clearTimeout(timer); if (!controller.signal.aborted) { setRows(result.requests); setCount(result.count); setCanManage(result.can_manage === true); setError('') } })
      .catch(reason => { clearTimeout(timer); if (!controller.signal.aborted) setError(reason.message || 'Unable to load requests') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, page, status, sourcing, search, reload])
  const visibleRows = rows
  const stages = ['draft', 'submitted', 'approved', 'rejected', 'returned']
  return <ProcurementWorkspace title={approvals ? 'Purchase approvals' : 'Purchase requests'} toolbar={<ProcurementToolbar search={search} onSearch={value => { setSearch(value); setPage(0) }} placeholder="Search requests" status={status || 'all'} onStatus={value => { setStatus(value === 'all' ? '' : value); setPage(0) }}
    statuses={[{ value: 'all', label: 'All requests' }, ...stages.map(value => ({ value, label: humanize(value) }))]}
    actions={<Button variant="ghost" size="sm" asChild><Link href={approvals ? '/purchases/requests' : '/purchases/procurement/approvals'}>{approvals ? 'All requests' : 'Approval queue'}</Link></Button>}
    viewSelector={<ViewSelector currentView={view} onViewChange={setView} />}>
    {toolbarStart}
    {canManage && <FilterSection title="Sourcing"><Select value={sourcing} onValueChange={value => { setSourcing(value); setPage(0) }}>
      <SelectTrigger aria-label="Sourcing filter" className="h-8 w-full rounded-full md:w-48"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">All requisitions</SelectItem><SelectItem value="with_tender">With linked tender</SelectItem><SelectItem value="without_tender">Without linked tender</SelectItem></SelectContent>
    </Select></FilterSection>}
  </ProcurementToolbar>}>
    <TopBarPrimaryActions>{!approvals && canManage && <Button size="sm" asChild><Link href="/purchases/requests/new">Create request</Link></Button>}</TopBarPrimaryActions>
    <p className="text-sm text-muted-foreground">Requisitions record internal purchasing needs. Tender links are separate from approval status; a requisition without a tender is not automatically an authorized direct purchase.</p>
    <ProcurementState loading={loading} error={error} empty={!loading && !error && !visibleRows.length} emptyTitle="No requests match this view." description="Adjust your filters or create a new request." onRetry={() => setReload(value => value + 1)} />
    {!loading && !error && <>
      {view === 'table' && !!visibleRows.length && <div className={documentListShellClassName()}><Table className="min-w-[900px]"><TableHeader><TableRow>
        <DocumentListHead>Requisition</DocumentListHead><DocumentListHead>Approval status</DocumentListHead><DocumentListHead>Sourcing</DocumentListHead><DocumentListHead>Linked tenders</DocumentListHead><DocumentListHead>Net amount</DocumentListHead><DocumentListHead>Updated</DocumentListHead>
      </TableRow></TableHeader><TableBody>{visibleRows.map(row => <DocumentListRow key={row.id}>
        <TableCell className="px-4 py-3"><Link aria-label={row.title} href={`/purchases/requests/${row.id}`}><EntityCell name={row.title} secondary={`Revision ${row.revision}`} secondaryMono={false} /></Link></TableCell>
        <TableCell className="px-4 py-3"><StatusDot status={row.status === 'approved' ? 'active' : row.status} label={humanize(row.status)} /></TableCell>
        <TableCell className="px-4 py-3"><Badge variant="outline">{!canManage || !row.tenders ? 'Not available' : row.tenders.length ? 'Tender linked' : 'No tender linked'}</Badge></TableCell>
        <TableCell className="px-4 py-3">{canManage && row.tenders ? row.tenders.length ? <ul className="space-y-2">{row.tenders.map(tender => <li key={tender.id}><Link className="text-sm hover:underline" href={`/purchases/tenders/${tender.id}`}>{tender.title}</Link><span className="block text-xs text-muted-foreground">{humanize(tender.status)}</span></li>)}</ul> : <span className="text-xs text-muted-foreground">No tender linked</span> : <span className="text-xs text-muted-foreground">Requires management access</span>}</TableCell>
        <TableCell className="px-4 py-3 text-sm">{row.currency} {(Number(row.net_amount_minor) / 100).toFixed(2)}</TableCell><TableCell className="px-4 py-3 text-xs text-muted-foreground">{new Date(row.updated_at).toLocaleDateString('en')}</TableCell>
      </DocumentListRow>)}</TableBody></Table></div>}
      {view === 'kanban' && <><p className="text-xs text-muted-foreground">Read-only board for this page. Open a request to perform authorized transitions.</p><div className="flex gap-4 overflow-x-auto">{stages.map(stage => <section key={stage} className="min-w-64 flex-1 rounded-xl bg-muted/60 p-3"><h2 className="mb-3 flex justify-between text-sm font-medium">{humanize(stage)}<span>{visibleRows.filter(row => row.status === stage).length}</span></h2><div className="space-y-3">{visibleRows.filter(row => row.status === stage).map(row => <Link key={row.id} href={`/purchases/requests/${row.id}`} className="block rounded-lg border bg-card p-4 shadow-sm"><EntityCell name={row.title} /><p className="mt-3 text-sm text-muted-foreground">{row.currency} {(Number(row.net_amount_minor) / 100).toFixed(2)}</p></Link>)}</div></section>)}</div></>}
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{count} requisitions · Page {page + 1} · Search and filters apply across accessible requisitions</p><Pagination currentPage={page + 1} totalPages={Math.ceil(count / 50)} onPageChange={value => setPage(value - 1)} /></div>
    </>}
  </ProcurementWorkspace>
}
