'use client'

import { CredentialsSkeleton } from '../portal-skeletons'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { FileText, UploadCloud, Shield } from '@/app/components/ui/icons'
import { Alert, AlertDescription } from '@/app/components/ui/alert'
import type { Credential } from '@/app/purchases/procurement/evidence/schema'
import { CredentialForm } from './credential-form'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { usePortalDemo } from '../demo-context'
import { demoPortalCredentials } from '@/lib/demo-data/procurement-portal'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { CredentialCard } from './credential-card'
import { AccountSearch } from '@/app/buyer/components/AccountSearch'

export function CredentialManager() {
  const { user } = useAuthContext()
  const demo = usePortalDemo()
  return user || demo ? <AccountCredentialManager key={demo ? 'demo' : user?.id} demo={demo} /> : <CredentialsSkeleton />
}

function AccountCredentialManager({ demo }: { demo: boolean }) {
  const { t, message, valueLabel } = useProcurementI18n()
  const { user } = useAuthContext()
  const [drafts, setDrafts] = useState<(Credential | 'new')[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  function edit(credential: Credential | 'new') {
    const id = credential === 'new' ? 'new' : credential.id
    setDrafts(current => current.some(row => (row === 'new' ? 'new' : row.id) === id) ? current : [...current, credential])
    setEditing(id)
  }
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [archiving, setArchiving] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Credential | null>(null)
  const { data: liveData, error: loadError, mutate, isLoading } = useSWR(!demo && user ? ['personal-credentials', user.id] : null, async () => {
    const response = await fetch('/api/procurement/credentials', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Unable to load credentials')
    return body as { credentials: Credential[]; assessment: { status: string; reason: string } }
  })
  const data = demo ? { credentials: demoPortalCredentials, assessment: { status: 'pending', reason: 'Fictional evidence preview. No identity verification or AI assessment has been performed.' } } : liveData
  const query = search.trim().toLocaleLowerCase()
  const credentials = (data?.credentials ?? []).filter(credential => !query || credential.revisions.some(revision => {
    const { title, issuer, holder_name, reference, scope, type } = revision.metadata
    return [title, issuer, holder_name, reference, scope, type, valueLabel(type), revision.original_name]
      .join(' ').toLocaleLowerCase().includes(query)
  }))
  async function archive(credential: Credential) {
    if (demo) return
    setArchiving(credential.id); setError('')
    try {
      const response = await fetch(`/api/procurement/credentials/${credential.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: credential.version }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Archive failed')
      await mutate()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Archive failed') }
    finally { setArchiving(null) }
  }
  return <section aria-labelledby="private-credentials-title" className="min-w-0 space-y-6">
    <AccountSearch value={search} onChange={event => setSearch(event.target.value)}
      placeholder={t('procurement.common.searchFor', { label: t('procurement.portal.home.credentials') })} />
    {demo && <ProcurementDemoNotice />}
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={open => { if (!open) setArchiveTarget(null) }}
      title={t('procurement.portal.credentials.archiveTitle')} description={t('procurement.portal.credentials.archiveDescription')}
      confirmLabel={t('procurement.portal.credentials.archive')} cancelLabel={t('procurement.common.cancel')} loading={archiving !== null} onConfirm={async () => { if (archiveTarget) await archive(archiveTarget) }} />
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="private-credentials-title" className="text-2xl font-semibold tracking-tight">{t('procurement.portal.credentials.private')}</h2>
      <Button disabled={demo} className="shrink-0" onClick={() => edit('new')}><UploadCloud className="mr-2 h-4 w-4" />{t('procurement.portal.credentials.upload')}</Button>
    </header>
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{t('procurement.portal.credentials.storageHint')}</p>
      {!isLoading && !loadError && <div className="flex items-start gap-2 border-t border-border/70 pt-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-relaxed">{t('procurement.portal.credentials.assessment', { status: valueLabel(data?.assessment.status ?? 'pending').toLocaleLowerCase(), reason: data?.assessment.reason ? (demo ? data.assessment.reason : message(data.assessment.reason)) : t('procurement.portal.credentials.noAssessment') })}</p>
      </div>}
    </div>
    {(loadError || error) && <Alert variant="destructive"><AlertDescription>{message(error || loadError.message)}</AlertDescription></Alert>}
    {isLoading && <CredentialsSkeleton contentOnly />}
    {drafts.map(draft => {
      const id = draft === 'new' ? 'new' : draft.id
      return <CredentialForm key={id} demo={demo} open={editing === id} credential={draft === 'new' ? undefined : draft}
        onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setDrafts(current => current.filter(row => (row === 'new' ? 'new' : row.id) !== id)); void mutate() }} />
    })}
    {!isLoading && !loadError && data && credentials.length === 0 && <EmptyCard icon={<FileText size={24} />} title={t(query ? 'procurement.common.noChoices' : 'procurement.portal.credentials.empty')}
      description="" showHint={false} showShadow={false} contentClassName="min-h-0 py-6" />}
    {credentials.map(credential => <CredentialCard key={credential.id} credential={credential} demo={demo}
      archiving={archiving} onEdit={() => edit(credential)} onArchive={() => setArchiveTarget(credential)} />)}
  </section>
}