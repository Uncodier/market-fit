"use client"

import React, { useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerSubscriptionsView } from "@/app/buyer/components/BuyerSubscriptionsView"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Repeat } from "@/app/components/ui/icons"

export default function PurchasesSubscriptionsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesSubscriptions') || 'Subscriptions' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyCard 
          icon={<Repeat size={40} className="text-muted-foreground" />}
          title="Select a project"
          description="Please select a project to view its subscriptions."
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <BuyerSubscriptionsView scope="site" ownerSiteId={currentSite.id} />
    </div>
  )
}
