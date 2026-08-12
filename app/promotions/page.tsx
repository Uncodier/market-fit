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
import { formatPromotionDiscountLabel } from "./bogo-discount"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-foreground hover:bg-muted/50 border-none",
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
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <Tabs 
                  value={statusFilter} 
                  onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
                  className="hidden lg:block"
                >
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full flex-shrink-0">
                    <TabsTrigger value="all" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">All</TabsTrigger>
                    <TabsTrigger value="active" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">Active</TabsTrigger>
                    <TabsTrigger value="draft" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">Draft</TabsTrigger>
                    <TabsTrigger value="paused" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">Paused</TabsTrigger>
                    <TabsTrigger value="expired" className="text-xs font-medium rounded-full flex items-center justify-center gap-1.5">Expired</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <form onSubmit={handleSearch} className="w-full md:w-auto">
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
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex flex-col gap-6">
          <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
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
            ) : (
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
                    {data?.data && data.data.length > 0 ? (
                      data.data.map((promo) => (
                        <TableRow key={promo.id}>
                          <TableCell>
                            <div className="font-medium text-foreground">{promo.name}</div>
                            {promo.code && <div className="text-xs font-mono bg-muted text-muted-foreground px-1 py-0.5 rounded mt-1 inline-block">{promo.code}</div>}
                          </TableCell>
                          <TableCell>
                            <Link href={`/campaigns/${promo.campaign_id}`} className="text-sm text-blue-600 hover:underline">
                              {promo.campaigns?.title || 'Unknown'}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">
                              {formatPromotionDiscountLabel(promo)}
                            </div>
                            {promo.applies_to === 'selected_items' && (
                              <div className="text-xs text-muted-foreground">Selected items</div>
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
                              <div className="text-[10px] text-muted-foreground mt-1 flex items-center">
                                <Calendar className="h-3 w-3 mr-1" /> Scheduled
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link 
                              href={`/promotions/${promo.id}`} 
                              className="inline-flex items-center justify-center rounded-md h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <EmptyCard
                            icon={<Tag className="h-6 w-6 text-muted-foreground" />}
                            title={t('promotions.empty.title') || "No promotions found"}
                            description={t('promotions.empty.description') || "Create a discount code or automatic promotion."}
                            className="border-0 shadow-none bg-transparent"
                            actionButton={
                              <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                                <Plus className="mr-2 h-4 w-4" />
                                {t('promotions.add') || 'Create Promotion'}
                              </Button>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {(data?.count ?? 0) > pageSize && (
                  <div className="p-4 border-t flex justify-center bg-muted/30">
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
