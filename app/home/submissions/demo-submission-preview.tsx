'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import Link from 'next/link'
import { SubmissionShell } from './submission-shell'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { demoPortalCredentials, demoTenderSite } from '@/lib/demo-data/procurement-portal'
import type { Opportunity } from './types'

/** A read-only preview, deliberately separate from draft, upload and submission hooks. */
export function DemoSubmissionPreview({ opportunity, open = true, onCancel }: {
  opportunity: Opportunity; open?: boolean; onCancel: () => void
}) {
  const { t, formatNumber, formatMoney } = useProcurementI18n()
  const evidenceRevision = demoPortalCredentials[0].revisions[0]
  return <SubmissionShell open={open} onClose={onCancel} title={t('procurement.surfaces.demo.previewProposal')} description={opportunity.title}>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
      <ProcurementDemoNotice />
      <div className="space-y-2"><Label htmlFor="demo-proposal-supplier">{t('procurement.portal.activity.representing')}</Label><Input id="demo-proposal-supplier" value={opportunity.supplier_name} readOnly /></div>
      <div className="space-y-2"><Label htmlFor="demo-proposal-reference">{t('procurement.surfaces.demo.quoteReference')}</Label><Input id="demo-proposal-reference" value="NS-2026-1042" readOnly /></div>
      <DocumentTable rows={opportunity.requirements} empty={t('procurement.surfaces.demo.emptyRequirements')} columns={[
        { label: t('procurement.workflow.tender.requirement'), render: row => row.description },
        { label: t('procurement.workflow.common.quantity'), render: row => `${formatNumber(row.quantity)} ${row.unit}` },
        { label: t('procurement.surfaces.demo.unitNet', { currency: 'USD' }), render: row => formatMoney(row.id === 'demo-line-onboarding' ? 12000 : 360000, 'USD') },
      ]} />
      <p className="font-semibold">{t('procurement.surfaces.demo.totals', { net: formatMoney(600000, 'USD'), rate: formatNumber(8), tax: formatMoney(48000, 'USD'), total: formatMoney(648000, 'USD'), currency: 'USD' })}</p>
      <p>{t('procurement.surfaces.demo.proposalEvidence', { title: evidenceRevision.metadata.title, holder: evidenceRevision.metadata.holder_name, revision: formatNumber(evidenceRevision.revision) })}</p>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/home/profile">{t('procurement.surfaces.demo.viewCredentials')}</Link></Button>
        <Button asChild variant="outline"><Link href={`/tenders/${demoTenderSite.slug}/${opportunity.tender_id}`}>{t('procurement.surfaces.demo.viewTender')}</Link></Button></div>
      <div className="flex gap-3"><Button disabled>{t('procurement.workflow.request.saveDraft')}</Button><Button disabled>{t('procurement.surfaces.demo.submitQuote')}</Button></div>
      <Button variant="outline" onClick={onCancel}>{t('procurement.surfaces.demo.closePreview')}</Button>
    </div>
  </SubmissionShell>
}