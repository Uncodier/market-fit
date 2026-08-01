"use client"

import React, { useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerOrdersView } from "@/app/buyer/components/BuyerOrdersView"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ShoppingCart } from "@/app/components/ui/icons"

export default function PurchasesOrdersPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesOrders') || 'Purchases' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyCard 
          icon={<ShoppingCart size={40} className="text-muted-foreground" />}
          title="Select a project"
          description="Please select a project to view its purchases."
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <BuyerOrdersView scope="site" ownerSiteId={currentSite.id} basePath="/purchases" />
    </div>
  )
}
