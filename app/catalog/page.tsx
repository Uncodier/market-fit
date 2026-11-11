"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { DropResult } from "@hello-pangea/dnd"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listCatalogItems } from "./actions"
import { listCatalogPageCategories } from "./list-categories"
import { reorderCatalogDisplay } from "./reorder-actions"
import type { CatalogListParams, CatalogSort } from "./types"
import { CatalogTable } from "./components/CatalogTable"
import { CreateCatalogItemDialog } from "./components/CreateCatalogItemDialog"
import { CatalogFilterTabs } from "./components/CatalogFilterTabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Plus, Archive, UploadCloud as Upload } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { toast } from "sonner"
import { ViewSelector } from "@/app/components/view-selector"
import { useMobileView } from "@/app/hooks/use-mobile-view"
import { KanbanView } from "./components/KanbanView"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { useSearchPagination } from "@/lib/catalog-search/use-search-pagination"

const ImportCatalogDialog = dynamic(() => import("./components/ImportCatalogDialog").then(m => m.ImportCatalogDialog))
const pageSize = 50

export default function CatalogPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : 'display_order'))
  const [sortBy, setSortBy] = useState<CatalogSort>(defaultSort)

  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || "")
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams?.get("q")?.trim() || "")
  const [kindFilter, setKindFilter] = useState<'all' | 'product' | 'service' | 'variant'>(() => {
    if (searchParams?.get("status") === "archived") return "all"
    const kind = searchParams?.get("kind")
    return kind === "product" || kind === "service" || kind === "variant" ? kind : "all"
  })
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>(searchParams?.get("status") === "archived" ? "archived" : "active")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [viewType, setViewType] = useMobileView("table")

  // A new query scope uses page 1 immediately, without fetching the old page
  // before an effect resets it (especially important when switching sites).
  const scope = JSON.stringify([currentSite?.id, kindFilter, statusFilter, debouncedSearch, sortBy])
  const { page, setPage, searchId, acceptSearchId, restart, generation } = useSearchPagination(scope, Boolean(debouncedSearch), Boolean(currentSite?.id))
  useEffect(() => {
    const url = new URL(window.location.href)
    if (debouncedSearch) url.searchParams.set("q", debouncedSearch)
    else url.searchParams.delete("q")
    if (kindFilter !== "all") url.searchParams.set("kind", kindFilter)
    else url.searchParams.delete("kind")
    if (statusFilter !== "active") url.searchParams.set("status", statusFilter)
    else url.searchParams.delete("status")
    if (sortBy !== "display_order") url.searchParams.set("sort", sortBy)
    else url.searchParams.delete("sort")
    window.history.replaceState(window.history.state, "", url)
  }, [debouncedSearch, kindFilter, statusFilter, sortBy])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const fetcher = async (params: CatalogListParams) => {
    const itemsRes = await listCatalogItems(params)
    if (itemsRes.error) throw Object.assign(new Error(itemsRes.error), { status: itemsRes.error_status })
    const isComplete = params.kind === 'all' && params.status === 'active' && !params.q &&
      params.page === 1 && itemsRes.count <= pageSize && itemsRes.count <= itemsRes.data.length
    const categoryIds = itemsRes.data.flatMap(item => item.category_id ? [item.category_id] : [])
    const categoriesRes = await listCatalogPageCategories(params.siteId, categoryIds, isComplete)
    if (categoriesRes.error) throw new Error(categoriesRes.error)
    return {
      items: itemsRes,
      categories: categoriesRes.data,
      categoriesComplete: categoriesRes.complete,
    }
  }

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    currentSite?.id ? { 
      siteId: currentSite.id, 
      kind: kindFilter, 
      status: statusFilter,
      q: debouncedSearch,
      page,
      pageSize,
      sortBy,
      ...(debouncedSearch && searchId ? { search_id: searchId } : {}),
      generation,
    } : null,
    fetcher
  )

  useEffect(() => {
    if (error?.status === 409 && debouncedSearch) restart()
    else if (data?.items.search_id) acceptSearchId(data.items.search_id)
  }, [error, data, debouncedSearch, restart, acceptSearchId])

  if (data && !error && !isLoading && !isValidating) {
    const lastPage = Math.max(1, Math.ceil(data.items.count / pageSize))
    if (page > lastPage) setPage(lastPage)
  }

  const isDragEnabled = Boolean(
    currentSite?.id && data && !error && !isLoading && !isValidating &&
    kindFilter === 'all' && statusFilter === 'active' && sortBy === 'display_order' && data.categoriesComplete &&
    searchQuery.trim() === '' && debouncedSearch === '' && page === 1 &&
    data.items.data.length <= pageSize && data.items.count <= pageSize &&
    data.items.count <= data.items.data.length
  )

  useEffect(() => {
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
    setDebouncedSearch(searchQuery.trim())
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!currentSite?.id || !data || !isDragEnabled) return
    
    const { destination, source, draggableId, type } = result
    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return
    }

    const { items, categories } = data

    // Deep copy current state to compute new orders
    const newCategories = [...categories]
    let newItems = items.data.map(item => ({ ...item }))

    if (type === 'category') {
      if (source.droppableId === 'variants' || destination.droppableId === 'variants' || source.index >= newCategories.length || destination.index >= newCategories.length) {
        return
      }
      const [moved] = newCategories.splice(source.index, 1)
      newCategories.splice(destination.index, 0, moved)
    } else if (type === 'item') {
      const sourceCatId = source.droppableId
      const destCatId = destination.droppableId

      if (sourceCatId === 'variants' || destCatId === 'variants') {
        return
      }

      const sourceItems = newItems.filter(i => !i.parent_id && (i.category_id || "uncategorized") === sourceCatId)
      const destItems = sourceCatId === destCatId ? sourceItems : newItems.filter(i => !i.parent_id && (i.category_id || "uncategorized") === destCatId)

      const [movedItem] = sourceItems.splice(source.index, 1)
      if (!movedItem || movedItem.id !== draggableId) return
      
      if (sourceCatId !== destCatId) {
        movedItem.category_id = destCatId === "uncategorized" ? undefined : destCatId
      }
      
      destItems.splice(destination.index, 0, movedItem)

      // Reassemble items list to keep track
      newItems = newItems.filter(i => i.parent_id || ((i.category_id || "uncategorized") !== sourceCatId && (i.category_id || "uncategorized") !== destCatId))
      newItems.push(...sourceItems)
      if (sourceCatId !== destCatId) {
        newItems.push(...destItems)
      }
    } else return

    // Optimistic UI update
    mutate({
      ...data,
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
      toast.error(t("catalog.orderUpdateError") || "Error saving order")
      mutate() // rollback
    }
  }

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener('catalog:create', handleCreate)
    return () => window.removeEventListener('catalog:create', handleCreate)
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] min-h-0">
      <StickyHeader>
        <div className="w-full pt-0">
          <div className="flex items-center justify-between gap-4 md:gap-6 w-full">
            <MobileFiltersDrawer triggerText={t('common.search') || "Search"}>
                <FilterContainer>
                  <FilterSection mobileOnly>
                    <form onSubmit={handleSearch} className="w-full">
                      <SearchInput  placeholder={t('catalog.search') || "Search in catalog..."} value={searchQuery} onChange={handleSearchChange} alwaysExpanded={true}    className="w-full h-10 md:h-9"  containerClassName="w-full" />
                    </form>
                  </FilterSection>
                  
                  

                  <FilterSection title={t('common.filters') || 'Filters'}>
                    <CatalogFilterTabs
                      kind={kindFilter}
                      status={statusFilter}
                      onChange={(kind, status) => {
                        setKindFilter(kind)
                        setStatusFilter(status)
                      }}
                    />
                  </FilterSection>

                  <FilterSection desktopOnly>
                    <form onSubmit={handleSearch} className="w-full md:w-auto">
                      <SearchInput  placeholder={t('catalog.search') || "Search in catalog..."} value={searchQuery} onChange={handleSearchChange}    className="w-full"  containerClassName="w-64" />
                    </form>
                  </FilterSection>
                  <FilterSection mobileOnly>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex h-11 w-full items-center justify-start gap-2 rounded-md"
                      onClick={() => setIsImportOpen(true)}
                      disabled={!currentSite?.id}
                      title="Import"
                      aria-label="Import"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Import</span>
                    </Button>
                  </FilterSection>
                </FilterContainer>
              </MobileFiltersDrawer>
              
              <div className="ml-auto flex items-center gap-3 shrink-0">
                <div className="hidden shrink-0 items-center md:flex">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => setIsImportOpen(true)}
                    disabled={!currentSite?.id}
                    title="Import"
                    aria-label="Import"
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </div>
                <SortDropdown sortBy={sortBy} setSortBy={setSortBy} options={[
                  { value: 'display_order', label: 'Display order' },
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'updated_at', label: 'Updated' },
                ]} />
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
        </div>
      </StickyHeader>

      <div className={cn(
        "flex-1 min-h-0 min-w-0 overflow-y-auto",
        viewType === "kanban" ? "py-4 md:py-6" : "p-4 md:p-6 overflow-x-hidden"
      )}>
        <div className="flex flex-col gap-6 h-full">
          <div className="h-full">
            {!currentSite || isLoading ? (
              <div className={viewType === 'kanban' ? "px-4 md:px-6 space-y-4" : "space-y-4"}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-red-500">
                Error loading catalog. {error.message}
              </div>
            ) : (
              <div className="h-full">
                {viewType === 'table' ? (
                  <>
                    <CatalogTable 
                      key={scope}
                      items={data?.items.data || []} 
                      categories={data?.categories || []}
                      onUpdate={() => mutate()} 
                      searchQuery={searchQuery}
                      resultKind={data?.items.result_kind}
                      onCreateOpen={() => setIsCreateOpen(true)}
                      onDragEnd={handleDragEnd}
                      isDragEnabled={isDragEnabled} />
                    
                  </>
                ) : (
                  <div className="h-full min-w-0 w-full flex flex-col">
                      {data?.items.data && data.items.data.length > 0 ? (
                        <KanbanView 
                          key={scope}
                          items={data.items.data}
                          categories={data.categories}
                          onDragEnd={handleDragEnd}
                          isDragEnabled={isDragEnabled}
                          resultKind={data.items.result_kind}
                          searchQuery={searchQuery} />
                      ) : (
                        <div className="pt-4 px-4 md:px-6">
                          <EmptyCard
                            icon={<Archive className="h-6 w-6" />}
                            title={t('catalog.empty.title') || "No items found"}
                            description={t('catalog.empty.description') || (searchQuery ? "No items match your search." : "Start by adding products or services to your catalog.")}
                            actionButton={
                              <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                                <Plus className="mr-2 h-4 w-4" />
                                {t('catalog.addItem') || 'Add item'}
                              </Button>
                            } />
                        </div>
                      )}
                  </div>
                )}
                {(data?.items.count ?? 0) > pageSize && (
                  <div className="py-4 flex justify-center">
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil((data?.items.count ?? 0) / pageSize)}
                      onPageChange={setPage} />
                  </div>
                )}
                {debouncedSearch && data?.items.candidate_window_truncated === true && (
                  <p className="mt-4 pb-4 text-sm text-muted-foreground">Ranked search results from up to 200 candidates, not an exact catalog total.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isCreateOpen && (
        <CreateCatalogItemDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSuccess={() => mutate()} />
      )}
      {isImportOpen && currentSite?.id && (
        <ImportCatalogDialog
          key={currentSite.id}
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          siteId={currentSite.id}
          onSuccess={() => mutate()} />
      )}
    </div>
  )
}
