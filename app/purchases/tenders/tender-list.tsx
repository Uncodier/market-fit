'use client'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { useEffect, useState } from 'react'
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
import { isRealSiteId, isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { getDemoTenders } from '@/lib/demo-data/procurement-workflow'
import type { Tender } from './schema'

export function TenderList() {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <ProcurementListLoading columns={4} />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.workflow.tender.selectWorkspace')}</p>
  return <WorkspaceList key={currentSite.id} siteId={currentSite.id} />
}
function WorkspaceList({ siteId }: { siteId: string }) {
  const { t, message, valueLabel, formatNumber, formatMoney, formatDate } = useProcurementI18n()
  const demo = isDemoSiteId(siteId) || isDemoModeActive()
  const [rows, setRows] = useState<Tender[]>(() => demo ? getDemoTenders(siteId) : []), [serverCount, setCount] = useState(0)
  const [page, setPage] = useState(0), [status, setStatus] = useState(''), [search, setSearch] = useState('')
  const [error, setError] = useState(''), [loading, setLoading] = useState(!demo), [reload, setReload] = useState(0)
  const [view, setView] = useState<ViewType>('table')
  useEffect(() => {
    if (demo || isDemoModeActive()) return
    const controller = new AbortController()
    const timer = setTimeout(() => { setLoading(true); setError('') }, 0)
    fetch(`/api/procurement/tenders?site_id=${siteId}&page=${page}&status=${status}&search=${encodeURIComponent(search)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
      .then(result => { clearTimeout(timer); if (!controller.signal.aborted) { setRows(result.tenders); setCount(result.count); setError('') } })
      .catch(reason => { clearTimeout(timer); if (!controller.signal.aborted) setError(reason.message || 'Unable to load tenders') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { clearTimeout(timer); controller.abort() }
  }, [demo, siteId, page, status, search, reload])
  const filteredRows = rows.filter(row => row.title.toLowerCase().includes(search.toLowerCase()) && (!demo || !status || row.status === status))
  const visibleRows = demo ? filteredRows.slice(page * 50, (page + 1) * 50) : filteredRows
  const count = demo ? filteredRows.length : serverCount
  const stages = ['draft', 'published', 'closed', 'cancelled']
  return <ProcurementWorkspace title={t('procurement.workflow.tender.tenders')} toolbar={<ProcurementToolbar search={search} onSearch={value => { setSearch(value); setPage(0) }} placeholder={t('procurement.workflow.tender.search')} status={status || 'all'} onStatus={value => { setStatus(value === 'all' ? '' : value); setPage(0) }}
    statuses={[{ value: 'all', label: t('procurement.workflow.tender.all') }, ...stages.map(value => ({ value, label: valueLabel(value) }))]}
    actions={<Button variant="ghost" size="sm" asChild><Link href="/tenders">{t('procurement.workflow.tender.directory')}</Link></Button>}
    viewSelector={<ViewSelector currentView={view} onViewChange={setView} labels={{ table: t('procurement.common.tableView'), kanban: t('procurement.common.kanbanView') }} />} />}>
    {demo && <ProcurementDemoNotice />}
    <TopBarPrimaryActions><Button size="sm" asChild><Link href="/purchases/tenders/new">{t('procurement.workflow.tender.create')}</Link></Button></TopBarPrimaryActions>
    {loading && <ProcurementListSkeleton columns={4} board={view === 'kanban'} stages={6} />}
      <ProcurementState error={message(error)} empty={!loading && !error && !visibleRows.length} emptyTitle={t('procurement.workflow.tender.empty')} description={t('procurement.workflow.tender.emptyDescription')} onRetry={() => setReload(value => value + 1)} />
    {!loading && !error && <>
      {view === 'table' && !!visibleRows.length && <div className={documentListShellClassName()}><Table><TableHeader><TableRow>
        <DocumentListHead>{t('procurement.workflow.tender.tender')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.common.status')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.common.netAmount')}</DocumentListHead><DocumentListHead>{t('procurement.workflow.tender.participationCloses')}</DocumentListHead>
      </TableRow></TableHeader><TableBody>{visibleRows.map(row => <DocumentListRow key={row.id}>
        <TableCell className="px-4 py-3"><Link aria-label={row.title} href={`/purchases/tenders/${row.id}`}><EntityCell name={row.title} secondary={t('procurement.workflow.common.version', { number: formatNumber(row.version) })} secondaryMono={false} /></Link></TableCell>
        <TableCell className="px-4 py-3"><StatusDot status={row.status} label={valueLabel(row.status)} /></TableCell>
        <TableCell className="px-4 py-3 text-sm">{formatMoney(row.net_amount_minor, row.currency)}</TableCell><TableCell className="px-4 py-3 text-xs text-muted-foreground">{formatDate(row.participation_deadline)}</TableCell>
      </DocumentListRow>)}</TableBody></Table></div>}
      {view === 'kanban' && <><p className="text-xs text-muted-foreground">{t('procurement.workflow.tender.boardDescription')}</p><div className="flex gap-4 overflow-x-auto">{stages.map(stage => <section key={stage} className="min-w-64 flex-1 rounded-xl bg-muted/60 p-3"><h2 className="mb-3 flex justify-between text-sm font-medium">{valueLabel(stage)}<span>{formatNumber(visibleRows.filter(row => row.status === stage).length)}</span></h2><div className="space-y-3">{visibleRows.filter(row => row.status === stage).map(row => <Link key={row.id} href={`/purchases/tenders/${row.id}`} className="block rounded-lg border bg-card p-4 shadow-sm"><EntityCell name={row.title} /><p className="mt-3 text-sm text-muted-foreground">{formatMoney(row.net_amount_minor, row.currency)}</p></Link>)}</div></section>)}</div></>}
      <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{t('procurement.workflow.tender.pagination', { count: formatNumber(count), page: formatNumber(page + 1) })}</p><Pagination currentPage={page + 1} totalPages={Math.ceil(count / 50)} onPageChange={value => setPage(value - 1)} /></div>
    </>}
  </ProcurementWorkspace>
}
