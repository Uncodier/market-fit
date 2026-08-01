"use client"

import React, { useState } from "react"
import useSWR from "swr"
import { listBuyerQuotes } from "../actions"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LayoutGrid, FileText, CheckCircle2, Send } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { useRouter } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  accepted: "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20",
  rejected: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  expired: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20",
}

export function BuyerQuotesView({
  scope = "personal",
  basePath = "/buyer"
}: {
  scope?: "personal" | "site"
  basePath?: string
}) {
  const { t } = useLocalization()
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const router = useRouter()

  const { data, error, isLoading, mutate } = useSWR(
    ['buyer-quotes', page, pageSize, searchQuery, statusFilter, scope],
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

  const HeaderWrapper = scope === 'site' ? StickyHeader : ({ children }: any) => (
    <div className="sticky top-[72px] z-30 bg-transparent h-[72px] flex items-center">
      {children}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col min-h-full">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full min-h-0">
        <HeaderWrapper>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 flex-1 overflow-x-auto no-scrollbar">
              <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <LayoutGrid size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.quotes.filters.all') || 'All'}</span>
                </TabsTrigger>
                <TabsTrigger value="sent" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <Send size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.quotes.filters.pendingReview') || 'Pending Review'}</span>
                </TabsTrigger>
                <TabsTrigger value="accepted" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={13} className="md:!hidden" />
                  <span className="tab-label">{t('buyer.quotes.filters.accepted') || 'Accepted'}</span>
                </TabsTrigger>
              </TabsList>

              <SearchInput
                placeholder={t('buyer.quotes.search') || "Search quotations..."} 
                value={searchQuery}
                onChange={handleSearchChange}
                className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                alwaysExpanded={false}
              />
            </div>
          </div>
        </HeaderWrapper>

        <div className={`flex-1 overflow-auto ${scope === 'personal' ? 'py-4 md:py-6' : 'p-4 md:p-6 lg:p-8'}`}>
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <div className="text-center text-red-500 p-4">{t('buyer.quotes.errorLoading') || 'Error loading quotations'}</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('buyer.quotes.table.date') || 'Date'}</TableHead>
                      <TableHead>{t('buyer.quotes.table.merchant') || 'Merchant'}</TableHead>
                      <TableHead>{t('buyer.quotes.table.status') || 'Status'}</TableHead>
                      <TableHead>{t('buyer.quotes.table.validUntil') || 'Valid Until'}</TableHead>
                      <TableHead className="text-right">{t('buyer.quotes.table.total') || 'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data && data.data.length > 0 ? (
                      data.data.map((quote: any) => (
                        <TableRow 
                          key={quote.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`${basePath}/quotes/${quote.id}`)}
                        >
                          <TableCell>
                            <div className="font-medium">
                              {format(new Date(quote.created_at), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>{quote.site?.name || t('buyer.quotes.table.unknown') || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_STYLES[quote.status?.toLowerCase()] || ""}>
                              {quote.status ? (t(`status.${quote.status.toLowerCase()}`) || quote.status) : (t('status.unknown') || 'Unknown')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {quote.valid_until ? (
                              <span className={new Date(quote.valid_until) < new Date() ? 'text-red-500 font-medium' : ''}>
                                {quote.valid_until && !isNaN(new Date(quote.valid_until).getTime()) ? format(new Date(quote.valid_until), 'MMM d, yyyy') : '-'}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: quote.currency || 'USD' }).format(quote.total)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <EmptyCard 
                            icon={<FileText size={24} className="text-muted-foreground" />}
                            title={t('buyer.quotes.empty.title') || 'No quotations'}
                            description={statusFilter !== 'all'
                              ? (t('buyer.quotes.empty.descFiltered') || "Try adjusting your filters to see more results.")
                              : (t('buyer.quotes.empty.descAll') || "You don't have any quotations from merchants.")
                            }
                            variant="fancy"
                            className="border-0 shadow-none bg-transparent"
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {data?.count !== undefined && data.count > pageSize && (
                  <div className="p-4 border-t">
                    <Pagination 
                      currentPage={page} 
                      totalPages={Math.ceil(data.count / pageSize)} 
                      onPageChange={setPage} 
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  )
}
