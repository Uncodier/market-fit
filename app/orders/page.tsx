"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listOrders } from "./actions"
import { OrderParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ExternalLink, LayoutGrid, Clock, CheckCircle2, Ban, ListOrdered } from "@/app/components/ui/icons"
import Link from "next/link"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
}

export default function OrdersPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')

  const fetcher = async (params: OrderParams) => {
    const res = await listOrders(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter } : null,
    fetcher
  )

  useEffect(() => {
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.orders') || 'Orders'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleCreate = () => {
      router.push('/pos');
    }
    window.addEventListener('orders:create', handleCreate)
    return () => window.removeEventListener('orders:create', handleCreate)
  }, [router]);

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
                    <span className="tab-label">All</span>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Clock size={13} className="md:!hidden" />
                    <span className="tab-label">Pending</span>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={13} className="md:!hidden" />
                    <span className="tab-label">Completed</span>
                  </TabsTrigger>
                  <TabsTrigger value="cancelled" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">
                    <Ban size={13} className="md:!hidden" />
                    <span className="tab-label">Cancelled</span>
                  </TabsTrigger>
                </TabsList>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
                <form onSubmit={handleSearch} className="w-full md:w-auto">
                  <SearchInput 
                    placeholder={t('orders.search') || "Search order number..."} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    alwaysExpanded={false}
                  />
                </form>
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="mx-auto w-full max-w-[1200px] flex flex-col gap-6">
            <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-500">
                  Failed to load orders. {error.message}
                </div>
              ) : data?.data && data.data.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.map((order) => {
                        // Access lead if populated (note: our server action fetches it via sales, but it's joined differently)
                        // If lead isn't directly available, we can safely fallback to unknown
                        const leadName = (order.leads as any)?.name || 'Unknown Customer';
                        const leadEmail = (order.leads as any)?.email;
                        
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <div className="font-medium text-foreground">
                                {order.order_number}
                              </div>
                              {order.sales?.source && (
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center">
                                  {order.sales.source === 'online' ? 'Online Store' : 'Point of Sale'}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{leadName}</div>
                              {leadEmail && <div className="text-xs text-muted-foreground">{leadEmail}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(order.total)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_STYLES[order.status] || ''}>
                                {order.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-foreground">
                                {format(new Date(order.created_at), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), 'h:mm a')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Link 
                                href={`/orders/${order.id}`} 
                                className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  
                  {data.count > pageSize && (
                    <div className="p-4 border-t flex justify-center bg-muted/30">
                      <Pagination 
                        currentPage={page}
                        totalPages={Math.ceil(data.count / pageSize)}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </>
              ) : (
                <EmptyCard
                  icon={<ListOrdered size={24} className="text-muted-foreground" />}
                  title={t('orders.empty.title') || "No orders found"}
                  description={t('orders.empty.description') || (searchQuery ? "No orders match your search criteria." : "Orders will appear here once a checkout is completed.")}
                />
              )}
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
