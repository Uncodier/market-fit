"use client"

import React, { useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ProcurementListLoading } from '@/app/purchases/procurement/ui/list-loading'
import { ProcurementQuotesPanel } from "@/app/purchases/procurement/commerce/ProcurementQuotesPanel"

export default function PurchasesQuotesPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesQuotes') || 'Quotations' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) return <ProcurementListLoading columns={5} />

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <ProcurementQuotesPanel siteId={currentSite.id} />
    </div>
  )
}
