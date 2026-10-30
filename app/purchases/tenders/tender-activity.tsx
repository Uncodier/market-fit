'use client'

import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { ClipboardList } from '@/app/components/ui/icons'
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from '@/app/components/ui/section-card'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import type { Tender, TenderPublication } from './schema'
import type { TenderReceiptActivity } from './receipt-activity'
import { TenderTimeline } from './tender-timeline'

export function TenderActivity({ tender, publications, receipts = [], portalEnabled, siteSlug, busy, demo = false, onTogglePortal }: {
  tender: Tender
  publications: TenderPublication[]
  receipts?: TenderReceiptActivity[]
  portalEnabled: boolean
  siteSlug: string
  demo?: boolean
  busy: boolean
  onTogglePortal: () => void
}) {
  const { t, valueLabel } = useProcurementI18n()
  return <div className="space-y-5">
    <SectionCard>
      <SectionCardHeader title={t('procurement.workflow.common.activity')}
        description={t('procurement.partners.quotes.activityHint')} />
      <SectionCardContent>
        {!publications.length && !receipts.length ? <EmptyCard title={t('procurement.workflow.tender.notPublished')} icon={<ClipboardList size={24} />}
          description="" showShadow={false} showHint={false} contentClassName="min-h-0 py-6" /> :
          <TenderTimeline publications={publications} receipts={receipts} />}
      </SectionCardContent>
      {!!publications.length && <SectionCardFooter><Button variant="outline" size="sm" asChild><Link href={`/tenders/${siteSlug}/${tender.portal_slug}`}>{t('procurement.workflow.tender.latestPublication')}</Link></Button></SectionCardFooter>}
    </SectionCard>
    <SectionCard>
      <SectionCardHeader title={t('procurement.workflow.tender.workspacePortal')}
        description={t('procurement.workflow.tender.portalDescription', { status: valueLabel(portalEnabled ? 'enabled' : 'disabled') })} />
      {demo && <SectionCardContent><p className="text-sm text-muted-foreground">Explore the local demo portal. Publishing and portal settings remain disabled.</p></SectionCardContent>}
      <SectionCardFooter className="flex-wrap">
        <Button variant="ghost" size="sm" asChild><Link href={`/tenders/${siteSlug}`}>{t('procurement.workflow.tender.workspacePortal')}</Link></Button>
        <Button variant="outline" size="sm" disabled={busy || demo} onClick={onTogglePortal}>{t(portalEnabled ? 'procurement.workflow.tender.disablePortal' : 'procurement.workflow.tender.enablePortal')}</Button>
      </SectionCardFooter>
    </SectionCard>
  </div>
}