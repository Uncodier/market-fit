'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Textarea } from '@/app/components/ui/textarea'
import { DateOnlyField, Toggle } from '@/app/purchases/procurement/components/form-fields'
import { DocumentDialog } from '@/app/purchases/procurement/commerce/document-ui'
import { DialogForm, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import type { Credential, CredentialMetadata } from '@/app/purchases/procurement/evidence/schema'

const empty: CredentialMetadata = { holder_kind: 'person', holder_name: '', title: '', type: 'professional_license',
  issuer: '', reference: '', scope: '', issued_on: null, expires_on: null, non_expiring: false }

export function CredentialForm({ credential, onSaved, onCancel, open = true }: {
  credential?: Credential; onSaved: () => void; onCancel: () => void; open?: boolean
}) {
  const latest = credential?.revisions.reduce((a, b) => a.revision > b.revision ? a : b)
  const [metadata, setMetadata] = useState<CredentialMetadata>(latest?.metadata ?? empty)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('metadata', JSON.stringify({ credential_id: credential?.id ?? null, expected_version: credential?.version ?? 0, metadata }))
      const response = await fetch('/api/procurement/credentials', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')
      onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed') }
    finally { setBusy(false) }
  }
  function field(key: keyof CredentialMetadata, label: string, required = true) {
    return <div className="space-y-1"><Label htmlFor={`credential-${key}`}>{label}</Label><Input id={`credential-${key}`} required={required}
      maxLength={key === 'type' ? 80 : 200} value={String(metadata[key] ?? '')} onChange={event => setMetadata({ ...metadata, [key]: event.target.value })} /></div>
  }
  return <DocumentDialog open={open} onClose={onCancel} busy={busy} title={credential ? 'Add immutable revision' : 'Upload personal credential'} description="Private profile evidence, shared only by explicit revision selection.">
    <DialogForm onSubmit={submit}><DialogBody className="space-y-4"><fieldset disabled={busy} className="space-y-4">
    <p className="text-sm text-muted-foreground">You are the account holder and uploader. Organization-owned credentials are not supported. Legal representation documents are evidence, not account access grants.</p>
    <div className="grid gap-4 md:grid-cols-2">{field('holder_name', 'Your legal name')}{field('title', 'Credential title')}
      {field('type', 'Type identifier (for example professional_license or legal_representation)')}{field('issuer', 'Issuer')}{field('reference', 'Certificate reference', false)}</div>
    <Label htmlFor="credential-scope">Covered activities, locations or specialties</Label>
    <Textarea id="credential-scope" maxLength={2000} value={metadata.scope} onChange={event => setMetadata({ ...metadata, scope: event.target.value })} />
    <div className="grid gap-4 md:grid-cols-2">{(['issued_on', 'expires_on'] as const).map(key => <DateOnlyField key={key} label={key === 'issued_on' ? 'Issue date (optional)' : 'Expiry date (optional)'}
      disabled={busy || (key === 'expires_on' && metadata.non_expiring)} value={metadata[key] ?? ''} onChange={value => setMetadata({ ...metadata, [key]: value || null })} />)}</div>
    <Toggle label="Explicitly non-expiring" checked={metadata.non_expiring} onChange={checked => setMetadata({ ...metadata, non_expiring: checked, expires_on: checked ? null : metadata.expires_on })} />
    <Label htmlFor="credential-file">Private file (PDF, PNG or JPEG, maximum 8 MiB)</Label>
    <Input id="credential-file" type="file" accept="application/pdf,image/png,image/jpeg" required={!file} onChange={event => setFile(event.target.files?.[0] ?? null)} />
    {file && <p className="text-sm text-muted-foreground">Selected file: {file.name}</p>}
    </fieldset>{error && <p role="alert" className="text-destructive">{error}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Close and keep draft</Button><Button disabled={busy || !file}>{busy ? 'Uploading…' : 'Save revision'}</Button></DialogFooter></DialogForm>
  </DocumentDialog>
}