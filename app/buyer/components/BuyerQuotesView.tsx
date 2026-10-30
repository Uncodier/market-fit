"use client"

import React, { useState } from "react"
import useSWR from "swr"
import { listBuyerQuotes } from "../actions"
import { AccountSearch, AccountSubheader } from "./AccountSearch"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { LayoutGrid, CheckCircle2, Send } from "@/app/components/ui/icons"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { QuotesTable } from "@/app/components/documents/quotes-table"
import { BuyerListContentSkeleton } from "./BuyerListSkeleton"
import { demoAccountQuotes, filterDemoAccountRows, demoAccountDetailPath } from '@/app/home/demo-commerce'

export function BuyerQuotesView({
  scope = "personal",
  basePath = "/buyer",
  demo = false,
}: {
  scope?: "personal" | "site"
  basePath?: string
  demo?: boolean
}) {
  const { t } = useLocalization()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const router = useRouter()

  const live = useSWR(
    demo ? null : ["buyer-quotes", page, pageSize, searchQuery, statusFilter, scope],
    async () => {
      const res = await listBuyerQuotes({ page, pageSize, status: statusFilter, scope })
      if (res.error) throw new Error(res.error)
      return res
    }
  )
  const data = demo ? filterDemoAccountRows(demoAccountQuotes, { q: searchQuery, status: statusFilter, page, pageSize }) : live.data
  const error = !demo && live.error
  const isLoading = !demo && live.isLoading

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }
  const rows = (data?.data || []).filter((quote: { id: string; site?: { name?: string }; status?: string }) =>
    `${quote.id} ${quote.site?.name ?? ''} ${quote.status ?? ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).map((quote: any) => ({
    id: quote.id,
    entityName: quote.site?.name || t("buyer.quotes.table.unknown") || "Unknown",
    status: quote.status || "",
    validUntil: quote.valid_until || null,
    total: quote.total == null ? null : Number(quote.total),
    currency: quote.currency || "USD",
    createdAt: quote.created_at,
  }))

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <AccountSubheader scope={scope}>
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

              <AccountSearch
                placeholder={t("buyer.quotes.search") || "Search quotations..."}
                value={searchQuery}
                onChange={handleSearchChange}
                scope={scope}
              />
            </div>
          </div>
        </AccountSubheader>

        <div className={`flex-1 overflow-auto ${scope === "personal" ? "py-4 md:py-6" : "p-4 md:p-6 lg:p-8"}`}>
          {isLoading ? (
            <BuyerListContentSkeleton kind="quotes" />
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
              onRowClick={(id) => router.push(demo ? demoAccountDetailPath('quotes', id) : `${basePath}/quotes/${id}`)}
            />
          )}
        </div>
      </Tabs>
    </div>
  )
}
