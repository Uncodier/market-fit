'use client'

import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import type { CredentialRevision } from './schema'

export function SharedProposal({ siteId, quotationId }: { siteId: string; quotationId: string }) {
  const { user } = useAuthContext()
  const { t, message } = useProcurementI18n()
  const { data, error } = useSWR(user ? ['shared-proposal', user.id, siteId, quotationId] : null, async () => {
    const response = await fetch(`/api/procurement/credentials/proposals?site_id=${encodeURIComponent(siteId)}&quotation_id=${encodeURIComponent(quotationId)}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Unable to load proposal attachment')
    return body as { proposal: { revision_id: string; revision: CredentialRevision } | null }
  })
  return <section className="space-y-2">
    <h3 className="font-medium">{t('procurement.portal.submission.proposal')}</h3>
    {error ? <p role="alert">{message(error.message)}</p> : data?.proposal ? <Button variant="link" asChild>
      <a href={`/api/procurement/credentials/revisions/${data.proposal.revision_id}/file`}>{data.proposal.revision.original_name}</a>
    </Button> : data && <p className="text-sm text-muted-foreground">{t('procurement.portal.submission.proposalUnavailable')}</p>}
  </section>
}