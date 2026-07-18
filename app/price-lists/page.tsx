"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPriceLists } from "./actions"
import { PriceListParams } from "./types"
import { PriceList } from "@/app/types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Plus, Tag, Edit } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import Link from "next/link"
import { CreatePriceListDialog } from "./components/CreatePriceListDialog"

export default function PriceListsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [isCreateOpen, setIsCreateOpen] = useState(false)

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
    // Si queremos un titulo especial
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.priceLists') || 'Price Lists'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener('price-lists:create', handleCreate)
    return () => window.removeEventListener('price-lists:create', handleCreate)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-end">
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                Failed to load price lists. {error.message}
              </div>
            ) : data?.data && data.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('priceLists.name') || 'Name'}</TableHead>
                      <TableHead>{t('priceLists.code') || 'Code'}</TableHead>
                      <TableHead>{t('priceLists.currency') || 'Currency'}</TableHead>
                      <TableHead>{t('priceLists.status') || 'Status'}</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((list) => (
                      <TableRow key={list.id} className={!list.is_active ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-gray-900">{list.name}</span>
                            {list.is_default && (
                              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none ml-2 text-[10px]">
                                Default
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {list.code ? (
                            <span className="font-mono text-sm text-gray-600">{list.code}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{list.currency}</TableCell>
                        <TableCell>
                          {list.is_active ? (
                            <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link 
                            href={`/price-lists/${list.id}?artifact=true`} 
                            className="inline-flex items-center justify-center rounded-md h-8 w-8 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          >
                            <Edit className="h-4 w-4" />
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
                  icon={<Tag className="h-6 w-6" />}
                  title={t('priceLists.empty.title') || "No price lists"}
                  description={t('priceLists.empty.description') || "Create a price list to manage different pricing tiers."}
                  actionButton={
                    <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('priceLists.addList') || 'Create List'}
                    </Button>
                  }
                />
            )}
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreatePriceListDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  )
}
