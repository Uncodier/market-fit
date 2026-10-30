"use client"

import React, { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerOrdersView } from "@/app/buyer/components/BuyerOrdersView"
import { ProcurementListLoading } from '@/app/purchases/procurement/ui/list-loading'
import { ProcurementOrdersPanel } from "@/app/purchases/procurement/commerce/ProcurementOrdersPanel"
import { isProcurementDemo as isDemoSiteId } from '@/app/purchases/procurement/ui/is-demo'

export default function PurchasesOrdersPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDemo = currentSite ? isDemoSiteId(currentSite.id) : false
  const source = !isDemo && searchParams.get('source') === 'online' ? 'online' : 'procurement'

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesOrders') || 'Online purchases' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) return <ProcurementListLoading columns={6} />

  const navigation = !isDemo ? <Select value={source} onValueChange={value => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('source', value)
    router.push(`/purchases/orders?${params.toString()}`)
  }}>
    <SelectTrigger className="w-auto max-w-[220px] h-9"><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value="procurement">{t('procurement.partners.orders.tab') || 'Procurement orders'}</SelectItem>
      <SelectItem value="online">{t('layout.sidebar.purchasesOrders') || 'Online purchases'}</SelectItem>
    </SelectContent>
  </Select> : null

  return (
    <div className="flex-1 min-h-0 min-w-0 w-full p-0 bg-muted/30 h-[calc(100dvh-var(--topbar-height,64px))] flex flex-col overflow-hidden">
      {source === 'procurement' ? <ProcurementOrdersPanel siteId={currentSite.id} navigation={navigation} />
        : <BuyerOrdersView key={currentSite.id} scope="site" ownerSiteId={currentSite.id} basePath="/purchases" navigation={navigation} />}
    </div>
  )
}
