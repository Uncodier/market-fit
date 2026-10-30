"use client"

import { useEffect, useState } from "react"
import Link from 'next/link'
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoSupplierActivity } from '@/lib/demo-data/procurement-suppliers'
import { supplierResponse } from "./client"
import { SectionCard, SectionCardHeader, SectionCardContent } from "@/app/components/ui/section-card"
import { ProcurementState } from "@/app/purchases/procurement/ui/workspace"
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

type Activity = { version: number; action: string; previous_status: string | null; status: string; created_at: string }
export function SupplierActivity({ siteId, id, version }: { siteId: string; id: string; version: number }) {
  const { t, message, valueLabel, formatNumber, formatDate } = useProcurementI18n()
  const [activity, setActivity] = useState<Activity[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (isDemoSiteId(siteId)) {
      const timer = setTimeout(() => {
        setActivity(demoSupplierActivity(id)); setLoading(false); setError('');
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isDemoModeActive()) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError("")
      try {
        const response = await fetch(`/api/procurement/suppliers/${id}/activity?site_id=${siteId}`, { signal: controller.signal, cache: "no-store" })
        const data = await supplierResponse<{ activity: Activity[] }>(response)
        if (!controller.signal.aborted) setActivity(data.activity)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load activity")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, id, version])
  return <SectionCard className="min-w-0 overflow-visible rounded-none border-0 bg-transparent shadow-none">
    <SectionCardHeader className="px-0 pb-3 pt-0 [&_h3]:text-xs [&_h3]:font-medium [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground" title={t('procurement.partners.activity.title')} description={t('procurement.partners.activity.description')} />
    <SectionCardContent className="space-y-3 px-0 pb-0">
    {isDemoSiteId(siteId) && <nav aria-label="Related demo procurement" className="flex flex-wrap gap-4 text-sm underline">
      <Link href={`/purchases/tenders/${id === 'demo-supplier-cedar' ? 'demo-tender-awarded' : 'demo-tender-workplace'}`}>Workplace technology tender</Link>
      <Link href={`/purchases/quotes/demo-quote-${id.replace('demo-supplier-', '')}`}>Supplier quotation</Link>
      {id === 'demo-supplier-cedar' && <Link href="/purchases/orders/demo-order-workplace">Awarded purchase order</Link>}
    </nav>}
    <ProcurementState loading={loading} error={message(error)} empty={!loading && !error && !activity.length} emptyTitle={t('procurement.partners.activity.empty')} description={t('procurement.partners.activity.emptyHint')} compact />
    {!loading && !error && <ol className="space-y-2">{activity.map(event => <li key={event.version} className="border-b py-2 text-sm last:border-0">
      <span className="font-medium">{t('procurement.partners.activity.versionAction', { version: formatNumber(event.version), action: valueLabel(event.action) })}</span>
      <span className="ml-2 text-muted-foreground">{formatDate(event.created_at)}</span>
      <p>{event.previous_status && event.previous_status !== event.status ? `${valueLabel(event.previous_status)} → ` : ""}{valueLabel(event.status)}</p>
    </li>)}</ol>}
    <p className="text-xs text-muted-foreground">{t('procurement.partners.activity.auditHint')}</p>
    </SectionCardContent>
  </SectionCard>
}