'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { SectionCard as Card, SectionCardHeader as CardHeader, SectionCardTitle as CardTitle, SectionCardContent as CardContent } from '@/app/components/ui/section-card'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import type { Credential } from '@/app/purchases/procurement/evidence/schema'
import { CredentialForm } from './credential-form'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { TopBarPrimaryActions } from '@/app/components/navigation/topbar-primary-actions'

export function CredentialManager() {
  const { user } = useAuthContext()
  return user ? <AccountCredentialManager key={user.id} /> : <p>Sign in to manage your credentials.</p>
}

function AccountCredentialManager() {
  const { user } = useAuthContext()
  const [drafts, setDrafts] = useState<(Credential | 'new')[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  function edit(credential: Credential | 'new') {
    const id = credential === 'new' ? 'new' : credential.id
    setDrafts(current => current.some(row => (row === 'new' ? 'new' : row.id) === id) ? current : [...current, credential])
    setEditing(id)
  }
  const [error, setError] = useState('')
  const [archiving, setArchiving] = useState<string | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Credential | null>(null)
  const { data, error: loadError, mutate, isLoading } = useSWR(user ? ['personal-credentials', user.id] : null, async () => {
    const response = await fetch('/api/procurement/credentials', { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Unable to load credentials')
    return body as { credentials: Credential[]; assessment: { status: string; reason: string } }
  })
  async function archive(credential: Credential) {
    setArchiving(credential.id); setError('')
    try {
      const response = await fetch(`/api/procurement/credentials/${credential.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: credential.version }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Archive failed')
      await mutate()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Archive failed') }
    finally { setArchiving(null) }
  }
  return <section className="space-y-4">
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={open => { if (!open) setArchiveTarget(null) }}
      title="Archive this credential?" description="It will no longer be selectable for new submissions. All revisions, files and already shared evidence will be retained."
      confirmLabel="Archive credential" loading={archiving !== null} onConfirm={async () => { if (archiveTarget) await archive(archiveTarget) }} />
    <TopBarPrimaryActions><Button onClick={() => edit('new')}>Upload credential</Button></TopBarPrimaryActions>
    <h2 className="text-2xl font-semibold">Private credentials</h2>
    <p className="text-sm text-muted-foreground">Documents stay private unless you select a specific revision for a submission. Renewals do not replace shared evidence. Archiving hides a credential from future selection and retains its files and history. Maximum 8 MiB per file and 128 MiB total reserved storage per account, including incomplete uploads and archived revisions.</p>
    <p className="rounded border p-3 text-sm">Provisional assessment: pending. {data?.assessment.reason ?? 'No credential assessment worker is configured. Evidence is not verified or accepted.'}</p>
    {(loadError || error) && <p role="alert" className="text-destructive">{error || loadError.message}</p>}
    {isLoading && <p>Loading credentials…</p>}
    {drafts.map(draft => {
      const id = draft === 'new' ? 'new' : draft.id
      return <CredentialForm key={id} open={editing === id} credential={draft === 'new' ? undefined : draft}
        onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setDrafts(current => current.filter(row => (row === 'new' ? 'new' : row.id) !== id)); void mutate() }} />
    })}
    {data?.credentials.length === 0 && <p>No credentials uploaded yet.</p>}
    {data?.credentials.map(credential => <Card key={credential.id}>
      <CardHeader><CardTitle>{[...credential.revisions].sort((a, b) => b.revision - a.revision)[0]?.metadata.title ?? 'Credential'} {credential.archived_at && '(archived)'}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <DocumentTable rows={[...credential.revisions].sort((a, b) => b.revision - a.revision)} empty="No credential revisions." columns={[
          { label: 'Revision / issuer', render: revision => <><p className="font-medium">Revision {revision.revision} · {revision.metadata.issuer}</p><p>{revision.metadata.type}</p></> },
          { label: 'Holder / expiry', render: revision => <>{revision.metadata.holder_name}<p>{revision.metadata.expires_on ? `Expires ${revision.metadata.expires_on}` : revision.metadata.non_expiring ? 'Declared non-expiring' : 'Expiry unknown'}</p></> },
          { label: 'File / status', render: revision => <>{revision.original_name}<p>{Math.ceil(revision.byte_size / 1024)} KiB · {revision.state === 'ready' ? 'Uploaded, not verified' : 'Upload incomplete'}</p></> },
          { label: 'Access', render: revision => revision.state === 'ready' && <Button variant="link" asChild><a href={`/api/procurement/credentials/revisions/${revision.id}/file`}>Download private evidence</a></Button> },
        ]} />
        {!credential.archived_at && <div className="flex gap-2"><Button variant="outline" onClick={() => edit(credential)}>Add revision</Button><Button variant="outline" disabled={archiving !== null} onClick={() => setArchiveTarget(credential)}>{archiving === credential.id ? 'Archiving…' : 'Archive and retain history'}</Button></div>}
      </CardContent>
    </Card>)}
  </section>
}