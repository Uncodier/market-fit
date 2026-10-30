'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import useSWR from 'swr'
import { Button } from '@/app/components/ui/button'
import { DocumentTable } from '../commerce/document-ui'
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from '@/app/components/ui/section-card'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import type { CredentialRevision } from './schema'
import { SharedProposal } from './shared-proposal'
import { isProcurementDemo as isDemoSiteId } from '../ui/is-demo'
import { DemoQuotationEvidence } from './demo-quotation-evidence'

type Shared = { id: string; requirement_id: string; revision_id: string; revision: CredentialRevision }
export function SharedEvidence({ siteId, quotationId }: { siteId: string; quotationId: string }) {
  if (isDemoSiteId(siteId)) return <DemoQuotationEvidence quotationId={quotationId} />
  return <LiveSharedEvidence siteId={siteId} quotationId={quotationId} />
}

function LiveSharedEvidence({ siteId, quotationId }: { siteId: string; quotationId: string }) {
  const { t, message, formatNumber } = useProcurementI18n()
  const { user } = useAuthContext()
  const { data, error, isLoading } = useSWR(user ? ['shared-evidence', user.id, siteId, quotationId] : null, async () => {
    const response = await fetch(`/api/procurement/credentials/shared?site_id=${siteId}&quotation_id=${quotationId}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to load evidence')
    return result as { evidence: Shared[] }
  })
  return <SectionCard><SectionCardHeader><SectionCardTitle>{t('procurement.portal.evidence.title')}</SectionCardTitle></SectionCardHeader><SectionCardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">{t('procurement.portal.evidence.description')}</p>
    <SharedProposal siteId={siteId} quotationId={quotationId} />
    {error && <p role="alert">{message(error.message)}</p>}
    {!error && <DocumentTable loading={isLoading} rows={data?.evidence ?? []} empty={t('procurement.portal.evidence.empty')} compact columns={[
      { label: t('procurement.portal.evidence.credentialRevision'), render: item => <>{item.revision.metadata.title}<p>{t('procurement.portal.revision', { revision: formatNumber(item.revision.revision) })}</p></> },
      { label: t('procurement.portal.evidence.holderIssuer'), render: item => <>{item.revision.metadata.holder_name}<p>{item.revision.metadata.issuer}</p></> },
      { label: t('procurement.portal.evidence.requirement'), render: item => item.requirement_id },
      { label: t('procurement.portal.access'), render: item => <Button variant="link" asChild><a href={`/api/procurement/credentials/revisions/${item.revision_id}/file`}>{t('procurement.portal.evidence.download')}</a></Button> },
    ]} />}
  </SectionCardContent></SectionCard>
}