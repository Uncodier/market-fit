'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

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
import { isProcurementDemo } from '../ui/is-demo'

export function RepresentativeManager({ siteId, supplierId }: { siteId: string; supplierId: string }) {
  const { user } = useAuthContext()
  if (isProcurementDemo(siteId)) return <Card><CardHeader><CardTitle>Supplier representatives</CardTitle></CardHeader><CardContent className="space-y-3">
    <DocumentTable rows={[{ id: 'demo-representative', name: 'Taylor Brooks', email: 'taylor@example.com' }]} empty="No representatives" compact columns={[
      { label: 'Representative', render: row => row.name }, { label: 'Account', render: row => row.email },
      { label: 'Status', render: () => 'Active' }, { label: 'Access', render: () => <Button variant="outline" disabled>Revoke access</Button> },
    ]} />
  </CardContent></Card>
  return user ? <AccountRepresentatives key={`${user.id}:${siteId}:${supplierId}`} siteId={siteId} supplierId={supplierId} userId={user.id} /> : null
}

function AccountRepresentatives({ siteId, supplierId, userId: actorId }: { siteId: string; supplierId: string; userId: string }) {
  const { t, message } = useProcurementI18n()
  const [adding, setAdding] = useState(false)
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [confirmation, setConfirmation] = useState<{ userId: string; revoke: boolean } | null>(null)
  const { data, error, mutate, isLoading } = useSWR(['supplier-representatives', actorId, siteId, supplierId], async () => {
    const response = await fetch(`/api/procurement/credentials/representatives?site_id=${siteId}&supplier_id=${supplierId}`, { cache: 'no-store' })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Unable to load representatives')
    return body as { representatives: { id: string; user_id: string; revoked_at: string | null }[] }
  })
  async function save(account: string, revoke: boolean) {
    setBusy(true); setNotice(''); setSaveError('')
    try {
      const response = await fetch(`/api/procurement/credentials/representatives?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier_id: supplierId, user_id: account, revoke }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Representation update failed')
      setNotice(revoke ? 'procurement.portal.representatives.revokedNotice' : 'procurement.portal.representatives.grantedNotice')
      setAdding(false); setUserId(''); await mutate()
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Representation update failed'); throw error }
    finally { setBusy(false) }
  }
  return <Card><CardHeader><CardTitle>{t('procurement.portal.representatives.title')}</CardTitle><Button variant="outline" disabled={isLoading || !!error} onClick={() => setAdding(true)}>{t('procurement.portal.representatives.add')}</Button></CardHeader><CardContent className="space-y-3">
    <ConfirmDialog open={Boolean(confirmation)} onOpenChange={open => { if (!open) setConfirmation(null) }}
      title={t(confirmation?.revoke ? 'procurement.portal.representatives.revokeTitle' : 'procurement.portal.representatives.grantTitle')}
      description={t(confirmation?.revoke ? 'procurement.portal.representatives.revokeDescription' : 'procurement.portal.representatives.grantDescription')}
      confirmLabel={t('procurement.common.confirm')} cancelLabel={t('procurement.common.cancel')}
      loading={busy} onConfirm={async () => { if (confirmation) await save(confirmation.userId, confirmation.revoke) }} />
    <p className="text-sm text-muted-foreground">{t('procurement.portal.representatives.description')}</p>
    <DocumentDialog open={adding} onClose={() => setAdding(false)} busy={busy} title={t('procurement.portal.representatives.grant')} description={t('procurement.portal.representatives.verifyHint')}>
      <DialogForm onSubmit={event => { event.preventDefault(); if (!busy && userId) setConfirmation({ userId, revoke: false }) }}><DialogBody>
        <Label htmlFor="representative-user">{t('procurement.portal.representatives.accountId')}</Label><Input id="representative-user" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" disabled={busy} value={userId} onChange={event => setUserId(event.target.value)} placeholder={t('procurement.portal.representatives.uuid')} />
      </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setAdding(false)}>{t('procurement.portal.closeDraft')}</Button><Button disabled={busy || !userId}>{t('procurement.portal.representatives.review')}</Button></DialogFooter></DialogForm>
    </DocumentDialog>
    {error && <p role="alert">{message(error.message)}</p>}
    {!error && <DocumentTable loading={isLoading} rows={data?.representatives ?? []} empty={t('procurement.portal.representatives.empty')} compact columns={[
      { label: t('procurement.portal.representatives.account'), render: grant => <code>{grant.user_id}</code> },
      { label: t('procurement.common.status'), render: grant => t(grant.revoked_at ? 'procurement.portal.representatives.revoked' : 'procurement.portal.representatives.active') },
      { label: t('procurement.portal.access'), render: grant => <Button variant="outline" disabled={busy} onClick={() => setConfirmation({ userId: grant.user_id, revoke: !grant.revoked_at })}>{t(grant.revoked_at ? 'procurement.portal.representatives.restore' : 'procurement.portal.representatives.revoke')}</Button> },
    ]} />}
    {notice && <p role="status">{t(notice)}</p>}
    {saveError && <p role="alert">{message(saveError)}</p>}
  </CardContent></Card>
}