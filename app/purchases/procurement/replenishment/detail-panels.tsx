'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Pagination } from '@/app/components/ui/pagination'
import { Table, TableHeader, TableRow, TableBody, TableCell } from '@/app/components/ui/table'
import { DocumentListHead, DocumentListRow, EntityCell, MoneyCell, StatusDot, documentListShellClassName } from '@/app/components/documents/document-list'
import { ProcurementListSkeleton } from '../ui/list-loading'
import { Skeleton } from '@/app/components/ui/skeleton'
import { ProcurementState } from '../ui/workspace'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import type { RuleDetailData, ReplenishmentCase } from './detail-data'
import { RuleInlineField, type EditableRuleField, type SaveRuleField } from './inline-field'


export function RuleDetailSkeleton() {
  const { t } = useProcurementI18n()
  return <div role="status" aria-label={t('procurement.common.loadingContent')} aria-busy="true" className="flex-1 space-y-5 p-4 lg:p-8">
    <Skeleton className="h-10 w-64" /><Skeleton className="h-16 w-full" />
    <div className="flex flex-col gap-8 lg:flex-row"><div className="min-w-0 flex-1">
      <ProcurementListSkeleton columns={4} minWidth="min-w-[720px]" />
    </div><Skeleton className="h-80 w-full lg:w-[340px]" /></div>
  </div>
}

export function RuleAboutPanel({ data, disabled, onSave }: { data: RuleDetailData; disabled: boolean; onSave: SaveRuleField }) {
  const { t, formatNumber, valueLabel, message, formatDate } = useProcurementI18n()
  const { rule, queue } = data
  const fields: [string, string, EditableRuleField?][] = [
    ['stockSku', rule.catalog_item_name || rule.catalog_item_id],
    ['stockLocation', rule.location_name || rule.location_id],
    ['minimumStock', formatNumber(rule.minimum), 'minimum'], ['targetStock', formatNumber(rule.target), 'target'],
    ['minimumPurchase', formatNumber(rule.minimum_order), 'minimum_order'], ['purchaseMultiple', formatNumber(rule.order_multiple), 'order_multiple'],
    ['action', t(`procurement.workflow.replenishment.${rule.action === 'draft' ? 'createDraft' : 'recordAlert'}`), 'action'],
    ['enabled', t(`procurement.workflow.replenishment.${rule.enabled ? 'enabled' : 'disabled'}`), 'enabled'],
  ]
  return <section className="space-y-5" aria-label={t('procurement.workflow.common.about')}>
    <h2 className="text-sm font-semibold">{t('procurement.workflow.common.about')}</h2>
    <dl className="space-y-4">{fields.map(([key, value, field]) => <div key={key} className="space-y-1">
      <dt className="text-xs text-muted-foreground">{t(`procurement.workflow.replenishment.${key}`)}</dt>
      <dd className="break-words text-sm">{field ? <RuleInlineField rule={rule} field={field} label={t(`procurement.workflow.replenishment.${key}`)}
        display={value} disabled={disabled} onSave={onSave} /> : value}</dd>
    </div>)}</dl>
    <div className="space-y-2 border-t border-border/50 pt-4">
      <h3 className="text-sm font-medium">{t(`procurement.workflow.replenishment.latestCheck`)}</h3>
      <p className="text-sm text-muted-foreground">{queue ? t(`procurement.workflow.replenishment.worker`, {
        status: queue.generation > queue.evaluated_generation ? valueLabel('pending') : queue.last_error ? message(queue.last_error)
          : queue.last_result?.message ? message(queue.last_result.message) : queue.last_result?.status ? valueLabel(queue.last_result.status) : t(`procurement.workflow.replenishment.notProcessed`),
      }) : t(`procurement.workflow.replenishment.notProcessed`)}</p>
      {queue?.evaluated_at && <p className="text-xs text-muted-foreground">{formatDate(queue.evaluated_at)}</p>}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{t(`procurement.workflow.replenishment.workerDescription`)}</p>
  </section>
}

export function RuleCasesPanel({ data, busy, page, onPageChange, onResolve }: {
  data: RuleDetailData; busy: boolean; page: number; onPageChange: (page: number) => void; onResolve: (item: ReplenishmentCase) => void
}) {
  const { t, formatNumber, valueLabel, formatDate } = useProcurementI18n()
  return <section className="space-y-4">
    <p className="text-sm text-muted-foreground">{t(`procurement.workflow.replenishment.caseDescription`)}</p>
    <ProcurementState empty={!data.cases.length} emptyTitle={t(`procurement.workflow.replenishment.noRuleCases`)} description="" compact />
    <div className={documentListShellClassName()}>
    {!!data.cases.length && <Table className="min-w-[800px]" aria-label={t('procurement.workflow.replenishment.casesTab')}>
      <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur"><TableRow className="hover:bg-transparent">
        <DocumentListHead className="w-[40%]">{t('procurement.workflow.common.details')}</DocumentListHead>
        <DocumentListHead className="w-[15%]">{t('procurement.workflow.common.status')}</DocumentListHead>
        <DocumentListHead className="w-[25%]">{t('procurement.workflow.request.requisition')}</DocumentListHead>
        <DocumentListHead className="w-[20%]" align="right">{t('procurement.workflow.replenishment.actions')}</DocumentListHead>
      </TableRow></TableHeader><TableBody>{data.cases.map(item => <DocumentListRow key={item.id} className="cursor-default">
        <TableCell className="py-3.5">
          <EntityCell name={valueLabel(item.action)} secondary={t('procurement.workflow.replenishment.observedQuantity', { stock: formatNumber(item.observed_quantity), quantity: formatNumber(item.quantity) })}
            secondaryMono={false} secondaryLines={2} meta={t('procurement.workflow.common.version', { number: item.rule_version })} />
          {item.created_at && <time className="mt-2 block text-xs text-muted-foreground" dateTime={item.created_at}>{formatDate(item.created_at)}</time>}
          {item.close_reason && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{t('procurement.workflow.replenishment.reason')}: {item.close_reason}</p>}
        </TableCell>
        <TableCell className="py-3.5"><StatusDot status={item.status === 'open' ? 'pending' : 'closed'} label={valueLabel(item.status)} />
          {item.closed_at && <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.closed_at)}</p>}</TableCell>
        <TableCell className="py-3.5">{item.request_id
          ? <Link className="text-sm hover:underline focus-visible:underline" href={`/purchases/requests/${item.request_id}`}>{t('procurement.workflow.replenishment.openRequest')}</Link>
          : <span className="text-xs text-muted-foreground">{t('procurement.workflow.replenishment.alertOnly')}</span>}</TableCell>
        <TableCell className="py-3.5 text-right">{item.status === 'open' && <Button variant="ghost" size="sm" disabled={busy} onClick={() => onResolve(item)}>{t('procurement.workflow.replenishment.resolveCase')}</Button>}</TableCell>
      </DocumentListRow>)}</TableBody>
    </Table>}
    <nav aria-label={t(`procurement.workflow.replenishment.casePages`)} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
      <span className="text-xs text-muted-foreground">{t(`procurement.workflow.replenishment.allCaseCount`, { count: formatNumber(data.case_count) })}</span>
      <Pagination currentPage={page} totalPages={Math.ceil(data.case_count / data.page_size)} disabled={busy} onPageChange={onPageChange} />
    </nav>
    </div>
  </section>
}

export function RuleRequestsPanel({ data, busy, page, onPageChange }: {
  data: RuleDetailData; busy: boolean; page: number; onPageChange: (page: number) => void
}) {
  const { t, formatNumber, formatMoney, valueLabel } = useProcurementI18n()
  return <section className="space-y-4">
    <p className="text-sm text-muted-foreground">{t(`procurement.workflow.replenishment.requestsDescription`)}</p>
    <ProcurementState empty={!data.requests.length} emptyTitle={t(`procurement.workflow.replenishment.noRuleRequests`)} description="" compact />
    <div className={documentListShellClassName()}>
    {!!data.requests.length && <Table className="min-w-[560px]" aria-label={t('procurement.workflow.replenishment.requestsTab')}><TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur"><TableRow className="hover:bg-transparent">
      <DocumentListHead className="w-[50%]">{t('procurement.workflow.request.requisition')}</DocumentListHead>
      <DocumentListHead className="w-[25%]">{t('procurement.workflow.common.status')}</DocumentListHead>
      <DocumentListHead className="w-[25%]" align="right">{t('procurement.workflow.common.netAmount')}</DocumentListHead>
    </TableRow></TableHeader><TableBody>{data.requests.map(request => <DocumentListRow key={request.id} className="cursor-default">
      <TableCell className="py-3.5"><Link className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={request.title} title={request.title} href={`/purchases/requests/${request.id}`}>
        <EntityCell name={request.title} secondary={t('procurement.workflow.common.revision', { number: request.revision })} secondaryMono={false} /></Link></TableCell>
      <TableCell className="py-3.5"><StatusDot status={request.status === 'approved' ? 'active' : request.status} label={valueLabel(request.status)} /></TableCell>
      <TableCell className="py-3.5"><MoneyCell amountLabel={request.net_amount_minor === null ? '—' : formatMoney(request.net_amount_minor, request.currency)} /></TableCell>
    </DocumentListRow>)}</TableBody></Table>}
    <nav aria-label={t(`procurement.workflow.replenishment.requestPages`)} className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
      <span className="text-xs text-muted-foreground">{t(`procurement.workflow.replenishment.requestCount`, { count: formatNumber(data.request_count) })}</span>
      <Pagination currentPage={page} totalPages={Math.ceil(data.request_count / data.page_size)} disabled={busy} onPageChange={onPageChange} />
    </nav>
    </div>
  </section>
}