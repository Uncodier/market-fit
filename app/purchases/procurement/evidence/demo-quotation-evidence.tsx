'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card'
import { demoProcurementQuotes } from '@/lib/demo-data/procurement-commerce'

export function DemoQuotationEvidence({ quotationId }: { quotationId: string }) {
  const { t } = useProcurementI18n()
  const [expanded, setExpanded] = useState(false)
  const quote = demoProcurementQuotes.find(item => item.id === quotationId)
  return <SectionCard>
    <SectionCardHeader title={t('procurement.surfaces.demo.evidenceTitle')} description={t('procurement.surfaces.demo.evidenceHint')} />
    <SectionCardContent className="space-y-4">
      <div><p className="font-medium">{t('procurement.surfaces.demo.technicalRevision')}</p><p className="text-sm text-muted-foreground">{quote?.supplier_name ?? 'Demo supplier'} {t('procurement.surfaces.demo.supportScope')}</p></div>
      <div className="flex items-center justify-between gap-3"><span>{t('procurement.surfaces.demo.registrationRevision')}</span><Badge variant="outline">{t('procurement.values.accepted')}</Badge></div>
      <div className="flex items-center justify-between gap-3"><span>{t('procurement.surfaces.demo.securityRevision')}</span><Badge variant="outline">{t('procurement.values.under_review')}</Badge></div>
      <Button variant="outline" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>{t('procurement.surfaces.demo.previewEvidence')}</Button>
      {expanded && <div className="rounded-lg border p-4 text-sm space-y-2">
        <h3 className="font-semibold">{t('procurement.surfaces.demo.evidencePreview')}</h3>
        <p>{t('procurement.surfaces.demo.scope')}</p>
        <p>{t('procurement.surfaces.demo.delivery')}</p>
        <p>{t('procurement.surfaces.demo.notCertificate')}</p>
      </div>}
    </SectionCardContent>
  </SectionCard>
}