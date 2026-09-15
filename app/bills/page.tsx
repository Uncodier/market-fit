"use client"

import React, { useEffect, useState } from "react"
import useSWR from "swr"
import { useRouter , useSearchParams} from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPurchases, deletePurchase } from "@/app/purchases/actions"
import { listLocations } from "@/app/inventory/actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection, FilterSeparator } from "@/app/components/ui/mobile-filters-drawer"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { FileText, LayoutGrid } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { CreatePurchaseDialog } from "./components/CreatePurchaseDialog"
import { BillsTable, BillsTableSkeleton } from "./components/BillsTable"
import { Purchase } from "@/app/types"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"

export default function BillsPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : 'newest'))
  const [sortBy, setSortBy] = useState(defaultSort)

  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [statusFilter, setStatusFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const { data: locationsData } = useSWR(
    currentSite?.id ? ['locations', currentSite.id] : null,
    () => listLocations(currentSite!.id)
  )
  const locations = locationsData?.data || []

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: t("layout.sidebar.bills") || "Bills" },
    })
    window.dispatchEvent(event)
  }, [t])

  useEffect(() => {
    const handleCreate = () => setIsDialogOpen(true)
    window.addEventListener("bills:create", handleCreate)
    return () => window.removeEventListener("bills:create", handleCreate)
  }, [])

  const fetcher = async (params: { siteId: string; page: number; pageSize: number; status: string; locationId: string; q: string; sort: string }) => {
    const res = await listPurchases(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id
      ? { siteId: currentSite.id, page, pageSize, status: statusFilter, locationId: locationFilter, q: searchQuery, sort: sortBy }
      : null,
    fetcher
  )

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  const handleDelete = async (id: string) => {
    if (!currentSite?.id) return
    if (!confirm(t("bills.confirmDelete") || "Delete this bill?")) return
    const res = await deletePurchase(currentSite.id, id)
    if (res.error) toast.error(res.error)
    else {
      toast.success(t("bills.success.deleted") || "Bill deleted")
      mutate()
    }
  }

  const rows = (data?.data || []) as Purchase[]

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between gap-2 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
              <FilterContainer>
                <FilterSection mobileOnly>
                  <form onSubmit={handleSearch} className="w-full">
                    <SearchInput  placeholder={t('bills.search') || "Search bills..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                  </form>
                </FilterSection>

                

                <FilterSection title={t('common.status') || 'Estado'}>
                  <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                    <TabsList className="h-auto md:h-8 p-0 md:p-0.5 bg-transparent md:bg-muted/30 rounded-none md:rounded-full flex flex-wrap md:flex-nowrap md:flex-row w-full md:max-w-full overflow-y-visible md:overflow-x-auto justify-start items-center gap-2 md:gap-0">
                      <TabsTrigger value="all" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                        <span className="tab-label">{t("bills.filters.all") || "All"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        <span className="tab-label">{t("bills.filters.pending") || "Pending"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        <span className="tab-label">{t("bills.filters.completed") || "Completed"}</span>
                      </TabsTrigger>
                      <TabsTrigger value="draft" className="w-auto justify-center rounded-full text-sm md:text-xs py-1.5 px-3 md:py-1 md:px-3 text-foreground/80 md:text-foreground border border-border/50 md:border-transparent data-[state=active]:bg-foreground data-[state=active]:text-background md:data-[state=active]:bg-background md:data-[state=active]:text-foreground data-[state=active]:shadow-sm md:data-[state=active]:border-transparent whitespace-nowrap flex items-center gap-1.5">
                        <span className="tab-label">{t("bills.filters.draft") || "Draft"}</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </FilterSection>

                {locations.length > 0 && (
                  <FilterSection title={t('common.location') || 'Location'}> 
                      <Select value={locationFilter}
                      onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                    >
                      <SelectTrigger className="w-full md:w-[160px] h-10 md:h-8 text-sm md:text-xs bg-background md:bg-muted/30 border md:border-0 rounded-md md:rounded-full">
                        <SelectValue placeholder={t('common.allLocations') || 'All Locations'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.allLocations') || 'All Locations'}</SelectItem>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FilterSection>
                )}

                <FilterSection desktopOnly>
                  <form onSubmit={handleSearch} className="w-full md:w-auto">
                    <SearchInput  placeholder={t('bills.search') || "Search bills..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}    className="w-full bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"  containerClassName="w-full md:w-[240px]" />
                  </form>
                </FilterSection>
              </FilterContainer>
            </MobileFiltersDrawer>

            <div className="flex items-center gap-2 w-auto justify-end shrink-0 ml-4">
              <SortDropdown sortBy={sortBy} setSortBy={setSortBy} />
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-6 py-4 space-y-4">
        {isLoading ? (
          <BillsTableSkeleton />
        ) : error ? (
          <div className="text-destructive text-sm">{(error as Error).message}</div>
        ) : rows.length === 0 ? (
          <EmptyCard
            icon={<FileText size={40} className="text-muted-foreground" />}
            title={t("bills.empty.title") || "No bills yet"}
            description={t("bills.empty.description") || "Create a vendor bill to track payables and receive inventory."} />
        ) : (
          <BillsTable
            rows={rows}
            page={page}
            pageSize={pageSize}
            totalCount={data?.count ?? 0}
            onPageChange={setPage}
            onOpen={(id) => router.push(`/bills/${id}`)}
            onDelete={handleDelete} />
        )}
      </div>

      <CreatePurchaseDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={(id) => {
          mutate()
          if (id) router.push(`/bills/${id}`)
        }} />
    </div>
  )
}
