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
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <Tabs
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val as "all" | "active" | "inactive")
                setPage(1)
              }}
              className="flex-shrink-0"
            >
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                <TabsTrigger value="all" className="text-xs rounded-full">{t("status.all") || "All"}</TabsTrigger>
                <TabsTrigger value="active" className="text-xs rounded-full">{t("status.active") || "Active"}</TabsTrigger>
                <TabsTrigger value="inactive" className="text-xs rounded-full">{t("status.inactive") || "Inactive"}</TabsTrigger>
              </TabsList>
            </Tabs>
            <SearchInput
              placeholder={t("priceLists.search") || "Search price lists..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              alwaysExpanded={false}
            />
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
            }}
          />
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
          onSuccess={() => mutate()}
        />
      )}
    </div>
  )
}
