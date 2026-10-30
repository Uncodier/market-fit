'use client'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ProcurementListLoading, ProcurementListSkeleton } from '@/app/purchases/procurement/ui/list-loading'
import { useSite } from '@/app/context/SiteContext'
import { ProcurementWorkspace, ProcurementToolbar, ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/app/components/ui/table'
import { DocumentListHead, DocumentListRow, EntityCell, StatusDot, documentListShellClassName } from '@/app/components/documents/document-list'
import { Pagination } from '@/app/components/ui/pagination'
import { ViewSelector, type ViewType } from '@/app/components/view-selector'
import { Button } from '@/app/components/ui/button'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'
import { FilterSection } from '@/app/components/ui/mobile-filters-drawer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { Badge } from '@/app/components/ui/badge'
import { isRealSiteId, isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoRequestSummaries } from '@/lib/demo-data/procurement-workflow'
import type { RequestSummary } from './schema'

export function RequestList({ approvals = false, toolbarStart }: { approvals?: boolean; toolbarStart?: ReactNode }) {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <ProcurementListLoading columns={6} minWidth="min-w-[900px]" />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.workflow.request.selectWorkspace')}</p>
  return <WorkspaceList key={currentSite.id} siteId={currentSite.id} approvals={approvals} toolbarStart={toolbarStart} />
}
function WorkspaceList({ siteId, approvals, toolbarStart }: { siteId: string; approvals: boolean; toolbarStart?: ReactNode }) {
  const { t, message, valueLabel, formatNumber, formatMoney, formatDate } = useProcurementI18n()
  const demo = isDemoSiteId(siteId) || isDemoModeActive()
  const [rows, setRows] = useState<RequestSummary[]>(() => demo ? demoRequestSummaries : [])
  const [serverCount, setCount] = useState(0)
  const [canManage, setCanManage] = useState(demo)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState(approvals ? 'submitted' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!demo)
  const [reload, setReload] = useState(0)
  const [view, setView] = useState<ViewType>('table')
  const [search, setSearch] = useState('')
  const [sourcing, setSourcing] = useState('all')
  useEffect(() => {
    if (demo || isDemoModeActive()) return
    const controller = new AbortController()
    const timer = setTimeout(() => { setLoading(true); setError('') }, 0)
    fetch(`/api/procurement/requests?site_id=${siteId}&page=${page}&sourcing=${sourcing}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ''}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { clearTimeout(timer); if (!controller.signal.aborted) { setRows(result.requests); setCount(result.count); setCanManage(result.can_manage === true); setError('') } })
      .catch(reason => { clearTimeout(timer); if (!controller.signal.aborted) setError(reason.message || 'Unable to load requests') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { clearTimeout(timer); controller.abort() }
  }, [demo, siteId, page, status, sourcing, search, reload])
  const filteredRows = demo ? rows.filter(row => (!status || row.status === status) && row.title.toLowerCase().includes(search.toLowerCase()) && (sourcing === 'all' || (sourcing === 'with_tender' ? !!row.tenders?.length : !row.tenders?.length))) : rows
  const visibleRows = demo ? filteredRows.slice(page * 50, (page + 1) * 50) : filteredRows
  const count = demo ? filteredRows.length : serverCount
  const stages = ['draft', 'submitted', 'approved', 'rejected', 'returned']
  return <ProcurementWorkspace title={approvals ? t('procurement.workflow.request.approvals') : t('procurement.workflow.request.requests')} toolbar={<ProcurementToolbar search={search} onSearch={value => { setSearch(value); setPage(0) }} placeholder={t('procurement.workflow.request.search')} status={status || 'all'} onStatus={value => { setStatus(value === 'all' ? '' : value); setPage(0) }}
    statuses={[{ value: 'all', label: t('procurement.workflow.request.all') }, ...stages.map(value => ({ value, label: valueLabel(value) }))]}
    actions={<Button variant="ghost" size="sm" asChild><Link href={approvals ? '/purchases/requests' : '/purchases/procurement/approvals'}>{approvals ? t('procurement.workflow.request.all') : t('procurement.workflow.request.approvalQueue')}</Link></Button>}
    viewSelector={<ViewSelector currentView={view} onViewChange={setView} labels={{ table: t('procurement.common.tableView'), kanban: t('procurement.common.kanbanView') }} />}>
    {toolbarStart}
    {canManage && <FilterSection title={t('procurement.workflow.request.sourcing')}><Select value={sourcing} onValueChange={value => { setSourcing(value); setPage(0) }}>
      <SelectTrigger aria-label={t('procurement.workflow.request.sourcingFilter')} className="h-8 w-full rounded-full md:w-48"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">{t('procurement.workflow.request.allRequisitions')}</SelectItem><SelectItem value="with_tender">{t('procurement.workflow.request.withTender')}</SelectItem><SelectItem value="without_tender">{t('procurement.workflow.request.withoutTender')}</SelectItem></SelectContent>
    </Select></FilterSection>}
  </ProcurementToolbar>}>
    {demo && <ProcurementDemoNotice />}
    <TopBarPrimaryActions>{!approvals && canManage && <Button size="sm" asChild><Link href="/purchases/requests/new">{t('procurement.workflow.request.create')}</Link></Button>}</TopBarPrimaryActions>
    <p className="text-sm text-muted-foreground">{t('procurement.workflow.request.listDescription')}</p>
    {loading && <ProcurementListSkeleton columns={6} board={view === 'kanban'} stages={5} minWidth="min-w-[900px]" />}
      <ProcurementState error={message(error)} empty={!loading && !error && !visibleRows.length} emptyTitle={t('procurement.workflow.request.empty')} description={t('procurement.workflow.request.emptyDescription')} onRetry={() => setReload(value => value + 1)} />
    {!loading && !error && <>
      {view === 'table' && !!visibleRows.length && <div className={documentListShellClassName()}><Table className="min-w-[900px]"><TableHeader><TableRow>
        <DocumentListHead>{t('procurement.workflow.request.requisition')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.request.approvalStatus')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.request.sourcing')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.request.linkedTenders')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.common.netAmount')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.common.updated')}</DocumentListHead>
      </TableRow></TableHeader><TableBody>{visibleRows.map(row => <DocumentListRow key={row.id}>
        <TableCell className="px-4 py-3"><Link aria-label={row.title} href={`/purchases/requests/${row.id}`}><EntityCell name={row.title} secondary={t('procurement.workflow.common.revision', { number: formatNumber(row.revision) })} secondaryMono={false} /></Link></TableCell>
        <TableCell className="px-4 py-3"><StatusDot status={row.status === 'approved' ? 'active' : row.status} label={valueLabel(row.status)} /></TableCell>
        <TableCell className="px-4 py-3"><Badge variant="outline">{!canManage || !row.tenders ? t('procurement.workflow.request.notAvailable') : row.tenders.length ? t('procurement.workflow.request.tenderLinked') : t('procurement.workflow.request.noTenderLinked')}</Badge></TableCell>
        <TableCell className="px-4 py-3">{canManage && row.tenders ? row.tenders.length ? <ul className="space-y-2">{row.tenders.map(tender => <li key={tender.id}><Link className="text-sm hover:underline" href={`/purchases/tenders/${tender.id}`}>{tender.title}</Link><span className="block text-xs text-muted-foreground">{valueLabel(tender.status)}</span></li>)}</ul> : <span className="text-xs text-muted-foreground">{t('procurement.workflow.request.noTenderLinked')}</span> : <span className="text-xs text-muted-foreground">{t('procurement.workflow.request.managementRequired')}</span>}</TableCell>
        <TableCell className="px-4 py-3 text-sm">{formatMoney(row.net_amount_minor, row.currency)}</TableCell><TableCell className="px-4 py-3 text-xs text-muted-foreground">{formatDate(row.updated_at, { dateStyle: 'medium' })}</TableCell>
      </DocumentListRow>)}</TableBody></Table></div>}
      {view === 'kanban' && <><p className="text-xs text-muted-foreground">{t('procurement.workflow.request.boardDescription')}</p><div className="flex gap-4 overflow-x-auto">{stages.map(stage => <section key={stage} className="min-w-64 flex-1 rounded-xl bg-muted/60 p-3"><h2 className="mb-3 flex justify-between text-sm font-medium">{valueLabel(stage)}<span>{formatNumber(visibleRows.filter(row => row.status === stage).length)}</span></h2><div className="space-y-3">{visibleRows.filter(row => row.status === stage).map(row => <Link key={row.id} href={`/purchases/requests/${row.id}`} className="block rounded-lg border bg-card p-4 shadow-sm"><EntityCell name={row.title} /><p className="mt-3 text-sm text-muted-foreground">{formatMoney(row.net_amount_minor, row.currency)}</p></Link>)}</div></section>)}</div></>}
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{t('procurement.workflow.request.pagination', { count: formatNumber(count), page: formatNumber(page + 1) })}</p><Pagination currentPage={page + 1} totalPages={Math.ceil(count / 50)} onPageChange={value => setPage(value - 1)} /></div>
    </>}
  </ProcurementWorkspace>
}
