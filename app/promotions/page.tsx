"use client"

import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
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
            <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                <div className="md:hidden w-full">
                  <form onSubmit={handleSearch} className="w-full">
                    <SearchInput  placeholder={t("promotions.search") || "Search name or code..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </form>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.status') || 'Estado'}</span>
                  <Tabs
                    value={statusFilter}
                    onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
                    className="w-full md:w-auto"
                  >
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">{t("promotions.tabs.all") || "All"}</TabsTrigger>
                      <TabsTrigger value="active" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">{t("promotions.tabs.active") || "Active"}</TabsTrigger>
                      <TabsTrigger value="draft" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">{t("promotions.tabs.draft") || "Draft"}</TabsTrigger>
                      <TabsTrigger value="paused" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">{t("promotions.tabs.paused") || "Paused"}</TabsTrigger>
                      <TabsTrigger value="expired" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent gap-2 whitespace-normal md:whitespace-nowrap">{t("promotions.tabs.expired") || "Expired"}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                
                <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                  <form onSubmit={handleSearch} className="w-auto">
                    <SearchInput  placeholder={t("promotions.search") || "Search name or code..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full"  containerClassName="w-64" />
                  </form>
                </div>
              </div>
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
