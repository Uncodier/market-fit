"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import useSWR from "swr"
import { getSubscriptions } from "./actions"
import { SubscriptionsList, SubscriptionsListSkeleton } from "./components/SubscriptionsList"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { CreateSubscriptionDialog } from "./components/CreateSubscriptionDialog"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"

export default function SubscriptionsPage() {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "cancelled" | "expired">("all")

  const { data, isLoading, mutate } = useSWR(
    currentSite?.id ? ["subscriptions", currentSite.id] : null,
    () => getSubscriptions(currentSite!.id)
  )

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener("subscriptions:create", handleCreate)

    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("layout.sidebar.subscriptions") || "Subscriptions",
        parent: null,
      },
    })
    window.dispatchEvent(event)

    return () => window.removeEventListener("subscriptions:create", handleCreate)
  }, [t])

  const subscriptions = data?.data || []
  const filteredSubscriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return subscriptions.filter((sub) => {
      if (statusFilter !== "all" && sub.status !== statusFilter) return false
      if (!query) return true
      const haystack = [
        sub.lead?.name,
        sub.lead?.email,
        sub.catalog_item?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [subscriptions, statusFilter, searchQuery])

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                <div className="md:hidden w-full">
                  <SearchInput  placeholder={t("subscriptions.search") || "Search subscriptions..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.status') || 'Estado'}</span>
                  <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        {t("subscriptions.tabs.all") || "All"}
                      </TabsTrigger>
                      <TabsTrigger value="active" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        {t("subscriptions.tabs.active") || "Active"}
                      </TabsTrigger>
                      <TabsTrigger value="paused" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        {t("subscriptions.tabs.paused") || "Paused"}
                      </TabsTrigger>
                      <TabsTrigger value="cancelled" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        {t("subscriptions.tabs.cancelled") || "Cancelled"}
                      </TabsTrigger>
                      <TabsTrigger value="expired" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">
                        {t("subscriptions.tabs.expired") || "Expired"}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                  <SearchInput  placeholder={t("subscriptions.search") || "Search subscriptions..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}    className="w-full"  containerClassName="w-64" />
                </div>
              </div>
            </MobileFiltersDrawer>
          </div>
        </div>
      </StickyHeader>

      <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-auto">
        {!currentSite || isLoading ? (
          <SubscriptionsListSkeleton />
        ) : (
          <SubscriptionsList
            subscriptions={filteredSubscriptions}
            siteId={currentSite.id}
            onUpdate={mutate} />
        )}
      </div>
      <CreateSubscriptionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={mutate} />
    </div>
  )
}
