'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { Tender } from './schema'

/** Tender lifecycle is server-controlled, not an editable or disabled control. */
export function TenderStatusSegments({ status }: { status: Tender['status'] }) {
  const { t, valueLabel } = useProcurementI18n()
  const styles = {
    draft: 'bg-muted text-foreground',
    published: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
    closed: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
    cancelled: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  }
  return <ol aria-label={t('procurement.workflow.tender.statusDescription')} className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-muted/30 p-1 text-xs">
    {(['draft', 'published', 'closed', 'cancelled'] as const).map(value => <li key={value} aria-current={status === value ? 'step' : undefined}
      className={cn('whitespace-nowrap rounded-full px-3 py-1.5', status === value ? cn('font-semibold', styles[value]) : 'text-foreground')}>
      {valueLabel(value)}
    </li>)}
  </ol>
}

export function TenderProperties({ tender }: { tender: Tender }) {
  const { t, valueLabel, formatDate, formatMoney } = useProcurementI18n()
  const properties = [
    [t('procurement.workflow.tender.visibility'), valueLabel(tender.visibility)],
    [t('procurement.workflow.tender.globalDirectory'), valueLabel(tender.global_visible ? 'enabled' : 'disabled')],
    [t('procurement.workflow.tender.participation'), valueLabel(tender.participation)],
    [t('procurement.workflow.tender.openingPolicy'), valueLabel(tender.opening_policy)],
  ]
  return <aside aria-label={t('procurement.workflow.common.details')} className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 border-t lg:border-t-0 lg:border-l border-border/50">
    <div className="space-y-5 lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100dvh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto">
      <h2 className="text-sm font-semibold">{t('procurement.workflow.common.details')}</h2>
      <div><h3 className="text-sm font-medium">{t('procurement.workflow.tender.publicDescription')}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{tender.description}</p></div>
      <p className="text-sm">{t('procurement.workflow.tender.internalEstimate', { amount: formatMoney(tender.net_amount_minor, tender.currency) })}</p>
      <dl className="space-y-4 text-sm">{properties.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right">{value}</dd></div>)}</dl>
      {tender.global_visible && <p className="text-xs text-muted-foreground">{t('procurement.workflow.tender.globalDiscoveryEnabled')}</p>}
      <div className="space-y-2 text-sm"><p>{t('procurement.workflow.tender.closesAt', { date: formatDate(tender.participation_deadline) })}</p><p>{t('procurement.workflow.tender.opensAt', { date: formatDate(tender.opening_at) })}</p></div>
      <p className="text-xs text-muted-foreground">{t('procurement.workflow.tender.statusDescription')}</p>
      <div className="space-y-3 border-t border-border/50 pt-4">
        {tender.request_id && <Link className="text-sm text-primary hover:underline" href={`/purchases/requests/${tender.request_id}`}>{t('procurement.workflow.tender.linkedRequest')}</Link>}
        <p className="text-xs leading-relaxed text-muted-foreground">{t('procurement.workflow.tender.publicationDescription')}</p>
      </div>
    </div>
  </aside>
}
