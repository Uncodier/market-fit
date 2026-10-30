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
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { usePortalDemo } from '../demo-context'

const empty: CredentialMetadata = { holder_kind: 'person', holder_name: '', title: '', type: 'professional_license',
  issuer: '', reference: '', scope: '', issued_on: null, expires_on: null, non_expiring: false }

export function CredentialForm({ credential, onSaved, onCancel, open = true, demo: explicitDemo = false }: {
  credential?: Credential; onSaved: (result: { revision_id: string }) => void; onCancel: () => void; open?: boolean; demo?: boolean
}) {
  const portalDemo = usePortalDemo()
  const demo = explicitDemo || portalDemo
  const { t, message } = useProcurementI18n()
  const latest = credential?.revisions.reduce((a, b) => a.revision > b.revision ? a : b)
  const [metadata, setMetadata] = useState<CredentialMetadata>(latest?.metadata ?? empty)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (demo) return
    if (!file) return
    setBusy(true); setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('metadata', JSON.stringify({ credential_id: credential?.id ?? null, expected_version: credential?.version ?? 0, metadata }))
      const response = await fetch('/api/procurement/credentials', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Upload failed')
      onSaved(data)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed') }
    finally { setBusy(false) }
  }
  function field(key: keyof CredentialMetadata, label: string, required = true) {
    return <div className="space-y-1"><Label htmlFor={`credential-${key}`}>{label}</Label><Input id={`credential-${key}`} required={required}
      maxLength={key === 'type' ? 80 : 200} value={String(metadata[key] ?? '')} onChange={event => setMetadata({ ...metadata, [key]: event.target.value })} /></div>
  }
  return <DocumentDialog open={open} onClose={onCancel} busy={busy} title={t(credential ? 'procurement.portal.credentials.addImmutable' : 'procurement.portal.credentials.uploadPersonal')} description={t('procurement.portal.credentials.dialogDescription')}>
    <DialogForm onSubmit={submit}><DialogBody className="space-y-4">
    {demo && <p role="status">Read-only demo credential. Uploading and saving are disabled; no file is stored.</p>}
    <fieldset disabled={demo || busy} className="space-y-4">
    <p className="text-sm text-muted-foreground">{t('procurement.portal.credentials.holderHint')}</p>
    <div className="grid gap-4 md:grid-cols-2">{field('holder_name', t('procurement.portal.credentials.legalName'))}{field('title', t('procurement.portal.credentials.title'))}
      {field('type', t('procurement.portal.credentials.type'))}{field('issuer', t('procurement.portal.credentials.issuer'))}{field('reference', t('procurement.portal.credentials.reference'), false)}</div>
    <Label htmlFor="credential-scope">{t('procurement.portal.credentials.scope')}</Label>
    <Textarea id="credential-scope" maxLength={2000} value={metadata.scope} onChange={event => setMetadata({ ...metadata, scope: event.target.value })} />
    <div className="grid gap-4 md:grid-cols-2">{(['issued_on', 'expires_on'] as const).map(key => <DateOnlyField key={key} label={t(key === 'issued_on' ? 'procurement.portal.credentials.issueDate' : 'procurement.portal.credentials.expiryDate')}
      disabled={busy || (key === 'expires_on' && metadata.non_expiring)} value={metadata[key] ?? ''} onChange={value => setMetadata({ ...metadata, [key]: value || null })} />)}</div>
    <Toggle label={t('procurement.portal.credentials.nonExpiring')} checked={metadata.non_expiring} onChange={checked => setMetadata({ ...metadata, non_expiring: checked, expires_on: checked ? null : metadata.expires_on })} />
    <Label htmlFor="credential-file">{t('procurement.portal.credentials.file')}</Label>
    <Input id="credential-file" type="file" accept="application/pdf,image/png,image/jpeg" required={!file} onChange={event => setFile(event.target.files?.[0] ?? null)} />
    {file && <p className="text-sm text-muted-foreground">{t('procurement.portal.credentials.selectedFile', { name: file.name })}</p>}
    </fieldset>{error && <p role="alert" className="text-destructive">{message(error)}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t('procurement.portal.closeDraft')}</Button><Button disabled={demo || busy || !file}>{t(busy ? 'procurement.portal.credentials.uploading' : 'procurement.portal.credentials.saveRevision')}</Button></DialogFooter></DialogForm>
  </DocumentDialog>
}