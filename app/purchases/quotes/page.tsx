"use client"

import React, { useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerQuotesView } from "@/app/buyer/components/BuyerQuotesView"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { FileText } from "@/app/components/ui/icons"

export default function PurchasesQuotesPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesQuotes') || 'Quotations' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyCard 
          icon={<FileText size={40} className="text-muted-foreground" />}
          title="Select a project"
          description="Please select a project to view its quotations."
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <BuyerQuotesView scope="site" basePath="/purchases" />
    </div>
  )
}
