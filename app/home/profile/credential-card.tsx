'use client'

import { Button } from '@/app/components/ui/button'
import { Badge } from '@/app/components/ui/badge'
import { Download } from '@/app/components/ui/icons'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import type { Credential } from '@/app/purchases/procurement/evidence/schema'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

export function CredentialCard({ credential, demo, archiving, onEdit, onArchive }: {
  credential: Credential; demo: boolean; archiving: string | null
  onEdit: () => void; onArchive: () => void
}) {
  const { t, valueLabel, formatDate, formatNumber } = useProcurementI18n()
  const revisions = [...credential.revisions].sort((a, b) => b.revision - a.revision)
  const titleId = `credential-${credential.id}-title`

  return <section aria-labelledby={titleId} className="min-w-0 space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <h3 id={titleId} className="break-words text-lg font-semibold tracking-tight">{revisions[0]?.metadata.title ?? t('procurement.portal.credentials.fallback')}</h3>
        {credential.archived_at && <Badge variant="secondary" className="shrink-0">{t('procurement.portal.credentials.archived')}</Badge>}
      </div>
      {!credential.archived_at && <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>{demo ? 'Preview credential' : t('procurement.portal.credentials.addRevision')}</Button>
        <Button variant="outline" size="sm" disabled={demo || archiving !== null} onClick={onArchive}>{t(archiving === credential.id ? 'procurement.portal.credentials.archiving' : 'procurement.portal.credentials.archiveHistory')}</Button>
      </div>}
    </header>
    <DocumentTable rows={revisions} empty={t('procurement.portal.credentials.emptyRevisions')} compact columns={[
      { label: t('procurement.portal.credentials.revisionIssuer'), render: revision => <div className="space-y-1">
        <p className="font-medium">{t('procurement.portal.revision', { revision: formatNumber(revision.revision) })} · {revision.metadata.issuer}</p>
        <p className="text-xs text-muted-foreground">{valueLabel(revision.metadata.type)}</p>
      </div> },
      { label: t('procurement.portal.credentials.holderExpiry'), render: revision => <div className="space-y-1">
        <p className="font-medium">{revision.metadata.holder_name}</p>
        <p className="text-xs text-muted-foreground">{revision.metadata.expires_on ? t('procurement.portal.credentials.expires', { date: formatDate(revision.metadata.expires_on, { dateStyle: 'medium', timeZone: 'UTC' }) }) : t(revision.metadata.non_expiring ? 'procurement.portal.credentials.declaredNonExpiring' : 'procurement.portal.credentials.expiryUnknown')}</p>
      </div> },
      { label: t('procurement.portal.credentials.fileStatus'), render: revision => <div className="space-y-1">
        <p className="break-all font-medium">{revision.original_name}</p>
        <p className="text-xs text-muted-foreground">{formatNumber(Math.ceil(revision.byte_size / 1024))} KiB · {t(revision.state === 'ready' ? 'procurement.portal.credentials.uploaded' : 'procurement.portal.credentials.incomplete')}</p>
      </div> },
      { label: t('procurement.portal.access'), render: revision => revision.state === 'ready' && (demo
        ? <span className="text-xs text-muted-foreground">Example only · no file stored</span>
        : <Button variant="ghost" size="sm" asChild><a href={`/api/procurement/credentials/revisions/${revision.id}/file`}><Download className="mr-2 h-4 w-4" />{t('procurement.portal.credentials.download')}</a></Button>) },
    ]} />
  </section>
}