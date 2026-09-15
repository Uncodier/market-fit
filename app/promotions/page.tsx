"use client"

import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useRouter, useSearchParams } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPromotions } from "./actions"
import { PromotionParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { CreatePromotionDialog } from "./components/CreatePromotionDialog"
import { PromotionsTable, PromotionsTableSkeleton } from "./components/PromotionsTable"

export default function PromotionsPage() {
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
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const fetcher = async (params: PromotionParams) => {
    const res = await listPromotions(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter } : null,
    fetcher
  )

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: t("layout.sidebar.promotions") || "Promotions" },
    })
    window.dispatchEvent(event)
  }, [t])

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener("promotions:create", handleCreate)
    return () => window.removeEventListener("promotions:create", handleCreate)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
              <FilterContainer>
                <FilterSection mobileOnly>
                  <form onSubmit={handleSearch} className="w-full">
                    <SearchInput placeholder={t("promotions.search") || "Search name or code..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true} className="w-full h-10 md:h-9" containerClassName="w-full" />
                  </form>
                </FilterSection>

                

                <FilterSection title={t('common.status') || 'Estado'}>
                  <Tabs
                    value={statusFilter}
                    onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
                    className="w-full md:w-auto"
                  >
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                      <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">{t("promotions.tabs.all") || "All"}</TabsTrigger>
                      <TabsTrigger value="active" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">{t("promotions.tabs.active") || "Active"}</TabsTrigger>
                      <TabsTrigger value="draft" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">{t("promotions.tabs.draft") || "Draft"}</TabsTrigger>
                      <TabsTrigger value="paused" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">{t("promotions.tabs.paused") || "Paused"}</TabsTrigger>
                      <TabsTrigger value="expired" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">{t("promotions.tabs.expired") || "Expired"}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FilterSection>
                
                <FilterSection desktopOnly className="flex-row items-center gap-2">
                  <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
                  <form onSubmit={handleSearch} className="w-auto">
                    <SearchInput placeholder={t("promotions.search") || "Search name or code..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full" containerClassName="w-64" />
                  </form>
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {!currentSite || isLoading ? (
          <PromotionsTableSkeleton />
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            Failed to load promotions. {error.message}
          </div>
        ) : (
          <PromotionsTable
            promotions={data?.data || []}
            page={page}
            pageSize={pageSize}
            totalCount={data?.count ?? 0}
            onPageChange={setPage}
            onOpen={(id) => router.push(`/promotions/${id}`)}
            onCreate={() => setIsCreateOpen(true)} />
        )}
      </div>

      {isCreateOpen && (
        <CreatePromotionDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => mutate()} />
      )}
    </div>
  )
}
