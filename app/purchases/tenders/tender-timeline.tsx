'use client'

import { ClipboardList, ChevronRight, Mail, CheckCircle } from '@/app/components/ui/icons'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import type { TenderPublication } from './schema'
import type { TenderReceiptActivity } from './receipt-activity'

export function TenderTimeline({ publications, receipts }: { publications: TenderPublication[]; receipts: TenderReceiptActivity[] }) {
  const { t, formatDate, formatNumber } = useProcurementI18n()
  const events = [
    ...publications.map(publication => ({ kind: 'publication' as const, at: publication.published_at, order: publication.version, publication })),
    ...receipts.map(receipt => ({ kind: 'receipt' as const, at: receipt.received_at, order: receipt.receipt_number, receipt })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.order - a.order)

  return <ol aria-label={t('procurement.workflow.common.activity')} className="space-y-4">
    {events.map(event => <li key={event.kind === 'receipt' ? `receipt-${event.receipt.receipt_number}` : event.publication.id} className="flex min-w-0 gap-3">
      <div className="flex shrink-0 flex-col items-center" aria-hidden="true">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${event.kind === 'receipt' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-border bg-muted/50'}`}>
          {event.kind === 'receipt' ? <Mail size={16} /> : <ClipboardList size={16} />}
        </span>
        <span className="mt-2 w-px flex-1 bg-border" />
      </div>
      {event.kind === 'receipt' ? <div className="min-w-0 flex-1 rounded-lg border border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">{t('procurement.partners.quotes.receivedEvent')}<CheckCircle size={14} aria-hidden={true} className="text-emerald-600 dark:text-emerald-400" /></h3>
          <time dateTime={event.at} className="text-xs text-muted-foreground">{formatDate(event.at)}</time>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('procurement.partners.quotes.receiptNumber', { number: formatNumber(event.receipt.receipt_number) })} · {t('procurement.workflow.common.version', { number: formatNumber(event.receipt.publication_version) })}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('procurement.partners.quotes.receiptEventHint')}</p>
      </div> : <details className="group min-w-0 flex-1 rounded-lg border border-border/70">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1 font-medium">{t('procurement.workflow.common.version', { number: formatNumber(event.publication.version) })}
            <time dateTime={event.at} className="mt-1 block text-xs font-normal text-muted-foreground">{formatDate(event.at)}</time>
          </span>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        </summary>
        <div className="space-y-3 border-t border-border/50 p-4 text-sm">
          <h3 className="break-words font-medium">{event.publication.snapshot.title}</h3>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">{event.publication.snapshot.description}</p>
          <p>{t('procurement.workflow.tender.closesAt', { date: formatDate(event.publication.snapshot.participation_deadline) })}</p>
          <ul className="space-y-2">{event.publication.snapshot.requirements.map(line => <li key={line.id} className="break-words">{line.description} — {formatNumber(line.quantity)} {line.unit}</li>)}</ul>
        </div>
      </details>}
    </li>)}
  </ol>
}