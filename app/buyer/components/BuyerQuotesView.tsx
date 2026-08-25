"use client"

import React, { useState } from "react"
import useSWR from "swr"
import { listBuyerQuotes } from "../actions"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { LayoutGrid, CheckCircle2, Send } from "@/app/components/ui/icons"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { QuotesTable, QuotesTableSkeleton } from "@/app/components/documents/quotes-table"

export function BuyerQuotesView({
  scope = "personal",
  basePath = "/buyer",
}: {
  scope?: "personal" | "site"
  basePath?: string
}) {
  const { t } = useLocalization()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const router = useRouter()

  const { data, error, isLoading } = useSWR(
    ["buyer-quotes", page, pageSize, searchQuery, statusFilter, scope],
    async () => {
      const res = await listBuyerQuotes({ page, pageSize, q: searchQuery, status: statusFilter, scope })
      if (res.error) throw new Error(res.error)
      return res
    }
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const HeaderWrapper = scope === "site" ? StickyHeader : ({ children }: any) => (
    <div className="sticky top-[72px] z-30 bg-transparent h-[72px] flex items-center">
      {children}
    </div>
  )

  const rows = (data?.data || []).map((quote: any) => ({
    id: quote.id,
    entityName: quote.site?.name || t("buyer.quotes.table.unknown") || "Unknown",
    status: quote.status || "",
    validUntil: quote.valid_until || null,
    total: Number(quote.total) || 0,
    currency: quote.currency || "USD",
    createdAt: quote.created_at,
  }))

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <LayoutGrid size={13} className="shrink-0 md:!hidden" />
                  <span className="tab-label">{t("buyer.quotes.filters.all") || "All"}</span>
                </TabsTrigger>
                <TabsTrigger value="sent" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <Send size={13} className="shrink-0 md:!hidden" />
                  <span className="tab-label">{t("buyer.quotes.filters.pendingReview") || "Pending Review"}</span>
                </TabsTrigger>
                <TabsTrigger value="accepted" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} className="shrink-0 md:!hidden" />
                  <span className="tab-label">{t("buyer.quotes.filters.accepted") || "Accepted"}</span>
                </TabsTrigger>
              </TabsList>

              <SearchInput
                placeholder={t("buyer.quotes.search") || "Search quotations..."}
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                alwaysExpanded={false}
              />
            </div>
          </div>
        </HeaderWrapper>

        <div className={`flex-1 overflow-auto ${scope === "personal" ? "py-4 md:py-6" : "p-4 md:p-6 lg:p-8"}`}>
          {isLoading ? (
            <QuotesTableSkeleton />
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              {t("buyer.quotes.errorLoading") || "Error loading quotations"}
            </div>
          ) : (
            <QuotesTable
              rows={rows}
              page={page}
              pageSize={pageSize}
              totalCount={data?.count ?? 0}
              entityColumnLabel={t("buyer.quotes.table.merchant") || "Merchant"}
              emptyTitle={t("buyer.quotes.empty.title") || "No quotations"}
              emptyDescription={
                statusFilter !== "all"
                  ? (t("buyer.quotes.empty.descFiltered") || "Try adjusting your filters to see more results.")
                  : (t("buyer.quotes.empty.descAll") || "You don't have any quotations from merchants.")
              }
              onPageChange={setPage}
              onRowClick={(id) => router.push(`${basePath}/quotes/${id}`)}
            />
          )}
        </div>
      </Tabs>
    </div>
  )
}
