'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { SectionCard, SectionCardContent, SectionCardHeader, SectionCardTitle } from '@/app/components/ui/section-card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/app/components/ui/table'
import { OfferForm } from './OfferForm'
import { RotateCw, Users, ClipboardList, FileText } from '@/app/components/ui/icons'
import type { CatalogProcurement } from './schema'

export function ProcurementTab({ itemId, siteId }: { itemId?: string; siteId?: string }) {
  if (!itemId || !siteId) return <p>Save the catalog item in a workspace before configuring procurement.</p>
  return <WorkspaceProcurement key={`${siteId}:${itemId}`} itemId={itemId} siteId={siteId} />
}

function WorkspaceProcurement({ itemId, siteId }: { itemId: string; siteId: string }) {
  const [data, setData] = useState<CatalogProcurement | null>(null)
  const [offset, setOffset] = useState(0), [reload, setReload] = useState(0)
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const endpoint = `/api/procurement/catalog/${itemId}?site_id=${siteId}`
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${endpoint}&offset=${offset}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load procurement')
      if (!controller.signal.aborted) setData(result)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, offset, reload])

  async function toggle(enabled: boolean) {
    if (!data) return
    setSaving(true); setError('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ procurement_enabled: enabled, expected_enabled: data.item.procurement_enabled }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save capability')
      refresh()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save capability') }
    finally { setSaving(false) }
  }

  function refresh() { setLoading(true); setError(''); setReload(value => value + 1) }
  const today = new Date().toISOString().slice(0, 10)
  return <div className="mx-auto max-w-[1000px] space-y-6">
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div role="toolbar" aria-label="Procurement actions" className="flex justify-end gap-1 border-b pb-3">
      <Button variant="ghost" size="icon" title="Create purchase request" aria-label="Create purchase request" asChild><Link href="/purchases/requests/new"><ClipboardList className="h-4 w-4" /></Link></Button>
      <Button variant="ghost" size="icon" title="Create tender" aria-label="Create tender" asChild><Link href="/purchases/tenders/new"><FileText className="h-4 w-4" /></Link></Button>
      <Button variant="ghost" size="icon" title="Manage suppliers" aria-label="Manage suppliers" asChild><Link href="/suppliers"><Users className="h-4 w-4" /></Link></Button>
      <Button variant="ghost" size="icon" title="Refresh procurement" aria-label="Refresh procurement" disabled={loading || saving} onClick={refresh}><RotateCw className="h-4 w-4" /></Button>
    </div>
    {loading && <p role="status">Loading procurement…</p>}{data && <>
      <SectionCard><SectionCardHeader><SectionCardTitle>Procurement capability</SectionCardTitle></SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="flex items-center gap-3"><Switch id="procurement-enabled" checked={data.item.procurement_enabled}
            disabled={!data.can_edit || data.item.status !== 'active' || saving || loading || !!error} onCheckedChange={toggle} />
            <Label htmlFor="procurement-enabled">Enable this item for procurement</Label></div>
          <p className="text-sm text-muted-foreground">Sales settings remain unchanged. Procurement-only items and sales disabling are not available yet. This setting does not change storefront visibility or the existing purchasable/variant behavior.</p>
          <p className="text-sm text-muted-foreground">Select the item and verify quantities and net amounts in the new request or tender. No supplier, price, conversion, or approval is transferred automatically.</p>
        </SectionCardContent></SectionCard>
      <SectionCard><SectionCardHeader><SectionCardTitle>Supplier sourcing history</SectionCardTitle>{data.can_add_offer && data.item.procurement_enabled && data.item.status === 'active' && <OfferForm disabled={loading || !!error} siteId={siteId} endpoint={endpoint} onSaved={() => { setOffset(0); refresh() }} />}</SectionCardHeader>
        <SectionCardContent className="space-y-4">
          {!data.offers.length ? <p>No supplier offers recorded.</p> : <div className="overflow-auto"><Table className="w-full text-left text-sm">
            <TableHeader><TableRow><TableHead className="p-2">Supplier</TableHead><TableHead>Purchase unit</TableHead><TableHead>Minimum / lead time</TableHead><TableHead>Net price</TableHead><TableHead>Validity</TableHead><TableHead>Terms</TableHead></TableRow></TableHeader>
            <TableBody>{data.offers.map(offer => {
              const supplier = data.suppliers.find(row => row.id === offer.supplier_id)
              return <TableRow key={offer.id} className="border-t align-top"><TableCell className="p-2"><Link className="underline" href={`/suppliers/${offer.supplier_id}`}>{supplier?.name ?? 'Supplier unavailable'}</Link><p>{supplier?.status}</p></TableCell>
                <TableCell>{offer.purchase_unit}<p>{offer.units_per_purchase_unit} catalog units</p></TableCell><TableCell>{offer.minimum_quantity} purchase units<p>{offer.lead_time_days} days</p></TableCell>
                <TableCell>{offer.unit_price_minor} {offer.currency} minor units</TableCell><TableCell>{offer.valid_from} – {offer.valid_until}<p>{offer.valid_until < today ? 'Expired' : offer.valid_from > today ? 'Future' : 'Within date range'}</p></TableCell><TableCell className="max-w-64 whitespace-pre-wrap">{offer.terms || '—'}</TableCell></TableRow>
            })}</TableBody></Table></div>}
          <div className="flex items-center gap-3"><Button variant="outline" disabled={offset === 0} onClick={() => { setLoading(true); setOffset(value => value - 50) }}>Previous offers</Button><span>{data.total} offers</span>
            <Button variant="outline" disabled={offset + 50 >= data.total} onClick={() => { setLoading(true); setOffset(value => value + 50) }}>Next offers</Button></div>
        </SectionCardContent></SectionCard>

    </>}
  </div>
}