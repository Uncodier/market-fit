"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPriceLists } from "./actions"
import { PriceListParams } from "./types"
import { PriceList } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { PriceListDialog } from "./components/PriceListDialog"
import { PriceListsTable, PriceListsTableSkeleton } from "./components/PriceListsTable"

export default function PriceListsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [page, setPage] = useState(1)
  const pageSize = 50
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingList, setEditingList] = useState<PriceList | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  const fetcher = async (params: PriceListParams) => {
    const res = await listPriceLists(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize } : null,
    fetcher
  )

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: t("layout.sidebar.priceLists") || "Price Lists" },
    })
    window.dispatchEvent(event)
  }, [t])

  useEffect(() => {
    const handleCreate = () => {
      setEditingList(null)
      setIsCreateOpen(true)
    }
    window.addEventListener("price-lists:create", handleCreate)
    return () => window.removeEventListener("price-lists:create", handleCreate)
  }, [])

  const filteredLists =
    data?.data?.filter((list) => {
      if (statusFilter === "active" && !list.is_active) return false
      if (statusFilter === "inactive" && list.is_active) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!list.name?.toLowerCase().includes(q) && !list.code?.toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    }) || []

  const openEdit = (list: PriceList) => {
    setEditingList(list)
    setIsCreateOpen(true)
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Buscar"}>
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0">
                <div className="md:hidden w-full">
                  <SearchInput  placeholder={t("priceLists.search") || "Search price lists..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  <span className="text-xs font-semibold text-muted-foreground md:hidden mb-1 uppercase">{t('common.status') || 'Estado'}</span>
                  <Tabs
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val as "all" | "active" | "inactive")
                      setPage(1)
                    }}
                    className="flex-shrink-0 w-full md:w-auto"
                  >
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-lg md:rounded-full flex flex-col md:flex-row w-full md:max-w-full overflow-y-auto md:overflow-x-auto justify-start items-stretch md:items-center gap-1 md:gap-0">
                      <TabsTrigger value="all" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap">{t("status.all") || "All"}</TabsTrigger>
                      <TabsTrigger value="active" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap">{t("status.active") || "Active"}</TabsTrigger>
                      <TabsTrigger value="inactive" className="w-full md:w-auto justify-start md:justify-center rounded-md md:rounded-full text-sm md:text-xs py-2 px-3 md:py-1 md:px-3 text-left text-foreground/80 md:text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/5 md:data-[state=active]:border-transparent whitespace-normal md:whitespace-nowrap">{t("status.inactive") || "Inactive"}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="hidden md:flex items-center gap-2 w-full md:w-auto">
                  <SearchInput  placeholder={t("priceLists.search") || "Search price lists..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full"  containerClassName="w-64" />
                </div>
              </div>
            </MobileFiltersDrawer>
            
            <div className="flex items-center gap-2 w-auto justify-end shrink-0">
              {/* Optional elements that go on the right side if there are any */}
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {isLoading ? (
          <PriceListsTableSkeleton />
        ) : error ? (
          <div className="p-6 text-center text-red-500">
            Failed to load price lists. {error.message}
          </div>
        ) : (
          <PriceListsTable
            lists={filteredLists}
            page={page}
            pageSize={pageSize}
            totalCount={data?.count ?? 0}
            onPageChange={setPage}
            onOpen={(id) => router.push(`/price-lists/${id}`)}
            onEdit={openEdit}
            onCreate={() => {
              setEditingList(null)
              setIsCreateOpen(true)
            }} />
        )}
      </div>

      {isCreateOpen && (
        <PriceListDialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open)
            if (!open) setEditingList(null)
          }}
          list={editingList}
          onSuccess={() => mutate()} />
      )}
    </div>
  )
}
