"use client"

import React, { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listQuotations } from "./actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { LayoutGrid, FileText, CheckCircle2, Ban, Clock, Send } from "@/app/components/ui/icons"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-50 text-gray-700 border-gray-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-orange-50 text-orange-700 border-orange-200",
}

export default function QuotationsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')

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
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('quotations.list.breadcrumb') || 'Quotations'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <Tabs value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }} className="flex-1 flex flex-col w-full h-full min-h-0">
        <StickyHeader>
          <div className="w-full pt-0">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                  <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <LayoutGrid size={13} className="md:!hidden" />
                    <span className="tab-label">{t('quotations.list.filters.all') || 'All'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <FileText size={13} className="md:!hidden" />
                    <span className="tab-label">{t('quotations.list.filters.draft') || 'Draft'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Send size={13} className="md:!hidden" />
                    <span className="tab-label">{t('quotations.list.filters.sent') || 'Sent'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="accepted" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="md:!hidden" />
                    <span className="tab-label">{t('quotations.list.filters.accepted') || 'Accepted'}</span>
                  </TabsTrigger>
                  <TabsTrigger value="rejected" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Ban size={13} className="md:!hidden" />
                    <span className="tab-label">{t('quotations.list.filters.rejected') || 'Rejected'}</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <form onSubmit={handleSearch} className="w-full md:w-auto">
                  <SearchInput 
                    placeholder={t('quotations.list.search') || "Search quotations..."} 
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
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {isLoading ? (
              <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <div className="text-center text-red-500 p-4">{t('quotations.list.errorLoading') || 'Error loading quotations'}</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('quotations.list.table.date') || 'Date'}</TableHead>
                      <TableHead>{t('quotations.list.table.client') || 'Client'}</TableHead>
                      <TableHead>{t('quotations.list.table.status') || 'Status'}</TableHead>
                      <TableHead>{t('quotations.list.table.validUntil') || 'Valid Until'}</TableHead>
                      <TableHead className="text-right">{t('quotations.list.table.total') || 'Total'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data && data.data.length > 0 ? (
                      data.data.map((quote: any) => (
                        <TableRow key={quote.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/quotations/${quote.id}`)}>
                          <TableCell>
                            <div className="font-medium">
                              {format(new Date(quote.created_at), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>{quote.lead?.name || t('quotations.list.unknown') || 'Unknown'}</TableCell>
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
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(quote.total)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          <EmptyCard 
                            icon={<FileText size={24} className="text-muted-foreground" />}
                            title={t('quotations.list.empty.title') || "No quotations found"}
                            description={searchQuery || statusFilter !== 'all'
                              ? (t('quotations.list.empty.descFiltered') || "Try adjusting your filters to see more results.")
                              : (t('quotations.list.empty.descDefault') || "Create quotations from deals to send to your clients.")
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
