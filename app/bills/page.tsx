"use client"

import React, { useEffect, useState } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPurchases, deletePurchase } from "@/app/purchases/actions"
import { listLocations } from "@/app/inventory/actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { FileText, LayoutGrid } from "@/app/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { CreatePurchaseDialog } from "./components/CreatePurchaseDialog"
import { BillsTable, BillsTableSkeleton } from "./components/BillsTable"
import { Purchase } from "@/app/types"

export default function BillsPage() {
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

  const fetcher = async (params: { siteId: string; page: number; pageSize: number; status: string; locationId: string; q: string }) => {
    const res = await listPurchases(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id
      ? { siteId: currentSite.id, page, pageSize, status: statusFilter, locationId: locationFilter, q: searchQuery }
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
            <div className="flex items-center space-x-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-1 md:pb-0 flex-1 min-w-0 gap-2">
              <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t("bills.filters.all") || "All"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <span className="tab-label">{t("bills.filters.pending") || "Pending"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <span className="tab-label">{t("bills.filters.completed") || "Completed"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <span className="tab-label">{t("bills.filters.draft") || "Draft"}</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {locations.length > 0 && (
                <Select
                  value={locationFilter}
                  onValueChange={(val) => { setLocationFilter(val); setPage(1); }}
                >
                  <SelectTrigger className="w-[160px] h-8 text-xs bg-muted/30 border-0 rounded-full">
                    <SelectValue placeholder={t('allLocations') || 'All Locations'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allLocations') || 'All Locations'}</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="flex items-center gap-2">
                <form onSubmit={handleSearch}>
                  <SearchInput 
                    placeholder={t('bills.search') || "Search bills..."} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                    alwaysExpanded={false}
                  />
                </form>
              </div>
            </div>

            <div className="flex items-center gap-2 w-auto justify-end shrink-0">
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
            description={t("bills.empty.description") || "Create a vendor bill to track payables and receive inventory."}
          />
        ) : (
          <BillsTable
            rows={rows}
            page={page}
            pageSize={pageSize}
            totalCount={data?.count ?? 0}
            onPageChange={setPage}
            onOpen={(id) => router.push(`/bills/${id}`)}
            onDelete={handleDelete}
          />
        )}
      </div>

      <CreatePurchaseDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={(id) => {
          mutate()
          if (id) router.push(`/bills/${id}`)
        }}
      />
    </div>
  )
}
