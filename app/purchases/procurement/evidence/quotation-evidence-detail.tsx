'use client'

import { type ReactNode } from 'react'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { SectionCard, SectionCardHeader, SectionCardContent } from '@/app/components/ui/section-card'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { isProcurementDemo } from '../ui/is-demo'
import { quotationEvidenceDemoData } from './quotation-evidence-demo-data'
import type { CredentialRevision } from './schema'

export type QuotationEvidenceDetailProps = { siteId: string; quotationId: string }
type SharedRevision = Pick<CredentialRevision, 'id' | 'revision' | 'metadata' | 'original_name' | 'mime_type' | 'byte_size'>
type Attachment = { revision_id: string; revision: SharedRevision | null }
type Evidence = Attachment & { id: string; requirement_id: string }

const swrOptions = { keepPreviousData: false, shouldRetryOnError: false }

async function loadAttachment<T>(path: string, siteId: string, quotationId: string, fallback: string): Promise<T> {
  const query = new URLSearchParams({ site_id: siteId, quotation_id: quotationId })
  const response = await fetch(`/api/procurement/credentials/${path}?${query}`, {
    cache: 'no-store', credentials: 'same-origin',
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Authentication required')
    if (response.status === 403) throw new Error('procurement.quoteDetail.evidence.accessDenied')
    throw new Error(fallback)
  }
  return response.json()
}

/** Read-only, publication-gated revisions, never the holder's latest private profile. */
export function QuotationEvidenceDetail(props: QuotationEvidenceDetailProps) {
  if (isProcurementDemo(props.siteId)) return <DemoEvidenceDetail key={props.quotationId} quotationId={props.quotationId} />
  return <AuthenticatedEvidence {...props} />
}

function DemoEvidenceDetail({ quotationId }: { quotationId: string }) {
  const { t } = useProcurementI18n()
  const sample = quotationEvidenceDemoData(quotationId)
  return <div className="space-y-6">
    <SectionCard>
      <SectionCardHeader title={t('procurement.portal.submission.proposal')} />
      <SectionCardContent><RevisionDetail attachment={sample.proposal} fictional /></SectionCardContent>
    </SectionCard>
    <SectionCard>
      <SectionCardHeader title={t('procurement.portal.evidence.title')} description={t('procurement.portal.evidence.description')} />
      <SectionCardContent className="space-y-4">{sample.certificates.map(item =>
        <RevisionDetail key={item.revision_id} attachment={item} requirementId={item.requirementReference} fictional />
      )}</SectionCardContent>
    </SectionCard>
  </div>
}

function AuthenticatedEvidence(props: QuotationEvidenceDetailProps) {
  const { user, isLoading } = useAuthContext()
  const { t, message } = useProcurementI18n()
  if (isLoading || !user || !props.siteId || !props.quotationId) {
    return <SectionCard>
      <SectionCardHeader title={t('procurement.portal.evidence.title')} />
      <SectionCardContent>
        {isLoading ? <EvidenceLoading /> : <p role="alert">{!user
          ? message('Authentication required') : t('procurement.quoteDetail.evidence.selectScope')}</p>}
      </SectionCardContent>
    </SectionCard>
  }
  return <LiveEvidence key={JSON.stringify([user.id, props.siteId, props.quotationId])} userId={user.id} {...props} />
}

function LiveEvidence({ userId, siteId, quotationId }: QuotationEvidenceDetailProps & { userId: string }) {
  const { t } = useProcurementI18n()
  const evidence = useSWR(['shared-evidence', userId, siteId, quotationId], async () => {
    const body = await loadAttachment<{ evidence: Evidence[] }>('shared', siteId, quotationId, 'procurement.quoteDetail.evidence.loadFailed')
    if (!Array.isArray(body?.evidence)) throw new Error('procurement.quoteDetail.evidence.loadFailed')
    return body
  }, swrOptions)
  const proposal = useSWR(['shared-proposal', userId, siteId, quotationId], async () => {
    const body = await loadAttachment<{ proposal: Attachment | null }>('proposals', siteId, quotationId, 'procurement.quoteDetail.evidence.proposalLoadFailed')
    if (!body || !Object.hasOwn(body, 'proposal')) throw new Error('procurement.quoteDetail.evidence.proposalLoadFailed')
    return body
  }, swrOptions)

  return <div className="space-y-6">
    <SectionCard>
      <SectionCardHeader title={t('procurement.portal.submission.proposal')} />
      <SectionCardContent>
        {proposal.error ? <EvidenceError error={proposal.error} retry={() => { void proposal.mutate() }} />
          : proposal.data === undefined ? <EvidenceLoading />
            : proposal.data.proposal ? <RevisionDetail attachment={proposal.data.proposal} />
              : <EvidenceEmpty text={t('procurement.portal.submission.proposalUnavailable')} />}
      </SectionCardContent>
    </SectionCard>
    <SectionCard>
      <SectionCardHeader title={t('procurement.portal.evidence.title')} description={t('procurement.portal.evidence.description')} />
      <SectionCardContent>
        {evidence.error ? <EvidenceError error={evidence.error} retry={() => { void evidence.mutate() }} />
          : evidence.data === undefined ? <EvidenceLoading />
            : evidence.data.evidence.length === 0 ? <EvidenceEmpty text={t('procurement.portal.evidence.empty')} />
              : <div className="space-y-4">{evidence.data.evidence.map(item =>
                <RevisionDetail key={item.id} attachment={item} requirementId={item.requirement_id} />
              )}</div>}
      </SectionCardContent>
    </SectionCard>
  </div>
}

function EvidenceLoading() {
  const { t } = useProcurementI18n()
  return <div role="status" className="space-y-3">
    <span className="sr-only">{t('procurement.common.loadingContent')}</span>
    <div aria-hidden="true" className="space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <div className="grid grid-cols-2 gap-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      <Skeleton className="h-20 w-full" />
    </div>
  </div>
}

function EvidenceError({ error, retry }: { error: Error; retry: () => void }) {
  const { t, message } = useProcurementI18n()
  return <div className="space-y-3">
    <p role="alert" className="text-sm text-destructive">{message(t(error.message))}</p>
    <Button type="button" variant="outline" size="sm" onClick={retry}>{t('procurement.common.retry')}</Button>
  </div>
}

function EvidenceEmpty({ text }: { text: string }) {
  return <EmptyCard title={text} description="" showShadow={false} showHint={false} contentClassName="min-h-0 py-6" />
}

function MetadataField({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{children || '—'}</dd>
  </div>
}

function RevisionDetail({ attachment, requirementId, fictional = false }: { attachment: Attachment; requirementId?: string; fictional?: boolean }) {
  const { t, formatDate, formatNumber } = useProcurementI18n()
  const { revision } = attachment
  if (!revision) return <p role="status" className="text-sm text-muted-foreground">{t('procurement.quoteDetail.evidence.revisionUnavailable')}</p>
  const metadata = revision.metadata
  function date(value: string | null) {
    return value ? <time dateTime={value}>{formatDate(value, { dateStyle: 'medium', timeZone: 'UTC' })}</time> : '—'
  }
  return <article aria-label={metadata.title} className="min-w-0 rounded-lg border border-border/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground">{t('procurement.portal.credentials.title')}</p>
        <h4 className="break-words font-semibold">{metadata.title}</h4>
      </div>
      <Badge variant="outline">{t('procurement.portal.revision', { revision: formatNumber(revision.revision) })}</Badge>
    </div>
    <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <MetadataField label={t('procurement.quoteDetail.evidence.holder')}>{metadata.holder_name}</MetadataField>
      <MetadataField label={t('procurement.portal.credentials.issuer')}>{metadata.issuer}</MetadataField>
      <MetadataField label={t('procurement.quoteDetail.evidence.credentialType')}>{metadata.type}</MetadataField>
      <MetadataField label={t('procurement.portal.credentials.reference')}>{metadata.reference}</MetadataField>
      <MetadataField label={t('procurement.portal.credentials.scope')} wide>{metadata.scope}</MetadataField>
      <MetadataField label={t('procurement.portal.credentials.issueDate')}>{date(metadata.issued_on)}</MetadataField>
      <MetadataField label={t('procurement.portal.credentials.expiryDate')}>
        {metadata.non_expiring ? t('procurement.portal.credentials.nonExpiring') : date(metadata.expires_on)}
      </MetadataField>
      {requirementId && <MetadataField label="Requirement reference" wide>{requirementId}</MetadataField>}
      <MetadataField label={t('procurement.quoteDetail.evidence.revisionId')} wide>{attachment.revision_id}</MetadataField>
    </dl>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{revision.original_name}</p>
        <p className="break-words text-xs text-muted-foreground">{t('procurement.quoteDetail.evidence.fileMetadata', {
          mime: revision.mime_type, bytes: formatNumber(revision.byte_size),
        })}</p>
      </div>
      {fictional ? <p className="text-xs text-muted-foreground">Fictional file metadata only. No file is stored or available to download.</p> : <Button variant="outline" size="sm" asChild>
        <a href={`/api/procurement/credentials/revisions/${encodeURIComponent(attachment.revision_id)}/file`}
          download={revision.original_name} aria-label={`${t('procurement.portal.evidence.download')}: ${revision.original_name}`}>
          {t('procurement.portal.evidence.download')}
        </a>
      </Button>}
    </div>
  </article>
}