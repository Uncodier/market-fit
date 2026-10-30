"use client"

import React, { useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { BuyerLibraryView } from "@/app/buyer/components/BuyerLibraryView"
import LibraryLoading from './loading'

export default function PurchasesLibraryPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesLibrary') || 'Assets' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) return <LibraryLoading />

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <BuyerLibraryView scope="site" ownerSiteId={currentSite.id} />
    </div>
  )
}
