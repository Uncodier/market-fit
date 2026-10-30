'use client'

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { ProcurementLoading } from '@/app/purchases/procurement/ui/loading'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { Switch } from '@/app/components/ui/switch'
import { Label } from '@/app/components/ui/label'
import { SectionCard, SectionCardContent, SectionCardHeader, SectionCardTitle } from '@/app/components/ui/section-card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/app/components/ui/table'
import { OfferForm } from './OfferForm'
import { RotateCw, Users, ClipboardList, FileText } from '@/app/components/ui/icons'
import type { CatalogProcurement } from './schema'
import { isProcurementDemo } from '@/app/purchases/procurement/ui/is-demo'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { demoCatalogProcurement } from '@/lib/demo-data/procurement-catalog'

export function ProcurementTab({ itemId, siteId }: { itemId?: string; siteId?: string }) {
  const { t } = useProcurementI18n()
  if (!itemId || !siteId) return <p>{t('procurement.portal.catalog.saveFirst')}</p>
  return <WorkspaceProcurement key={`${siteId}:${itemId}`} itemId={itemId} siteId={siteId} />
}

function WorkspaceProcurement({ itemId, siteId }: { itemId: string; siteId: string }) {
  const demo = isProcurementDemo(siteId)
  const { t, message, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const [data, setData] = useState<CatalogProcurement | null>(() => demo ? demoCatalogProcurement(itemId) : null)
  const [offset, setOffset] = useState(0), [reload, setReload] = useState(0)
  const [error, setError] = useState(''), [loading, setLoading] = useState(!demo), [saving, setSaving] = useState(false)
  const endpoint = `/api/procurement/catalog/${itemId}?site_id=${siteId}`
  useEffect(() => {
    if (demo) return
    const controller = new AbortController()
    fetch(`${endpoint}&offset=${offset}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load procurement')
      if (!controller.signal.aborted) setData(result)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint, offset, reload, demo])

  async function toggle(enabled: boolean) {
    if (demo) return
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

  function refresh() { if (demo) return; setLoading(true); setError(''); setReload(value => value + 1) }
  const today = new Date().toISOString().slice(0, 10)
  return <div className="mx-auto max-w-[1000px] space-y-6">
    {demo && <ProcurementDemoNotice />}
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}
    <div role="toolbar" aria-label={t('procurement.portal.catalog.actions')} className="flex justify-end gap-1 border-b pb-3">
      <Button variant="ghost" size="icon" title={t('procurement.portal.catalog.createRequest')} aria-label={t('procurement.portal.catalog.createRequest')} asChild><Link href="/purchases/requests/new"><ClipboardList className="h-4 w-4" /></Link></Button>
      <Button variant="ghost" size="icon" title={t('procurement.portal.catalog.createTender')} aria-label={t('procurement.portal.catalog.createTender')} asChild><Link href="/purchases/tenders/new"><FileText className="h-4 w-4" /></Link></Button>
      <Button variant="ghost" size="icon" title={t('procurement.portal.catalog.manageSuppliers')} aria-label={t('procurement.portal.catalog.manageSuppliers')} asChild><Link href="/suppliers"><Users className="h-4 w-4" /></Link></Button>
      <Button variant="ghost" size="icon" title={t('procurement.portal.catalog.refresh')} aria-label={t('procurement.portal.catalog.refresh')} disabled={loading || saving} onClick={refresh}><RotateCw className="h-4 w-4" /></Button>
    </div>
    {loading && <ProcurementLoading compact />}{data && <>
      <SectionCard><SectionCardHeader><SectionCardTitle>{t('procurement.portal.catalog.capability')}</SectionCardTitle></SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="flex items-center gap-3"><Switch id="procurement-enabled" checked={data.item.procurement_enabled}
            disabled={!data.can_edit || data.item.status !== 'active' || saving || loading || !!error} onCheckedChange={toggle} />
            <Label htmlFor="procurement-enabled">{t('procurement.portal.catalog.enable')}</Label></div>
          <p className="text-sm text-muted-foreground">{t('procurement.portal.catalog.salesHint')}</p>
          <p className="text-sm text-muted-foreground">{t('procurement.portal.catalog.requestHint')}</p>
          <p className="text-sm text-muted-foreground">{t('procurement.portal.catalog.stockPrefix')} <Link className="underline" href="/inventory/minimums">{t('procurement.portal.catalog.stockLink')}</Link>{t('procurement.portal.catalog.stockSuffix')}</p>
        </SectionCardContent></SectionCard>
      <SectionCard><SectionCardHeader><SectionCardTitle>{t('procurement.portal.catalog.history')}</SectionCardTitle>{data.can_add_offer && data.item.procurement_enabled && data.item.status === 'active' && <OfferForm disabled={loading || !!error} siteId={siteId} endpoint={endpoint} onSaved={() => { setOffset(0); refresh() }} />}</SectionCardHeader>
        <SectionCardContent className="space-y-4">
          {!data.offers.length ? <EmptyCard icon={<ClipboardList size={24} />} title={t('procurement.portal.catalog.empty')}
            description="" showHint={false} showShadow={false} contentClassName="min-h-0 py-6" /> : <div className="overflow-auto"><Table className="w-full text-left text-sm">
            <TableHeader><TableRow><TableHead className="p-2">{t('procurement.portal.catalog.supplier')}</TableHead><TableHead>{t('procurement.portal.catalog.purchaseUnit')}</TableHead><TableHead>{t('procurement.portal.catalog.minimumLead')}</TableHead><TableHead>{t('procurement.portal.catalog.netPrice')}</TableHead><TableHead>{t('procurement.portal.catalog.validity')}</TableHead><TableHead>{t('procurement.portal.catalog.terms')}</TableHead></TableRow></TableHeader>
            <TableBody>{data.offers.map(offer => {
              const supplier = data.suppliers.find(row => row.id === offer.supplier_id)
              return <TableRow key={offer.id} className="border-t align-top"><TableCell className="p-2"><Link className="underline" href={`/suppliers/${offer.supplier_id}`}>{supplier?.name ?? t('procurement.portal.catalog.supplierUnavailable')}</Link><p>{valueLabel(supplier?.status)}</p></TableCell>
                <TableCell>{offer.purchase_unit}<p>{t('procurement.portal.catalog.units', { count: formatNumber(offer.units_per_purchase_unit) })}</p></TableCell><TableCell>{t('procurement.portal.catalog.purchaseUnits', { count: formatNumber(offer.minimum_quantity) })}<p>{t('procurement.portal.catalog.days', { count: formatNumber(offer.lead_time_days) })}</p></TableCell>
                <TableCell>{t('procurement.portal.catalog.minorUnits', { amount: formatNumber(offer.unit_price_minor), currency: offer.currency })}</TableCell><TableCell>{formatDate(offer.valid_from, { dateStyle: 'medium', timeZone: 'UTC' })} – {formatDate(offer.valid_until, { dateStyle: 'medium', timeZone: 'UTC' })}<p>{t(offer.valid_until < today ? 'procurement.portal.catalog.expired' : offer.valid_from > today ? 'procurement.portal.catalog.future' : 'procurement.portal.catalog.withinRange')}</p></TableCell><TableCell className="max-w-64 whitespace-pre-wrap">{offer.terms || '—'}</TableCell></TableRow>
            })}</TableBody></Table></div>}
          <div className="flex items-center gap-3"><Button variant="outline" disabled={offset === 0} onClick={() => { setLoading(true); setOffset(value => value - 50) }}>{t('procurement.portal.catalog.previousOffers')}</Button><span>{t('procurement.portal.catalog.offerCount', { count: formatNumber(data.total) })}</span>
            <Button variant="outline" disabled={offset + 50 >= data.total} onClick={() => { setLoading(true); setOffset(value => value + 50) }}>{t('procurement.portal.catalog.nextOffers')}</Button></div>
        </SectionCardContent></SectionCard>

    </>}
  </div>
}