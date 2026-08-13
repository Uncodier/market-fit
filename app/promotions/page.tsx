"use client"

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
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <Tabs
                value={statusFilter}
                onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
                className="hidden lg:block"
              >
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full">{t("promotions.tabs.all") || "All"}</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs font-medium rounded-full">{t("promotions.tabs.active") || "Active"}</TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs font-medium rounded-full">{t("promotions.tabs.draft") || "Draft"}</TabsTrigger>
                  <TabsTrigger value="paused" className="text-xs font-medium rounded-full">{t("promotions.tabs.paused") || "Paused"}</TabsTrigger>
                  <TabsTrigger value="expired" className="text-xs font-medium rounded-full">{t("promotions.tabs.expired") || "Expired"}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <form onSubmit={handleSearch} className="w-full md:w-auto">
              <SearchInput
                placeholder={t("promotions.search") || "Search name or code..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                alwaysExpanded={false}
              />
            </form>
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
            onCreate={() => setIsCreateOpen(true)}
          />
        )}
      </div>

      {isCreateOpen && (
        <CreatePromotionDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  )
}
