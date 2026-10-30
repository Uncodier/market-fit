'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ProcurementListLoading } from '@/app/purchases/procurement/ui/list-loading'
import { useSite } from '@/app/context/SiteContext'
import { isRealSiteId } from '@/lib/demo-utils'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { demoApprovalInbox } from '@/lib/demo-data/procurement-commerce'
import { ProcurementDemoNotice } from '../ui/demo-notice'
import { ProcurementWorkspace, ProcurementToolbar, ProcurementState } from '../ui/workspace'
import { Table, TableHeader, TableRow, TableBody, TableCell } from '@/app/components/ui/table'
import { DocumentListHead, DocumentListRow, EntityCell, documentListShellClassName } from '@/app/components/documents/document-list'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/app/components/ui/select'
import { FilterSection } from '@/app/components/ui/mobile-filters-drawer'
import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import { Pagination } from '@/app/components/ui/pagination'
import { Skeleton } from '@/app/components/ui/skeleton'
import { EventApprovalReview } from './event-approval-review'
import { approvalStages, inboxResponseSchema, type InboxRow } from './inbox-schema'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { DeprecatedBadge } from './deprecated-badge'

export default function Page() {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <ProcurementListLoading columns={6} />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.partners.approvals.realWorkspace')}</p>
  return <ApprovalInbox key={currentSite.id} siteId={currentSite.id} />
}

function ApprovalInbox({ siteId }: { siteId: string }) {
  const { t, message, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const [stage, setStage] = useState('all'), [status, setStatus] = useState('pending'), [page, setPage] = useState(0)
  const [liveRows, setRows] = useState<InboxRow[]>([]), [liveCount, setCount] = useState(0)
  const [isLoading, setLoading] = useState(true), [error, setError] = useState(''), [refresh, setRefresh] = useState(0)
  const demo = isDemoSiteId(siteId)
  const rows = demo ? demoApprovalInbox.filter(row => (stage === 'all' || row.stage === stage) && (status === 'all' || row.status === status)) : liveRows
  const count = demo ? rows.length : liveCount
  const loading = !demo && isLoading
  const [selected, setSelected] = useState<InboxRow | null>(null)
  useEffect(() => {
    if (isDemoSiteId(siteId)) return
    const controller = new AbortController()
    fetch(`/api/procurement/approvals/inbox?site_id=${siteId}&stage=${stage}&status=${status}&page=${page}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load approvals. Check your access and required migrations.')
        return inboxResponseSchema.parse(await response.json())
      }).then(data => { if (!controller.signal.aborted) { setRows(data.rows); setCount(data.count); setError('') } })
      .catch(failure => { if (!controller.signal.aborted) { setError(failure.message); setRows([]) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId, stage, status, page, refresh])
  const reload = () => { setLoading(true); setError(''); setRefresh(value => value + 1) }
  const empty = !loading && !error && !rows.length
  return <ProcurementWorkspace title={t('procurement.partners.approvals.inboxTitle')} toolbar={<ProcurementToolbar
    status={status} onStatus={value => { setStatus(value); setPage(0); setLoading(true) }}
    statuses={['all', 'pending', 'approved', 'rejected', 'returned'].map(value => ({ value, label: value === 'all' ? t('procurement.partners.approvals.allStatuses') : valueLabel(value) }))}
    actions={<Button variant="ghost" size="sm" asChild><Link href="/purchases/requests">{t('procurement.partners.approvals.allRequests')}</Link></Button>}>
    <FilterSection title={t('procurement.partners.approvals.stage')}><Select value={stage} onValueChange={value => { setStage(value); setPage(0); setLoading(true) }}>
      <SelectTrigger aria-label={t('procurement.partners.approvals.stageLabel')} className="h-8 w-full rounded-full md:w-52"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">{t('procurement.partners.approvals.allStages')}</SelectItem>{Object.keys(approvalStages).map(value => <SelectItem key={value} value={value}>{t(`procurement.partners.approvals.stages.${value}`)}</SelectItem>)}</SelectContent>
    </Select></FilterSection>
  </ProcurementToolbar>}>
    {isDemoSiteId(siteId) && <ProcurementDemoNotice />}
    <ProcurementState error={message(error)} onRetry={reload} empty={empty}
      emptyTitle={t('procurement.partners.approvals.emptyFilters')} description={t('procurement.partners.approvals.queueEmptyHint')} />
    {!empty && <div className={documentListShellClassName()}>
      {loading && <span role="status" aria-label={t('procurement.common.loadingRecords')} className="sr-only" />}
      <Table className="min-w-[750px]" aria-busy={loading} aria-label={t('procurement.partners.approvals.inboxTitle')}><TableHeader><TableRow>
      {['document', 'stage', 'status', 'revision', 'date', 'actions'].map(key => <DocumentListHead key={key}>{t(`procurement.partners.approvals.columns.${key}`)}</DocumentListHead>)}
    </TableRow></TableHeader><TableBody>
      {loading && Array.from({ length: 6 }, (_, index) => <TableRow key={`loading-${index}`} aria-hidden="true">
        {['document', 'stage', 'status', 'revision', 'date', 'actions'].map(key => <TableCell key={key} className="px-4 py-3">
          <Skeleton className="h-6 w-full motion-reduce:animate-none" />
        </TableCell>)}
      </TableRow>)}
      {!loading && !error && rows.map(row => <DocumentListRow key={row.id}>
        <TableCell><EntityCell name={row.title} secondary={row.target_id.slice(0, 8)} /></TableCell>
        <TableCell><Badge variant="outline">{t(`procurement.partners.approvals.stages.${row.stage}`)}</Badge></TableCell>
        <TableCell><div className="flex items-center gap-2">{valueLabel(row.status)}<DeprecatedBadge deprecated={row.is_deprecated} /></div></TableCell><TableCell>{formatNumber(row.revision)}</TableCell><TableCell>{formatDate(row.date, { dateStyle: 'medium' })}</TableCell>
        <TableCell>{row.stage === 'requisition' ? <Button variant="ghost" size="sm" asChild><Link href={`/purchases/requests/${row.target_id}`}>{t('procurement.partners.approvals.review')}</Link></Button>
          : <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>{t('procurement.partners.approvals.review')}</Button>}</TableCell>
      </DocumentListRow>)}
    </TableBody></Table></div>}
    {!loading && !error && <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{t('procurement.partners.approvals.count', { count: formatNumber(count) })}</p><Pagination currentPage={page + 1} totalPages={Math.ceil(count / 50)} onPageChange={value => { setPage(value - 1); setLoading(true) }} /></div>}
    {selected && <EventApprovalReview key={selected.id} siteId={siteId} row={selected} onClose={() => setSelected(null)} onDecision={reload} />}
  </ProcurementWorkspace>
}
