'use client'

import { useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { MAX_EVIDENCE_BYTES } from '@/app/purchases/procurement/evidence/schema'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { checkoutInput, checkoutLabel } from './checkout-styles'

export function ProposalUpload({ disabled, onUploaded, onBusy, onPending, holderName, onHolderName }: {
  holderName: string; onHolderName: (name: string) => void;
  disabled: boolean; onUploaded: (revision: string) => void; onBusy: (busy: boolean) => void; onPending: (pending: boolean) => void
}) {
  const { t, message } = useProcurementI18n()
  const name = holderName
  const setName = onHolderName
  const [file, setFile] = useState<File | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function upload() {
    if (!file || !name.trim() || busy) return
    if (file.type !== 'application/pdf' || file.size < 1 || file.size > MAX_EVIDENCE_BYTES) {
      setError(t('procurement.portal.submission.pdfLimit')); return
    }
    setBusy(true); onBusy(true); setError('')
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('metadata', JSON.stringify({ credential_id: null, expected_version: 0, metadata: {
        holder_kind: 'person', holder_name: name.trim(), title: file.name, type: 'tender_proposal',
        issuer: name.trim(), reference: '', scope: '', issued_on: null, expires_on: null, non_expiring: false,
      } }))
      const response = await fetch('/api/procurement/credentials', { method: 'POST', body: form })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed')
      onUploaded(result.revision_id); onPending(false); setUploaded(true)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Upload failed') }
    finally { setBusy(false); onBusy(false) }
  }
  return <section className="space-y-4 border-t border-gray-100 pt-5 dark:border-gray-800">
    <h3 className="text-sm font-semibold">{t('procurement.portal.submission.proposal')}</h3>
    <p className="text-sm text-muted-foreground">{t('procurement.portal.submission.proposalHint')}</p>
    <div><Label className={checkoutLabel} htmlFor="proposal-holder">{t('procurement.portal.credentials.legalName')}</Label>
    <Input className={checkoutInput} id="proposal-holder" maxLength={200} value={name} disabled={disabled || busy || uploaded} onChange={event => setName(event.target.value)} /></div>
    <Label className={checkoutLabel} htmlFor="proposal-file">{t('procurement.portal.submission.proposalFile')}</Label>
    <Input className="h-auto rounded-xl border-dashed bg-gray-50 p-4 dark:bg-gray-950" id="proposal-file" type="file" accept="application/pdf" disabled={disabled || busy || uploaded}
      onChange={event => { setFile(event.target.files?.[0] ?? null); onUploaded(''); onPending(Boolean(event.target.files?.[0])) }} />
    {uploaded ? <p role="status">{t('procurement.portal.submission.proposalReady', { name: file?.name ?? '' })}</p> :
      <Button type="button" variant="outline" disabled={disabled || busy || !file || !name.trim()} onClick={() => void upload()}>
        {t(busy ? 'procurement.portal.credentials.uploading' : 'procurement.portal.submission.uploadProposal')}
      </Button>}
    {file && !uploaded && <p className="text-sm">{t('procurement.portal.submission.uploadBeforeSubmit')}</p>}
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}
  </section>
}