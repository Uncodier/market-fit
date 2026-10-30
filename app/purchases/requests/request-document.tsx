'use client'

import Link from 'next/link'
import { Badge } from '@/app/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'
import type { RequestItem, RequestSummary } from './schema'

export function RequestDocumentView({ request, items }: { request: RequestSummary; items: RequestItem[] }) {
  const { t, valueLabel, formatNumber, formatMoney, formatDate } = useProcurementI18n()
  return <article aria-label={t('procurement.workflow.request.request')} className="overflow-hidden rounded-lg border border-border bg-card shadow-lg">
    <header className="flex flex-wrap justify-between gap-4 border-b border-border bg-muted/50 p-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('procurement.workflow.request.request')}</p>
        <h2 className="mt-1 break-words text-2xl font-semibold">{request.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('procurement.workflow.common.revision', { number: formatNumber(request.revision) })}</p>
      </div>
      <div className="space-y-2 text-sm sm:text-right">
        <Badge variant="outline">{valueLabel(request.status)}</Badge>
        {request.updated_at && <p className="text-muted-foreground">{formatDate(request.updated_at)}</p>}
      </div>
    </header>
    <section className="space-y-3 border-b border-border p-6">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{t('procurement.workflow.request.information')}</h3>
      <p className="whitespace-pre-wrap break-words text-sm">{request.description || t('procurement.workflow.request.noDescription')}</p>
      <p className="break-all text-xs text-muted-foreground">{t('procurement.workflow.request.requester', { id: request.requester_id })}</p>
      {request.tenders?.map(tender => <p key={tender.id}><Link className="text-sm underline" href={`/purchases/tenders/${tender.id}`}>{tender.title}</Link></p>)}
    </section>
    <section className="p-4 sm:p-6">
      <h3 className="mb-4 text-sm font-semibold">{t('procurement.workflow.request.requestLines')}</h3>
      <Table aria-label={t('procurement.workflow.request.requestLines')}>
        <TableHeader><TableRow>
          <TableHead>{t('procurement.workflow.common.description')}</TableHead>
          <TableHead className="text-right">{t('procurement.workflow.common.quantity')}</TableHead>
          <TableHead className="whitespace-nowrap text-right">{t('procurement.workflow.request.unitNet')}</TableHead>
          <TableHead>{t('procurement.workflow.request.taxSnapshot')}</TableHead>
        </TableRow></TableHeader>
        <TableBody>{items.map(item => <TableRow key={item.id}>
          <TableCell><p className="text-sm font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{item.valuation_source === 'manager_estimate' ? t('procurement.workflow.request.managerEstimate') : item.valuation_source === 'unpriced' ? t('procurement.workflow.request.unpriced') : t('procurement.workflow.request.catalogCost')}</p></TableCell>
          <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
          <TableCell className="whitespace-nowrap text-right">{item.unit_net_minor === null ? t('procurement.workflow.request.unpriced') : formatMoney(item.unit_net_minor, request.currency)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{item.tax_snapshot === null ? t('procurement.workflow.request.unresolvedTax') : item.tax_snapshot.length ? item.tax_snapshot.map(tax => `${tax.name} ${formatNumber(tax.rate)}%`).join(', ') : t('procurement.workflow.request.noCatalogTaxes')}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
      <dl className="ml-auto mt-6 w-full max-w-xs border-t pt-4">
        <div className="flex justify-between gap-4 text-base font-semibold"><dt>{t('procurement.workflow.common.netAmount')}</dt><dd>{formatMoney(request.net_amount_minor, request.currency)}</dd></div>
      </dl>
    </section>
  </article>
}