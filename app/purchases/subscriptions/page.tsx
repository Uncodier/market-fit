"use client"

import React, { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useSearchParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listBuyerSubscriptions } from "@/app/buyer/actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { Pagination } from "@/app/components/ui/pagination"
import { PurchasedSubscriptionsList, PurchasedSubscriptionsListSkeleton } from "./PurchasedSubscriptionsList"
import type { PurchasedSubscription } from "./types"
import SubscriptionsLoading from './loading'
import { isProcurementDemo } from '@/app/purchases/procurement/ui/is-demo'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { getDemoSiteId } from '@/lib/demo-utils'
import { demoPurchasedSubscriptions } from '@/lib/demo-data/purchased-subscriptions'

export default function PurchasesSubscriptionsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const isDemo = isProcurementDemo(currentSite?.id)
  const demoSiteId = getDemoSiteId() || currentSite?.id || ''
  const searchParams = useSearchParams()
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [sort, setSort] = useState(searchParams.get("sort") === "oldest" ? "oldest" : searchParams.get("sort") === "updated_at" ? "updated_at" : "newest")
  const [page, setPage] = useState(1)
  const pageSize = 50
  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id && !isDemo ? ["purchased-subscriptions", currentSite.id] : null,
    async () => {
      // Load the authorized site's complete list so search and sorting span every page.
      const subscriptions: PurchasedSubscription[] = []
      let batch = 1
      let count = 0
      do {
        const result = await listBuyerSubscriptions({ scope: "site", ownerSiteId: currentSite!.id, page: batch, pageSize: 200 })
        if (result.error) throw new Error(result.error)
        const rows = (result.data || []) as PurchasedSubscription[]
        subscriptions.push(...rows)
        count = result.count || 0
        if (!rows.length) break
        batch += 1
      } while (subscriptions.length < count)
      return subscriptions
    }
  )
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (isDemo ? demoPurchasedSubscriptions(demoSiteId) : data || []).filter((sub) => (status === "all" || sub.status === status) &&
      (!query || [sub.site?.name, sub.catalog_item?.name].filter(Boolean).join(" ").toLowerCase().includes(query)))
      .sort((a, b) => {
        const aDate = new Date((sort === "updated_at" ? a.updated_at : null) || a.created_at).getTime() || 0
        const bDate = new Date((sort === "updated_at" ? b.updated_at : null) || b.created_at).getTime() || 0
        return sort === "oldest" ? aDate - bDate : bDate - aDate
      })
  }, [data, search, status, sort, isDemo, demoSiteId])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)

  function changeSearch(value: string) { setSearch(value); setPage(1) }
  function changeStatus(value: string) { setStatus(value); setPage(1) }
  function changeSort(value: string) { setSort(value); setPage(1) }

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: { title: t('layout.sidebar.purchasesSubscriptions') || 'Subscriptions' }
    });
    window.dispatchEvent(event);
  }, [t]);

  if (!currentSite) return <SubscriptionsLoading />

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      {isDemo && <ProcurementDemoNotice />}
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <MobileFiltersDrawer triggerText={t("common.search") || "Search"}>
            <FilterContainer>
              <FilterSection mobileOnly>
                <SearchInput placeholder={t("subscriptions.search") || "Search subscriptions..."} value={search} onChange={(event) => changeSearch(event.target.value)} alwaysExpanded className="w-full h-10 md:h-9" containerClassName="w-full" />
              </FilterSection>
              <FilterSection title={t("common.status") || "Status"}>
                <Tabs value={status} onValueChange={changeStatus}>
                  <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap w-full overflow-y-visible md:overflow-x-auto justify-start gap-2 md:gap-0">
                    {["all", "active", "paused", "cancelled", "expired"].map((value) => (
                      <TabsTrigger key={value} value={value} className="w-auto rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm whitespace-nowrap">
                        {t(`subscriptions.tabs.${value}`) || value.charAt(0).toUpperCase() + value.slice(1)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </FilterSection>
              <FilterSection><SortDropdown sortBy={sort} setSortBy={changeSort} /></FilterSection>
              <FilterSection desktopOnly>
                <SearchInput placeholder={t("subscriptions.search") || "Search subscriptions..."} value={search} onChange={(event) => changeSearch(event.target.value)} className="w-full" containerClassName="w-64" />
              </FilterSection>
            </FilterContainer>
          </MobileFiltersDrawer>
        </div>
      </StickyHeader>
      <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-auto">
        {isLoading ? <PurchasedSubscriptionsListSkeleton /> : error ? (
          <div role="alert" className="rounded-lg border p-6 text-center">
            <p className="text-sm text-destructive">{t("buyer.subscriptions.errorLoading") || "Error loading subscriptions"}</p>
            <Button variant="outline" className="mt-3" onClick={() => void mutate()}>Retry</Button>
          </div>
        ) : <PurchasedSubscriptionsList key={currentSite.id} demo={isDemo} subscriptions={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)} onUpdate={mutate} />}
        {!error && totalPages > 1 && <div className="pt-6"><Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} /></div>}
      </div>
    </div>
  )
}
