"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listQuotations } from "./actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { LayoutGrid, FileText, CheckCircle2, Ban, Send } from "@/app/components/ui/icons"
import { useRouter } from "next/navigation"
import { QuotesTable, QuotesTableSkeleton } from "@/app/components/documents/quotes-table"

export default function QuotationsPage() {
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
      const res = await listQuotations({ siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter })
      if (res.error) throw new Error(res.error)
      setData(res)
      setError(null)
    } catch (err: any) {
      setError(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentSite?.id, page, pageSize, searchQuery, statusFilter])

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
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center space-x-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-1 md:pb-0 flex-1 min-w-0 gap-2">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t("quotations.list.filters.all") || "All"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <FileText size={13} className="md:!hidden" />
                    <span className="tab-label">{t("quotations.list.filters.draft") || "Draft"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Send size={13} className="md:!hidden" />
                    <span className="tab-label">{t("quotations.list.filters.sent") || "Sent"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="accepted" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="md:!hidden" />
                    <span className="tab-label">{t("quotations.list.filters.accepted") || "Accepted"}</span>
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Ban size={13} className="md:!hidden" />
                    <span className="tab-label">{t("quotations.list.filters.rejected") || "Rejected"}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex items-center gap-2 w-auto justify-end shrink-0">
                <form onSubmit={handleSearch} className="w-auto">
                  <SearchInput
                    placeholder={t("quotations.list.search") || "Search quotations..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full md:w-[240px]"
                  />
                </form>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          {!currentSite || isLoading ? (
            <QuotesTableSkeleton />
          ) : error ? (
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
              onRowClick={(id) => router.push(`/quotations/${id}`)}
            />
          )}
        </div>
      </Tabs>
    </div>
  )
}
