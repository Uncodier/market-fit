"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listQuotations } from "./actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { LayoutGrid, FileText, CheckCircle2, Ban, Send } from "@/app/components/ui/icons"
import { useRouter , useSearchParams} from "next/navigation"
import { QuotesTable, QuotesTableSkeleton } from "@/app/components/documents/quotes-table"
import { retryOnError, useOptimisticLoadState } from "@/app/hooks/use-optimistic-error"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { cn } from "@/lib/utils"

export default function QuotationsPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : 'newest'))
  const [sortBy, setSortBy] = useState(defaultSort)

  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const [data, setData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = async () => {
    if (!currentSite?.id) return
    setIsLoading(true)
    try {
      const res = await retryOnError(async () => {
        const result = await listQuotations({ siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter, sort: sortBy })
        if (result.error) throw new Error(result.error)
        return result
      })
      setData(res)
      setError(null)
    } catch (err: any) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }

  const { error: visibleError, isLoading: showLoading } = useOptimisticLoadState(isLoading, error)

  useEffect(() => {
    fetchData()
  }, [currentSite?.id, page, pageSize, searchQuery, statusFilter, sortBy])

  const mutate = () => {
    fetchData()
  }

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("quotations.list.breadcrumb") || "Quotations",
      },
    })
    window.dispatchEvent(event)
  }, [t])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  const rows = (data?.data || []).map((quote: any) => ({
    id: quote.id,
    entityName: quote.lead?.name || t("quotations.list.unknown") || "Unknown",
    entityEmail: quote.lead?.email || null,
    status: quote.status || "",
    validUntil: quote.valid_until || null,
    total: Number(quote.total) || 0,
    currency: quote.currency || "USD",
    createdAt: quote.created_at,
  }))

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
            <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
              <FilterContainer>
                <FilterSection mobileOnly>
                  <form onSubmit={handleSearch} className="w-full">
                    <SearchInput  placeholder={t("quotations.list.search") || "Search quotations..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </form>
                </FilterSection>

                

                <FilterSection title={t('common.status') || 'Estado'} className={cn(searchQuery && "max-md:hidden")}>
                  <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                    <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t("quotations.list.filters.all") || "All"}</span>
                    </TabsTrigger>
                    <TabsTrigger value="draft" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      <FileText size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t("quotations.list.filters.draft") || "Draft"}</span>
                    </TabsTrigger>
                    <TabsTrigger value="sent" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      <Send size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t("quotations.list.filters.sent") || "Sent"}</span>
                    </TabsTrigger>
                    <TabsTrigger value="accepted" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t("quotations.list.filters.accepted") || "Accepted"}</span>
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                      <Ban size={13} className="shrink-0 md:!hidden" />
                      <span className="tab-label">{t("quotations.list.filters.rejected") || "Rejected"}</span>
                    </TabsTrigger>
                  </TabsList>
                </FilterSection>

                <FilterSection desktopOnly>
                  <form onSubmit={handleSearch} className="w-auto">
                    <SearchInput  placeholder={t("quotations.list.search") || "Search quotations..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full"  containerClassName="w-full md:w-[240px]" />
                  </form>
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>
            <div className="flex items-center gap-2 w-auto justify-end shrink-0 ml-4">
              <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          {!currentSite || showLoading ? (
            <QuotesTableSkeleton />
          ) : visibleError ? (
            <div className="text-center text-red-500 p-4">
              {t("quotations.list.errorLoading") || "Error loading quotations"}
            </div>
          ) : (
            <QuotesTable
              rows={rows}
              page={page}
              pageSize={pageSize}
              totalCount={data?.count ?? 0}
              entityColumnLabel={t("quotations.list.table.client") || "Client"}
              emptyTitle={t("quotations.list.empty.title") || "No quotations found"}
              emptyDescription={
                searchQuery || statusFilter !== "all"
                  ? (t("quotations.list.empty.descFiltered") || "Try adjusting your filters to see more results.")
                  : (t("quotations.list.empty.descDefault") || "Create quotations from deals to send to your clients.")
              }
              onPageChange={setPage}
              onRowClick={(id) => router.push(`/quotations/${id}`)} />
          )}
        </div>
      </Tabs>
    </div>
  )
}
