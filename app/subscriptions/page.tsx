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
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="gap-2 text-xs rounded-full">
                    {t("subscriptions.tabs.all") || "All"}
                  </TabsTrigger>
                  <TabsTrigger value="active" className="gap-2 text-xs rounded-full">
                    {t("subscriptions.tabs.active") || "Active"}
                  </TabsTrigger>
                  <TabsTrigger value="paused" className="gap-2 text-xs rounded-full">
                    {t("subscriptions.tabs.paused") || "Paused"}
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" className="gap-2 text-xs rounded-full">
                    {t("subscriptions.tabs.cancelled") || "Cancelled"}
                  </TabsTrigger>
                  <TabsTrigger value="expired" className="gap-2 text-xs rounded-full">
                    {t("subscriptions.tabs.expired") || "Expired"}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <SearchInput
                placeholder={t("subscriptions.search") || "Search subscriptions..."}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                alwaysExpanded={false}
              />
            </div>
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
            onUpdate={mutate}
          />
        )}
      </div>
      <CreateSubscriptionDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={mutate}
      />
    </div>
  )
}
