"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { cn } from "@/lib/utils"
import { getAccountsReceivable } from "./actions"
import { AccountsReceivableList } from "./components/AccountsReceivableList"
import { SubscriptionsListSkeleton } from "@/app/subscriptions/components/SubscriptionsList"
import { filterReceivables, localToday, type ReceivableFilter, type ReceivableSort } from "./summary"

const FILTERS: { value: ReceivableFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "current", label: "Not overdue" },
  { value: "no_due_date", label: "No due date" },
  { value: "cancelled_orders", label: "Cancelled orders" },
]

export default function AccountsReceivablePage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams?.get("sort")
  const [sortBy, setSortBy] = useState<ReceivableSort>(urlSort === "updated_at" ? "updated_at" : urlSort === "oldest" ? "oldest" : "newest")
  const { currentSite } = useSite()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ReceivableFilter>("all")
  const [today, setToday] = useState(localToday)
  const siteId = currentSite?.id
  const orderFilter = statusFilter === "cancelled_orders" ? "cancelled" : "active"
  const { data, error, isLoading, mutate } = useSWR(
    siteId ? ["accounts-receivable", siteId, orderFilter] : null,
    () => getAccountsReceivable(siteId!, orderFilter),
    { keepPreviousData: false },
  )

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("breadcrumb:update", {
      detail: { title: "Accounts Receivable", parent: null },
    }))
  }, [])

  useEffect(() => {
    const refresh = () => setToday(localToday())
    const paymentRecorded = (event: Event) => {
      if ((event as CustomEvent<{ siteId: string }>).detail?.siteId === siteId) void mutate()
    }
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener("focus", refresh)
    window.addEventListener("lead:invoice-payment-recorded", paymentRecorded)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
      window.removeEventListener("lead:invoice-payment-recorded", paymentRecorded)
    }
  }, [siteId, mutate])

  const accounts = useMemo(() => filterReceivables(data?.data || [], statusFilter, searchQuery, sortBy, today),
    [data?.data, statusFilter, searchQuery, sortBy, today])
  const loadError = data?.error || (error ? "Unable to load accounts receivable. Check your connection and retry." : null)

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex items-center justify-between">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText="Search">
              <FilterContainer>
                <FilterSection mobileOnly>
                  <SearchInput placeholder="Search accounts receivable..." value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)} alwaysExpanded
                    className="w-full h-10 md:h-9" containerClassName="w-full" />
                </FilterSection>
                <FilterSection title="Status" className={cn(searchQuery && "max-md:hidden")}>
                  <Tabs value={statusFilter} onValueChange={value => setStatusFilter(value as ReceivableFilter)}>
                    <TabsList aria-label="Accounts receivable status" className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                      {FILTERS.map(filter => (
                        <TabsTrigger key={filter.value} value={filter.value} className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                          {filter.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </FilterSection>
                <FilterSection className={cn("hidden md:flex items-center gap-2", searchQuery && "max-md:hidden")}>
                  <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
                </FilterSection>
                <FilterSection desktopOnly>
                  <SearchInput placeholder="Search accounts receivable..." value={searchQuery}
                    onChange={event => setSearchQuery(event.target.value)} className="w-full" containerClassName="w-64" />
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>
          </div>
        </div>
      </StickyHeader>
      <div className="p-4 md:p-6 lg:p-8 flex-1 overflow-auto">
        {!currentSite || isLoading ? <SubscriptionsListSkeleton /> : loadError ? (
          <div role="alert" className="rounded-lg border p-6 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" className="mt-3" onClick={() => void mutate()}>Retry</Button>
          </div>
        ) : (
          <AccountsReceivableList key={currentSite.id} accounts={accounts} siteId={currentSite.id} today={today} />
        )}
      </div>
    </div>
  )
}