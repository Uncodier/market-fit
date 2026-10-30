'use client'

import Link from 'next/link'
import { EntityAvatar, StatusDot } from '@/app/components/documents/document-list'
import type { ProcurementQuotationDetail } from '../procurement/commerce/quotation-detail-contracts'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'

export function QuotationAbout({ detail }: { detail: ProcurementQuotationDetail }) {
  const { quotation, supplier } = detail
  const { t, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const contacts = supplier ? [...supplier.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)) : []
  return <div className="space-y-6 text-sm">
    <section className="space-y-3"><h2 className="font-semibold">{t('procurement.quoteDetail.details')}</h2>
      <dl className="space-y-4">
        <div><dt className="text-muted-foreground">{t('procurement.quoteDetail.reference')}</dt><dd className="mt-1 break-words font-medium">{quotation.reference}</dd></div>
        <div><dt className="text-muted-foreground">{t('procurement.partners.quotes.tender')}</dt><dd className="mt-1"><Link className="break-words underline underline-offset-4" href={`/purchases/tenders/${encodeURIComponent(quotation.tender_id)}`}>{quotation.tender_title}</Link></dd></div>
        <div><dt className="text-muted-foreground">{t('procurement.quoteDetail.received')}</dt><dd className="mt-1">{formatDate(quotation.recorded_at)}</dd></div>
        <div><dt className="text-muted-foreground">{t('procurement.quoteDetail.revision')}</dt><dd className="mt-1">{formatNumber(quotation.procurement_revision)}</dd></div>
        <div><dt className="text-muted-foreground">{t('procurement.quoteDetail.source')}</dt><dd className="mt-1">{t(quotation.source === 'supplier_submitted' ? 'procurement.partners.quotes.supplierSubmitted' : 'procurement.partners.quotes.buyerRecorded')}</dd></div>
        <div><dt className="text-muted-foreground">{t('procurement.quoteDetail.currency')}</dt><dd className="mt-1">{quotation.currency}</dd></div>
      </dl>
    </section>
    <section className="space-y-3 border-t border-border/50 pt-5"><h2 className="font-semibold">{t('procurement.partners.suppliers.supplier')}</h2>
      <div className="flex items-center gap-3"><EntityAvatar name={quotation.supplier_name} /><div className="min-w-0 space-y-1">
        {supplier ? <Link className="break-words font-medium hover:underline" href={`/suppliers/${encodeURIComponent(supplier.id)}`}>{supplier.name}</Link> : <p className="break-words font-medium">{quotation.supplier_name}</p>}
        {supplier && <div><StatusDot status={supplier.status === 'approved' ? 'active' : supplier.status === 'under_review' ? 'review' : supplier.status} label={valueLabel(supplier.status)} /></div>}
      </div></div>
      {supplier && <>
        <p className="text-xs text-muted-foreground">{t('procurement.quoteDetail.supplierHint')}</p>
        <section className="space-y-3"><h3 className="font-medium">{t('procurement.partners.contacts.title')}</h3>
          {contacts.length ? <ul className="space-y-4">{contacts.map((contact, index) => <li key={index} className="space-y-1 break-words">
            {contact.is_primary && <p className="text-xs text-muted-foreground">{t('procurement.partners.contacts.primaryContact')}</p>}
            <p className="font-medium">{contact.name}</p>
            {contact.role && <p className="text-muted-foreground">{contact.role}</p>}
            {contact.email && <p className="break-all">{contact.email}</p>}
            {contact.phone && <p>{contact.phone}</p>}
            {!contact.email && !contact.phone && <p className="text-xs text-muted-foreground">{t('procurement.partners.contacts.noDetails')}</p>}
          </li>)}</ul> : <p className="text-xs text-muted-foreground">{t('procurement.partners.contacts.empty')}</p>}
        </section>
        <section className="space-y-2 border-t border-border/50 pt-4"><h3 className="font-medium">{t('procurement.partners.form.terms')}</h3>
          <p className="whitespace-pre-wrap break-words">{supplier.commercial_terms || t('procurement.quoteDetail.noTerms')}</p>
        </section>
      </>}
      {!supplier && <p className="text-xs text-muted-foreground">{t('procurement.quoteDetail.supplierUnavailable')}</p>}
    </section>
  </div>
}