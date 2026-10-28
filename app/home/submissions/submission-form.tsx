'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { DocumentDialog } from '@/app/purchases/procurement/commerce/document-ui'
import { DialogForm, DialogBody, DialogFooter } from '@/app/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/app/components/ui/select'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import type { Credential } from '@/app/purchases/procurement/evidence/schema'
import { type Opportunity, readPortalJson } from './types'

export function SubmissionForm({ opportunity, onSubmitted, onCancel, open = true }: { opportunity: Opportunity; onSubmitted: () => void; onCancel: () => void; open?: boolean }) {
  const { user } = useAuthContext()
  const [reference, setReference] = useState('')
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [key] = useState(() => crypto.randomUUID())
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data, error: credentialError } = useSWR(user ? ['submission-credentials', user.id] : null,
    () => readPortalJson('/api/procurement/credentials') as Promise<{ credentials: Credential[] }>)
  const revisions = data?.credentials.filter(credential => !credential.archived_at).flatMap(credential => credential.revisions.filter(revision => revision.state === 'ready')) ?? []
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (opportunity.requirements.some(line => !/^\d+$/.test(prices[line.id] ?? '') || !Number.isSafeInteger(Number(prices[line.id])) || Number(prices[line.id]) > 1000000000)) { setError('Enter a whole non-negative unit price for every requirement.'); return }
    setBusy(true); setAttempted(true); setError('')
    try {
      const response = await fetch(`/api/procurement/commerce/submissions?site_id=${opportunity.site_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          supplier_id: opportunity.supplier_id, tender_id: opportunity.tender_id, publication_id: opportunity.publication_id,
          reference, idempotency_key: key,
          lines: opportunity.requirements.map(line => ({ requirement_id: line.id, unit_net_minor: Number(prices[line.id]) })),
          evidence: Object.entries(evidence).filter(([, revision]) => revision).map(([requirement_id, revision_id]) => ({ requirement_id, revision_id })),
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Submission failed')
      onSubmitted()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Submission failed') }
    finally { setBusy(false) }
  }
  return <DocumentDialog open={open} onClose={onCancel} busy={busy} title={`Submit for ${opportunity.supplier_name}`} description="Confirm the immutable quotation and exactly which evidence revisions to disclose.">
    <DialogForm onSubmit={submit}><DialogBody className="space-y-4"><fieldset disabled={busy || attempted} className="space-y-4">
    <p>{opportunity.title} · Published version {opportunity.version}</p>
    <p className="text-sm">Quotation and selected evidence revisions become immutable. Sharing is not certification acceptance. The buyer can read shared evidence {opportunity.opening_policy === 'on_receipt' ? 'on receipt' : `after opening at ${opportunity.opening_at}`}.</p>
    <Label htmlFor="submission-reference">Your quotation reference</Label><Input id="submission-reference" maxLength={200} required value={reference} onChange={event => setReference(event.target.value)} />
    {opportunity.requirements.map(line => <div className="space-y-2 rounded border p-3" key={line.id}>
      <p>{line.description} · {line.quantity} {line.unit}</p>
      <Label htmlFor={`price-${line.id}`}>Unit net price in minor units ({opportunity.currency}; 100 = 1.00)</Label>
      <Input id={`price-${line.id}`} type="number" required min={0} max={1000000000} step={1} value={prices[line.id] ?? ''} onChange={event => setPrices({ ...prices, [line.id]: event.target.value })} />
      <Label htmlFor={`evidence-${line.id}`}>Explicitly share personal evidence (optional)</Label>
      <Select value={evidence[line.id] || 'none'} disabled={busy || attempted || !!credentialError} onValueChange={value => setEvidence({ ...evidence, [line.id]: value === 'none' ? '' : value })}>
        <SelectTrigger id={`evidence-${line.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Do not share a credential</SelectItem>
          {revisions.map(revision => <SelectItem key={revision.id} value={revision.id}>{revision.metadata.title} · revision {revision.revision} · {revision.metadata.holder_name}</SelectItem>)}
        </SelectContent></Select>
    </div>)}
    </fieldset>{attempted && <p className="text-sm">Attempted fields are locked so retries submit the identical quotation and evidence.</p>}
    {credentialError && <p role="alert">Credential selection unavailable: {credentialError.message}</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Close and keep draft</Button><Button disabled={busy}>{busy ? 'Submitting…' : 'Submit immutable quotation'}</Button></DialogFooter></DialogForm>
  </DocumentDialog>
}