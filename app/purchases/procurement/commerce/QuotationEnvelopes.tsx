'use client'

import Link from 'next/link'
import { Mail, Lock, Calendar } from '@/app/components/ui/icons'
import { Badge } from '@/app/components/ui/badge'
import { documentListShellClassName } from '@/app/components/documents/document-list'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

export interface QuotationEnvelope {
  tender_id: string
  publication_id: string
  tender_title: string
  opening_at: string
  received_count: number
}

export function QuotationEnvelopes({ envelopes }: { envelopes: QuotationEnvelope[] }) {
  const { t, formatNumber, formatDate } = useProcurementI18n()
  if (!envelopes.length) return null
  return <section aria-label={t('procurement.partners.quotes.sealed')} className={documentListShellClassName()}>
    <ul className="divide-y divide-border/60">
      {envelopes.map(envelope => <li key={envelope.publication_id} className="flex min-w-0 flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/60 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"><Mail size={21} /></span>
          <div className="min-w-0 space-y-1">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <span className="inline-flex min-w-6 justify-center rounded-md bg-muted px-1.5 py-0.5 font-semibold tabular-nums" aria-hidden="true">{formatNumber(envelope.received_count)}</span>
              <span className="sr-only">{t('procurement.partners.quotes.sealedCount', { count: formatNumber(envelope.received_count) })}</span>
              <span aria-hidden="true">{t('procurement.partners.quotes.sealed')}</span>
              <Badge variant="outline" className="gap-1 border-amber-200/70 bg-amber-50/60 font-normal text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"><Lock size={12} aria-hidden={true} />{t('procurement.partners.quotes.sealedStatus')}</Badge>
            </h3>
            <Link className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`/purchases/tenders/${envelope.tender_id}`}>{envelope.tender_title}</Link>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pl-14 text-xs text-muted-foreground sm:pl-0 sm:text-right">
          <Calendar size={15} aria-hidden={true} />
          <time dateTime={envelope.opening_at}>{t('procurement.workflow.tender.opensAt', { date: formatDate(envelope.opening_at) })}</time>
        </div>
      </li>)}
    </ul>
    <p className="flex items-start gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5"><Lock size={14} aria-hidden={true} className="mt-0.5 shrink-0" />{t('procurement.partners.quotes.sealedHint')}</p>
  </section>
}