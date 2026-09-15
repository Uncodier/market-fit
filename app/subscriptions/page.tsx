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
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { useSearchParams } from "next/navigation"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { cn } from "@/lib/utils"

export default function SubscriptionsPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : 'newest'))
  const [sortBy, setSortBy] = useState(defaultSort)

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
    }).sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      const updateA = new Date(a.updated_at || a.updatedAt || a.created_at || a.createdAt || 0).getTime();
      const updateB = new Date(b.updated_at || b.updatedAt || b.created_at || b.createdAt || 0).getTime();
      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'updated_at') return updateB - updateA;
      return 0;
    })
  }, [subscriptions, statusFilter, searchQuery, sortBy])

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
              <FilterContainer>
                <FilterSection mobileOnly>
                  <SearchInput  placeholder={t("subscriptions.search") || "Search subscriptions..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                </FilterSection>

                

                <FilterSection title={t('common.status') || 'Estado'} className={cn(searchQuery && "max-md:hidden")}>
                  <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                      <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        {t("subscriptions.tabs.all") || "All"}
                      </TabsTrigger>
                      <TabsTrigger value="active" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        {t("subscriptions.tabs.active") || "Active"}
                      </TabsTrigger>
                      <TabsTrigger value="paused" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        {t("subscriptions.tabs.paused") || "Paused"}
                      </TabsTrigger>
                      <TabsTrigger value="cancelled" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        {t("subscriptions.tabs.cancelled") || "Cancelled"}
                      </TabsTrigger>
                      <TabsTrigger value="expired" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        {t("subscriptions.tabs.expired") || "Expired"}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FilterSection>
                    
                    <FilterSection className={cn("hidden md:flex items-center gap-2", searchQuery && "max-md:hidden")}>
                  <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
                </FilterSection>

                <FilterSection desktopOnly>
                  <SearchInput  placeholder={t("subscriptions.search") || "Search subscriptions..."} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}    className="w-full"  containerClassName="w-64" />
                </FilterSection>
              </FilterContainer>
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
