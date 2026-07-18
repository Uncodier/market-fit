"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listCatalogItems } from "./actions"
import { CatalogListParams } from "./types"
import { CatalogTable } from "./components/CatalogTable"
import { CreateCatalogItemDialog } from "./components/CreateCatalogItemDialog"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Plus, Archive, DatabaseIcon } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"

export default function CatalogPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [searchQuery, setSearchQuery] = useState("")
  const [kindFilter, setKindFilter] = useState<'all' | 'product' | 'service'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active')
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const fetcher = async (params: CatalogListParams) => {
    const res = await listCatalogItems(params)
    if (res.error) throw new Error(res.error)
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? { 
      siteId: currentSite.id, 
      kind: kindFilter, 
      status: statusFilter,
      q: searchQuery,
      page,
      pageSize 
    } : null,
    fetcher
  )

  useEffect(() => {
    // Si queremos un titulo especial
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t('layout.sidebar.catalog') || 'Catalog'
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
    window.addEventListener('catalog:create', handleCreate)
    return () => window.removeEventListener('catalog:create', handleCreate)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-gray-50/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-8">
              <Tabs 
                value={kindFilter} 
                onValueChange={(val) => { setKindFilter(val as any); setPage(1); }}
                className="w-full md:w-auto"
              >
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full hidden md:flex">
                  <TabsTrigger value="all" className="text-xs rounded-full">{t('catalog.kind.all') || 'All Items'}</TabsTrigger>
                  <TabsTrigger value="product" className="gap-2 text-xs rounded-full"><Archive className="h-4 w-4"/> {t('catalog.kind.product') || 'Products'}</TabsTrigger>
                  <TabsTrigger value="service" className="gap-2 text-xs rounded-full"><DatabaseIcon className="h-4 w-4"/> {t('catalog.kind.service') || 'Services'}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <div className="flex items-center gap-2">
              <Tabs 
                value={statusFilter} 
                onValueChange={(val) => { setStatusFilter(val as any); setPage(1); }}
                className="hidden lg:block"
              >
                <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                  <TabsTrigger value="active" className="text-xs rounded-full">{t('status.active') || 'Active'}</TabsTrigger>
                  <TabsTrigger value="archived" className="text-xs rounded-full">{t('status.archived') || 'Archived'}</TabsTrigger>
                </TabsList>
              </Tabs>
              <form onSubmit={handleSearch} className="w-full md:w-64">
                <SearchInput 
                  placeholder={t('catalog.search') || "Search catalog..."} 
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
                Failed to load catalog. {error.message}
              </div>
            ) : data?.data && data.data.length > 0 ? (
              <>
                <CatalogTable 
                  items={data.data} 
                  onUpdate={() => mutate()} 
                />
                
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
                  icon={<Archive className="h-6 w-6" />}
                  title={t('catalog.empty.title') || "No items found"}
                  description={t('catalog.empty.description') || (searchQuery ? "No items match your search criteria." : "Start by adding products or services to your catalog.")}
                  actionButton={
                    <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('catalog.addItem') || 'Add Item'}
                    </Button>
                  }
                />
            )}
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreateCatalogItemDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => mutate()}
        />
      )}
    </div>
  )
}
