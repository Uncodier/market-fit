"use client"

import React, { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listShipments } from "./actions"
import { ShipmentParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { Send, Search, Eye, ExternalLink } from "@/app/components/ui/icons"
import Link from "next/link"
import { format } from "date-fns"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 hover:bg-gray-100 border-none",
  preparing: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  shipped: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
  in_transit: "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200",
  delivered: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  cancelled: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
  failed: "bg-red-100 text-red-800 hover:bg-red-100 border-red-300",
}

export default function ShipmentsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')

  const fetcher = async (params: ShipmentParams) => {
    const res = await listShipments(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { siteId: currentSite.id, page, pageSize, q: searchQuery, status: statusFilter } : null,
    fetcher
  )

  useEffect(() => {
    // Si queremos un titulo especial
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.shipments') || 'Shipments'
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
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-8">
              {/* Espacio reservado para acciones a la izquierda */}
            </div>
            
            <div className="flex items-center gap-2">
              <Tabs 
                value={statusFilter} 
                onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
                className="hidden lg:block"
              >
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="text-xs rounded-full">All</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs rounded-full">Pending</TabsTrigger>
                  <TabsTrigger value="preparing" className="text-xs rounded-full">Preparing</TabsTrigger>
                  <TabsTrigger value="shipped" className="text-xs rounded-full">Shipped</TabsTrigger>
                  <TabsTrigger value="in_transit" className="text-xs rounded-full">In Transit</TabsTrigger>
                  <TabsTrigger value="delivered" className="text-xs rounded-full">Delivered</TabsTrigger>
                </TabsList>
              </Tabs>
              <form onSubmit={handleSearch} className="w-full md:w-64">
                <SearchInput 
                  placeholder={t('shipments.search') || "Search tracking or customer..."} 
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                Failed to load shipments. {error.message}
              </div>
            ) : data?.data && data.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((shipment) => (
                      <TableRow key={shipment.id}>
                        <TableCell>
                          <div className="font-medium text-gray-900">
                            {shipment.sale_orders?.order_number || 'Unknown Order'}
                          </div>
                          {shipment.locations?.name && (
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center">
                              <Send className="h-3 w-3 mr-1" /> From: {shipment.locations.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{shipment.leads?.name || 'Unknown'}</div>
                          {shipment.leads?.email && <div className="text-xs text-gray-500">{shipment.leads.email}</div>}
                        </TableCell>
                        <TableCell>
                          {shipment.tracking_number ? (
                            <div className="text-sm">
                              <div className="font-mono">{shipment.tracking_number}</div>
                              <div className="text-xs text-gray-500">{shipment.carrier || 'Unknown Carrier'}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[shipment.status] || ''}>
                            {shipment.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-900">
                            {format(new Date(shipment.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(shipment.created_at), 'h:mm a')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Link 
                            href={`/shipments/${shipment.id}?artifact=true`} 
                            className="inline-flex items-center justify-center rounded-md h-8 w-8 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {data.count > pageSize && (
                  <div className="p-4 border-t flex justify-center bg-gray-50/30">
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
                icon={<Send className="h-6 w-6" />}
                title={t('shipments.empty.title') || "No shipments found"}
                description={t('shipments.empty.description') || (searchQuery ? "No shipments match your search criteria." : "Shipments will appear here once an order is created with shipping.")}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
