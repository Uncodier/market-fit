'use client'

import useSWR from 'swr'
import { Button } from '@/app/components/ui/button'
import { DocumentTable } from '../commerce/document-ui'
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent } from '@/app/components/ui/section-card'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import type { CredentialRevision } from './schema'

type Shared = { id: string; requirement_id: string; revision_id: string; revision: CredentialRevision }
export function SharedEvidence({ siteId, quotationId }: { siteId: string; quotationId: string }) {
  const { user } = useAuthContext()
  const { data, error, isLoading } = useSWR(user ? ['shared-evidence', user.id, siteId, quotationId] : null, async () => {
    const response = await fetch(`/api/procurement/credentials/shared?site_id=${siteId}&quotation_id=${quotationId}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to load evidence')
    return result as { evidence: Shared[] }
  })
  return <SectionCard><SectionCardHeader><SectionCardTitle>Explicitly shared evidence</SectionCardTitle></SectionCardHeader><SectionCardContent className="space-y-3">
    <p className="text-sm text-muted-foreground">Only selected revisions are disclosed, after the publication opening gate. These documents are not verified or accepted certifications.</p>
    {error && <p role="alert">{error.message}</p>}
    <DocumentTable loading={isLoading} rows={error ? [] : data?.evidence ?? []} empty="No evidence is available to you for this quotation. Evidence may be sealed or was not shared." columns={[
      { label: 'Credential / revision', render: item => <>{item.revision.metadata.title}<p>Revision {item.revision.revision}</p></> },
      { label: 'Holder / issuer', render: item => <>{item.revision.metadata.holder_name}<p>{item.revision.metadata.issuer}</p></> },
      { label: 'Requirement', render: item => item.requirement_id },
      { label: 'Access', render: item => <Button variant="link" asChild><a href={`/api/procurement/credentials/revisions/${item.revision_id}/file`}>Download shared evidence</a></Button> },
    ]} />
  </SectionCardContent></SectionCard>
}