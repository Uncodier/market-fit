import { useState } from 'react'
import { RelationSelect } from '@/app/components/ui/relation-select'
import { Button } from '@/app/components/ui/button'
import { demoTenderSuppliers } from '@/lib/demo-data/procurement-workflow'
import { useProcurementI18n } from '../procurement/i18n/use-procurement-i18n'
import { useProcurementOptions } from '../procurement/components/use-procurement-options'

async function readSuppliers(url: string, signal: AbortSignal): Promise<{ id: string; name: string }[]> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  const body = await response.json()
  if (!response.ok || !Array.isArray(body.suppliers)) throw new Error(body.error || 'Unable to load suppliers')
  return body.suppliers
}

export function TenderInvitationPicker({ siteId, demo, busy, onInvite }: {
  siteId: string; demo: boolean; busy: boolean; onInvite: (id: string) => void
}) {
  const { t, message } = useProcurementI18n()
  const [id, setId] = useState('')
  const { data, error, loading, retry } = useProcurementOptions(demo ? null : `/api/procurement/suppliers?site_id=${encodeURIComponent(siteId)}&status=approved`, readSuppliers)
  const suppliers = demo ? demoTenderSuppliers : data ?? []
  const supplier = suppliers.find(row => row.id === id)
  return <div className="space-y-2">
    {error && <p role="alert">{message(error)} <Button type="button" variant="outline" size="sm" onClick={retry}>{t('procurement.common.retry')}</Button></p>}
    <div className="flex flex-wrap gap-3"><RelationSelect label={t('procurement.workflow.tender.approvedSupplier')} disabled={demo || busy || loading || !!error} allowCreate={false}
      placeholder={t('procurement.workflow.tender.selectSupplier')} value={supplier ? { mode: 'existing', id, label: supplier.name } : null}
      options={suppliers.map(row => ({ id: row.id, label: row.name }))} onValueChange={value => setId(value?.mode === 'existing' ? value.id : '')} />
      <Button disabled={demo || !supplier || busy} onClick={() => { if (supplier) onInvite(supplier.id) }}>{t('procurement.workflow.tender.registerInvitation')}</Button></div>
  </div>
}