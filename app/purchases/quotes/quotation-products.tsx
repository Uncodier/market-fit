'use client'

import { DocumentTable } from '../procurement/commerce/document-ui'
import type { ProcurementQuotation } from '../procurement/commerce/contracts'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'

export function QuotationAmounts({ quotation }: { quotation: ProcurementQuotation }) {
  const { t, formatMoney } = useProcurementI18n()
  const amounts = [
    { label: t('procurement.quoteDetail.netTotal'), amount: quotation.net_amount_minor },
    { label: t('procurement.quoteDetail.tax'), amount: quotation.tax_amount_minor },
    { label: t('procurement.quoteDetail.total'), amount: quotation.tax_amount_minor == null ? null : quotation.net_amount_minor + quotation.tax_amount_minor },
  ]
  return <dl className="grid gap-4 rounded-xl border border-border/60 p-5 sm:grid-cols-3">
    {amounts.map(({ label, amount }) => <div key={label} className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-xl font-semibold tabular-nums">{amount == null ? <span className="text-sm">{t('procurement.common.taxesPending')}</span> : formatMoney(amount, quotation.currency)}</dd>
    </div>)}
  </dl>
}

export function QuotationProducts({ quotation }: { quotation: ProcurementQuotation }) {
  const { t, formatNumber, formatMoney } = useProcurementI18n()
  return <section className="space-y-4" aria-label={t('procurement.quoteDetail.products')}>
    <div><h2 className="text-lg font-semibold">{t('procurement.quoteDetail.products')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('procurement.quoteDetail.productsHint')}</p></div>
    <DocumentTable rows={quotation.lines} empty={t('procurement.partners.quotes.noLines')} compact columns={[
      { label: t('procurement.partners.quotes.item'), render: line => <span className="font-medium">{line.name}</span> },
      { label: t('procurement.partners.quotes.quantity'), render: line => formatNumber(line.quantity) },
      { label: t('procurement.partners.quotes.unitNet'), render: line => formatMoney(line.unit_net_minor, quotation.currency) },
      { label: t('procurement.quoteDetail.netTotal'), render: line => formatMoney(line.net_amount_minor, quotation.currency) },
      { label: t('procurement.quoteDetail.tax'), render: line => line.tax_amount_minor == null ? t('procurement.common.taxesPending') : formatMoney(line.tax_amount_minor, quotation.currency) },
    ]} />
    {quotation.tax_amount_minor == null && <p className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/20">{t('procurement.common.taxesBeforeOrder')}</p>}
  </section>
}