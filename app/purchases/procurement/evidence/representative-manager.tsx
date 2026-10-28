'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { ConfirmDialog } from '@/app/components/ui/confirm-dialog'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { SectionCard as Card, SectionCardContent as CardContent, SectionCardHeader as CardHeader, SectionCardTitle as CardTitle } from '@/app/components/ui/section-card'
import { DocumentTable, DocumentDialog } from '../commerce/document-ui'
import { DialogForm, DialogBody, DialogFooter } from '@/app/components/ui/dialog'

export function RepresentativeManager({ siteId, supplierId }: { siteId: string; supplierId: string }) {
  const { user } = useAuthContext()
  return user ? <AccountRepresentatives key={`${user.id}:${siteId}:${supplierId}`} siteId={siteId} supplierId={supplierId} userId={user.id} /> : null
}

function AccountRepresentatives({ siteId, supplierId, userId: actorId }: { siteId: string; supplierId: string; userId: string }) {
  const [adding, setAdding] = useState(false)
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState<{ userId: string; revoke: boolean } | null>(null)
  const { data, error, mutate, isLoading } = useSWR(['supplier-representatives', actorId, siteId, supplierId], async () => {
    const response = await fetch(`/api/procurement/credentials/representatives?site_id=${siteId}&supplier_id=${supplierId}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Unable to load representatives')
    return body as { representatives: { id: string; user_id: string; revoked_at: string | null }[] }
  })
  async function save(account: string, revoke: boolean) {
    setBusy(true); setMessage('')
    try {
      const response = await fetch(`/api/procurement/credentials/representatives?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_id: supplierId, user_id: account, revoke }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Representation update failed')
      setMessage(revoke ? 'Representation revoked.' : 'Representation granted to the verified account.')
      setAdding(false); setUserId(''); await mutate()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Representation update failed'); throw error }
    finally { setBusy(false) }
  }
  return <Card><CardHeader><CardTitle>Supplier account representation</CardTitle><Button variant="outline" disabled={isLoading || !!error} onClick={() => setAdding(true)}>Add representative</Button></CardHeader><CardContent className="space-y-3">
    <ConfirmDialog open={Boolean(confirmation)} onOpenChange={open => { if (!open) setConfirmation(null) }}
      title={confirmation?.revoke ? 'Revoke supplier representation?' : 'Grant supplier representation?'}
      description={confirmation?.revoke ? 'This account will no longer be able to submit for this supplier. Existing submission records are retained.' : 'Confirm you independently verified this account is authorized to submit on behalf of this supplier.'}
      loading={busy} onConfirm={async () => { if (confirmation) await save(confirmation.userId, confirmation.revoke) }} />
    <p className="text-sm text-muted-foreground">Only a workspace owner or administrator can grant an existing, email-verified account access to submit for this supplier. Confirm identity independently. A contact email, company link or legal document does not grant access. This does not authorize organization credential management.</p>
    <DocumentDialog open={adding} onClose={() => setAdding(false)} busy={busy} title="Grant supplier representation" description="Verify the existing account independently before granting access.">
      <DialogForm onSubmit={event => { event.preventDefault(); if (!busy && userId) setConfirmation({ userId, revoke: false }) }}><DialogBody>
        <Label htmlFor="representative-user">Verified account ID</Label><Input id="representative-user" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" disabled={busy} value={userId} onChange={event => setUserId(event.target.value)} placeholder="Account UUID" />
      </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setAdding(false)}>Close and keep draft</Button><Button disabled={busy || !userId}>Review grant</Button></DialogFooter></DialogForm>
    </DocumentDialog>
    {error && <p role="alert">{error.message}</p>}
    <DocumentTable loading={isLoading} rows={error ? [] : data?.representatives ?? []} empty="No account grants for this supplier." columns={[
      { label: 'Verified account', render: grant => <code>{grant.user_id}</code> },
      { label: 'Status', render: grant => grant.revoked_at ? 'Revoked' : 'Active' },
      { label: 'Access', render: grant => <Button variant="outline" disabled={busy} onClick={() => setConfirmation({ userId: grant.user_id, revoke: !grant.revoked_at })}>{grant.revoked_at ? 'Restore grant' : 'Revoke grant'}</Button> },
    ]} />
    {message && <p role="status">{message}</p>}
  </CardContent></Card>
}