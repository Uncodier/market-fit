"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listPromotions } from "./actions"
import { PromotionParams } from "./types"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tag, Plus, Edit, Calendar } from "@/app/components/ui/icons"
import Link from "next/link"
import { format } from "date-fns"
import { CreatePromotionDialog } from "./components/CreatePromotionDialog"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 hover:bg-gray-100 border-none",
  active: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
  paused: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
  expired: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
}

export default function PromotionsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
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
    // Si queremos un titulo especial
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.promotions') || 'Promotions'
      }
    });
    window.dispatchEvent(event);
  }, [t]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    mutate()
  }

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener('promotions:create', handleCreate)
    return () => window.removeEventListener('promotions:create', handleCreate)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-8">
              {/* Left actions placeholder */}
            </div>
            
            <div className="flex items-center gap-2">
              <Tabs 
                value={statusFilter} 
                onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
                className="hidden lg:block"
              >
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="all" className="text-xs rounded-full">All</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs rounded-full">Active</TabsTrigger>
                  <TabsTrigger value="draft" className="text-xs rounded-full">Draft</TabsTrigger>
                  <TabsTrigger value="paused" className="text-xs rounded-full">Paused</TabsTrigger>
                  <TabsTrigger value="expired" className="text-xs rounded-full">Expired</TabsTrigger>
                </TabsList>
              </Tabs>
              <form onSubmit={handleSearch} className="w-full md:w-64">
                <SearchInput 
                  placeholder={t('promotions.search') || "Search name or code..."} 
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
                Failed to load promotions. {error.message}
              </div>
            ) : data?.data && data.data.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Promotion</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Uses</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.data.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <div className="font-medium text-gray-900">{promo.name}</div>
                          {promo.code && <div className="text-xs font-mono bg-gray-100 text-gray-600 px-1 py-0.5 rounded mt-1 inline-block">{promo.code}</div>}
                        </TableCell>
                        <TableCell>
                          <Link href={`/campaigns/${promo.campaign_id}?artifact=true`} className="text-sm text-blue-600 hover:underline">
                            {promo.campaigns?.title || 'Unknown'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-gray-900">
                            {promo.discount_type === 'percent' ? `${promo.discount_value}% OFF` : `$${promo.discount_value} OFF`}
                          </div>
                          {promo.applies_to === 'selected_items' && (
                            <div className="text-xs text-gray-500">Selected items</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {promo.usage_count} {promo.usage_limit ? `/ ${promo.usage_limit}` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLES[promo.status] || ''}>
                            {promo.status.toUpperCase()}
                          </Badge>
                          {(promo.starts_at || promo.ends_at) && (
                            <div className="text-[10px] text-gray-500 mt-1 flex items-center">
                              <Calendar className="h-3 w-3 mr-1" /> Scheduled
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link 
                            href={`/promotions/${promo.id}?artifact=true`} 
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
                title={t('promotions.empty.title') || "No promotions found"}
                description={t('promotions.empty.description') || "Create a discount code or automatic promotion."}
                actionButton={
                  <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('promotions.add') || 'Create Promotion'}
                  </Button>
                }
              />
            )}
          </div>
        </div>
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
