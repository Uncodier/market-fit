"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listCatalogItems, listCatalogCategories } from "./actions"
import { reorderCatalogDisplay } from "./reorder-actions"
import { CatalogListParams } from "./types"
import { CatalogTable } from "./components/CatalogTable"
import { CreateCatalogItemDialog } from "./components/CreateCatalogItemDialog"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import Link from "next/link"
import { Plus, Archive, DatabaseIcon, Sliders } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { KanbanView } from "./components/KanbanView"
import { upsertCatalogItem } from "./actions"
import { cn } from "@/lib/utils"

export default function CatalogPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [kindFilter, setKindFilter] = useState<'all' | 'product' | 'service'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [viewType, setViewType] = useMobileView("table")

  const isDragEnabled = kindFilter === 'all' && searchQuery === ''
  // Use a large page size when drag is enabled to fetch all items for proper sorting
  const pageSize = isDragEnabled ? 1000 : 50

  const fetcher = async (params: CatalogListParams) => {
    const [itemsRes, categoriesRes] = await Promise.all([
      listCatalogItems(params),
      listCatalogCategories(params.siteId)
    ])
    if (itemsRes.error) throw new Error(itemsRes.error)
    if (categoriesRes.error) throw new Error(categoriesRes.error)
    return {
      items: itemsRes,
      categories: categoriesRes.data || []
    }
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

  const handleUpdateKind = async (itemId: string, newKind: string) => {
    if (!currentSite?.id) return
    try {
      const result = await upsertCatalogItem({ id: itemId, site_id: currentSite.id, kind: newKind as 'product' | 'service' })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Item kind updated")
      mutate()
    } catch (error) {
      toast.error("Error updating item")
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!currentSite?.id || !data) return
    
    const { destination, source, draggableId, type } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    const { items, categories } = data

    // Deep copy current state to compute new orders
    let newCategories = [...categories]
    let newItems = [...(items.data || [])]

    if (type === 'category') {
      const [moved] = newCategories.splice(source.index, 1)
      newCategories.splice(destination.index, 0, moved)
    } else if (type === 'item') {
      const sourceCatId = source.droppableId
      const destCatId = destination.droppableId

      const sourceItems = newItems.filter(i => (i.category_id || "uncategorized") === sourceCatId)
      const destItems = sourceCatId === destCatId ? sourceItems : newItems.filter(i => (i.category_id || "uncategorized") === destCatId)

      const [movedItem] = sourceItems.splice(source.index, 1)
      
      if (sourceCatId !== destCatId) {
        movedItem.category_id = destCatId === "uncategorized" ? undefined : destCatId
      }
      
      destItems.splice(destination.index, 0, movedItem)

      // Reassemble items list to keep track
      newItems = newItems.filter(i => (i.category_id || "uncategorized") !== sourceCatId && (i.category_id || "uncategorized") !== destCatId)
      newItems.push(...sourceItems)
      if (sourceCatId !== destCatId) {
        newItems.push(...destItems)
      }
    }

    // Optimistic UI update
    mutate({
      items: { ...items, data: newItems },
      categories: newCategories
    }, false)

    // Compute payload
    const orderedCategoryIds = newCategories.map(c => c.id)
    const itemIdsByCategory: Record<string, string[]> = {}
    
    orderedCategoryIds.forEach(catId => {
      itemIdsByCategory[catId] = newItems.filter(i => i.category_id === catId).map(i => i.id)
    })
    // Add uncategorized items
    itemIdsByCategory["uncategorized"] = newItems.filter(i => !i.category_id).map(i => i.id)
    if (!orderedCategoryIds.includes("uncategorized")) {
      orderedCategoryIds.push("uncategorized")
    }

    // Persist
    const res = await reorderCatalogDisplay({
      siteId: currentSite.id,
      categoryIds: orderedCategoryIds,
      itemIdsByCategory
    })

    if (res.error) {
      toast.error("Failed to save order")
      mutate() // rollback
    }
  }

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener('catalog:create', handleCreate)
    return () => window.removeEventListener('catalog:create', handleCreate)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                <Tabs 
                  value={kindFilter} 
                  onValueChange={(val) => { setKindFilter(val as any); setPage(1); }}
                  className="flex-shrink-0"
                >
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="all" className="text-xs rounded-full">{t('catalog.kind.all') || 'All Items'}</TabsTrigger>
                    <TabsTrigger value="product" className="gap-2 text-xs rounded-full"><Archive className="h-4 w-4"/> {t('catalog.kind.product') || 'Products'}</TabsTrigger>
                    <TabsTrigger value="service" className="gap-2 text-xs rounded-full"><DatabaseIcon className="h-4 w-4"/> {t('catalog.kind.service') || 'Services'}</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <Tabs 
                  value={statusFilter} 
                  onValueChange={(val) => { setStatusFilter(val as any); setPage(1); }}
                  className="flex-shrink-0"
                >
                  <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full">
                    <TabsTrigger value="active" className="text-xs rounded-full">{t('status.active') || 'Active'}</TabsTrigger>
                    <TabsTrigger value="archived" className="text-xs rounded-full">{t('status.archived') || 'Archived'}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <form onSubmit={handleSearch} className="w-full md:w-auto">
                  <SearchInput 
                    placeholder={t('catalog.search') || "Search catalog..."} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    alwaysExpanded={false}
                  />
                </form>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto md:ml-auto">
                <Button variant="outline" size="sm" asChild className="gap-2">
                  <Link href="/catalog/modifier-groups">
                    <Sliders className="h-4 w-4" />
                    {t("catalog.modifiers.groupsTitle") || "Modifiers"}
                  </Link>
                </Button>
                <div className="hidden md:flex ml-2">
                  <ViewSelector currentView={viewType} onViewChange={setViewType} />
                </div>
              </div>
            </div>
            {/* Mobile View Selector */}
            <div className="md:hidden flex justify-end mt-2">
              <ViewSelector currentView={viewType} onViewChange={setViewType} />
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="flex flex-col gap-6">
          <div>
            {!currentSite || isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                Failed to load catalog. {error.message}
              </div>
            ) : (
              <>
                {viewType === 'table' ? (
                  <>
                    <CatalogTable 
                      items={data?.items.data || []} 
                      categories={data?.categories || []}
                      onUpdate={() => mutate()} 
                      searchQuery={searchQuery}
                      onCreateOpen={() => setIsCreateOpen(true)}
                      onDragEnd={handleDragEnd}
                      isDragEnabled={isDragEnabled}
                    />
                    
                    {!isDragEnabled && (data?.items.count ?? 0) > pageSize && (
                      <div className="py-4 flex justify-center">
                        <Pagination 
                          currentPage={page}
                          totalPages={Math.ceil(data!.items.count / pageSize)}
                          onPageChange={setPage}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className={viewType === 'kanban' ? "overflow-x-auto -mx-4 md:-mx-6" : ""}>
                    <div className={viewType === 'kanban' ? "px-4 md:px-6" : ""}>
                      {data?.items.data && data.items.data.length > 0 ? (
                        <KanbanView 
                          items={data.items.data}
                          categories={data.categories}
                          onDragEnd={handleDragEnd}
                          isDragEnabled={isDragEnabled}
                          searchQuery={searchQuery}
                        />
                      ) : (
                        <div className="pt-4">
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
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
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
