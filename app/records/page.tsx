"use client"

import { useState, useEffect } from "react"
import { useRouter , useSearchParams} from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { useAutoCollapseSidebar } from "@/app/hooks/use-auto-collapse-sidebar"
import { cn } from "@/lib/utils"
import { ControlCenterHeader } from "@/app/control-center/components/ControlCenterHeader"
import { ViewSelector } from "@/app/components/view-selector"
import { SearchInput } from "@/app/components/ui/search-input"
import { Button } from "@/app/components/ui/button"
import { ClipboardList } from "@/app/components/ui/icons"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { RecordDateFilter } from "./components/RecordDateFilter"
import { Loader } from "@/app/components/ui/icons"
import { matchesRecordListFilter, recordListPage, type RecordDateRange } from "./lib/list-filter"
import { useRecordsBulkActions } from "./hooks/useRecordsBulkActions"
import { useRecordsData } from "./hooks/useRecordsData"
import { RecordsSidebar } from "./components/RecordsSidebar"
import { RecordsBulkToolbar } from "./components/RecordsBulkToolbar"
import { RecordsTrashDialog } from "./components/RecordsTrashDialog"

// Import the new specific Record views
import { RecordsTable, RecordsTableSkeleton } from "./components/RecordsTable"
import { RecordsKanban, RecordsKanbanSkeleton } from "./components/RecordsKanban"
import { RecordsCalendar, RecordsCalendarSkeleton } from "./components/RecordsCalendar"
import { RecordsGraph } from "./components/RecordsGraph"

import { CategoryTemplateEditor } from "./components/CategoryTemplateEditor"
import { createRecordCategory, updateRecordCategory, RecordCategory, createRecord } from "./actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function RecordsPage() {
  const searchParams = useSearchParams()
  const urlSort = searchParams ? searchParams.get('sort') : null
  const defaultSort = urlSort === 'updated_at' ? 'updated_at' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : (urlSort === 'title_asc' ? 'title_asc' : (urlSort === 'title_desc' ? 'title_desc' : 'newest'))))

  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAutoCollapseSidebar()

  const { categories, records, isLoading, error: loadError, refreshData } = useRecordsData(currentSite?.id)
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedRelation, setSelectedRelation] = useState<{ fieldName: string, targetId: string } | null>(null)
  const [recordSearchQuery, setRecordSearchQuery] = useState("")
  const [viewType, setViewType] = useState<"table" | "kanban" | "calendar" | "graph">("table")
  const [groupBy, setGroupBy] = useState<"status" | "category" | "date" | "team_member">("status")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title_asc" | "title_desc" | "updated_at">(defaultSort)
  const [dateRange, setDateRange] = useState<RecordDateRange>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const { selectedRecords, setSelectedRecords, isBulkActionLoading, handleBulkDelete,
    handleBulkStatusChange, handleBulkCategoryChange, updateLoadedRecord } = useRecordsBulkActions(records, refreshData)
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false)
  const [categoryToCreateIn, setCategoryToCreateIn] = useState<string>("")
  const [isCreatingRecord, setIsCreatingRecord] = useState(false)
  const [trashSiteId, setTrashSiteId] = useState<string | null>(null)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<RecordCategory | null>(null)

  // Layout calculations
  const sidebarLeft = isMobile ? '0px' : (isLayoutCollapsed ? '64px' : '256px')

  // Breadcrumb
  useEffect(() => {
    document.title = `${t("records.title") || "Records"} | Market Fit`
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: t("records.title") || "Records",
        path: "/records",
        section: 'Operations'
      }
    })
    window.dispatchEvent(event)
    return () => { document.title = "Market Fit" }
  }, [])

  // Filter records
  const filteredRecords = records.filter(r => matchesRecordListFilter(r, {
    categoryId: selectedCategory, relation: selectedRelation, search: recordSearchQuery, dateRange,
  })).sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    const updateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const updateB = new Date(b.updated_at || b.created_at || 0).getTime();
    
    if (sortBy === "newest") return dateB - dateA
    if (sortBy === "oldest") return dateA - dateB
    if (sortBy === "updated_at") return updateB - updateA
    if (sortBy === "title_asc") return a.title.localeCompare(b.title)
    if (sortBy === "title_desc") return b.title.localeCompare(a.title)
    return 0
  })
  const visiblePage = recordListPage(currentPage, filteredRecords.length, itemsPerPage)
  const hasFilters = selectedCategory !== "all" || !!selectedRelation || !!recordSearchQuery || !!dateRange
  const clearFilters = () => {
    setSelectedCategory("all"); setSelectedRelation(null); setRecordSearchQuery(""); setDateRange(null); setCurrentPage(1)
  }

  // Handlers
  const handleEditTemplate = (category?: RecordCategory) => {
    setEditingCategory(category || null)
    setIsEditorOpen(true)
  }

  const handleSaveCategory = async (data: Omit<Parameters<typeof createRecordCategory>[0], "site_id">) => {
    if (!currentSite?.id) return
    try {
      if (editingCategory) {
        const result = await updateRecordCategory(editingCategory.id, data)
        if (result.error) throw new Error(result.error)
        toast.success(t("records.toast.templateUpdated") || "Template updated")
      } else {
        const result = await createRecordCategory({ ...data, site_id: currentSite.id })
        if (result.error) throw new Error(result.error)
        toast.success(t("records.toast.templateCreated") || "Template created")
      }
      refreshData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save category")
      throw error
    }
  }

  const handleCreateRecord = async (specificCategoryId?: string) => {
    if (!currentSite?.id) return
    
    let categoryId = typeof specificCategoryId === "string" ? specificCategoryId : undefined
    
    if (!categoryId) {
      if (selectedCategory !== "all") {
        categoryId = selectedCategory
      } else if (categories.length === 1) {
        categoryId = categories[0].id
      } else if (categories.length > 1) {
        setCategoryToCreateIn(categories[0].id)
        setIsCategorySelectOpen(true)
        return
      } else {
        toast.error(t("records.toast.selectCategory") || "Please select or create a category first")
        return
      }
    }

    setIsCreatingRecord(true)
    const { record, error } = await createRecord({
      site_id: currentSite.id,
      category_id: categoryId,
      title: t("records.untitled") || "Untitled Record"
    })
    setIsCreatingRecord(false)

    if (error) {
      toast.error(error)
    } else if (record) {
      setIsCategorySelectOpen(false)
      router.push(`/records/${record.id}`)
    }
  }

  // Listen for topbar action
  useEffect(() => {
    const handleCreateRecordAction = () => {
      handleCreateRecord()
    }
    window.addEventListener("records:create", handleCreateRecordAction)
    return () => window.removeEventListener("records:create", handleCreateRecordAction)
  }, [currentSite, selectedCategory, categories])

  return (
    <div className="flex h-full relative">
      {/* Sidebar */}
      <div 
        className={cn(
          "hidden md:block fixed h-screen transition-[width,opacity,left] duration-300 ease-in-out z-[100]",
          isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px] opacity-100"
        )}
        style={{ left: sidebarLeft, top: '64px' }}
      >
        <RecordsSidebar
          categories={categories}
          records={records}
          selectedCategory={selectedCategory}
          selectedRelation={selectedRelation}
          onSelectCategory={(id, relation) => {
            setSelectedCategory(id)
            setSelectedRelation(relation)
            setCurrentPage(1)
          }}
          isCollapsed={isSidebarCollapsed}
          onEditTemplate={handleEditTemplate}
          onCreateCategory={() => handleEditTemplate()}
          onOpenTrash={() => setTrashSiteId(currentSite?.id || null)}
        />
      </div>

      {/* Main content */}
      <div 
        className={cn(
          "flex flex-col h-full flex-1 min-w-0 transition-all duration-300 ease-in-out relative",
          !isSidebarCollapsed ? "md:ml-0" : ""
        )}
        style={{
          marginLeft: `-${sidebarLeft}`,
          width: `calc(100% + ${sidebarLeft})`
        }}
      >
        <div className="relative">
          <ControlCenterHeader
            isSidebarCollapsed={isSidebarCollapsed}
            toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            sidebarLeft={sidebarLeft}
            leftContent={
              selectedRecords.size > 0 ? (
                <RecordsBulkToolbar {...{ selectedRecords, setSelectedRecords, isBulkActionLoading,
                  categories, handleBulkStatusChange, handleBulkCategoryChange, handleBulkDelete }} />
              ) : (
                <div className="flex items-center gap-4">
                  <Tabs value={groupBy} onValueChange={val => setGroupBy(val as typeof groupBy)} className="hidden md:block">
                    <TabsList className="h-9 p-1 bg-muted/30 rounded-full">
                      <TabsTrigger value="status" className="text-xs font-medium rounded-full px-3">{t("records.groupBy.status") || "Status"}</TabsTrigger>
                      <TabsTrigger value="category" className="text-xs font-medium rounded-full px-3">{t("records.groupBy.category") || "Category"}</TabsTrigger>
                      <TabsTrigger value="team_member" className="text-xs font-medium rounded-full px-3">{t("records.groupBy.teamMember") || "Team Member"}</TabsTrigger>
                      <TabsTrigger value="date" className="text-xs font-medium rounded-full px-3">{t("records.groupBy.date") || "Date (Month)"}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <SearchInput
                    placeholder={t("records.search") || "Search records..."}
                    value={recordSearchQuery}
                    onChange={(e) => { setRecordSearchQuery(e.target.value); setCurrentPage(1) }}
                    className="bg-background border-border"
                  />
                </div>
              )
            }
            rightContent={
              selectedRecords.size > 0 ? null : (
                <div className="flex items-center gap-2">
                  <div className="md:hidden">
                    <Select value={groupBy} onValueChange={val => setGroupBy(val as typeof groupBy)}>
                      <SelectTrigger className="h-9 w-[130px] bg-background border-border" title={t("records.groupBy") || "Group by..."}>
                        <SelectValue placeholder={t("records.groupBy") || "Group by..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">{t("records.groupBy.status") || "Status"}</SelectItem>
                        <SelectItem value="category">{t("records.groupBy.category") || "Category"}</SelectItem>
                        <SelectItem value="team_member">{t("records.groupBy.teamMember") || "Team Member"}</SelectItem>
                        <SelectItem value="date">{t("records.groupBy.date") || "Date (Month)"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <RecordDateFilter value={dateRange} onChange={range => { setDateRange(range); setCurrentPage(1) }} />

                  <SortDropdown sortBy={sortBy} setSortBy={setSortBy} options={[
                    { value: "newest", label: t("records.sort.newest") || "Newest" },
                    { value: "oldest", label: t("records.sort.oldest") || "Oldest" },
                    { value: "updated_at", label: "Updated At" },
                    { value: "title_asc", label: t("records.sort.titleAsc") || "Title (A-Z)" },
                    { value: "title_desc", label: t("records.sort.titleDesc") || "Title (Z-A)" }
                  ]} />

                  <ViewSelector
                    currentView={viewType}
                    onViewChange={(view) => setViewType(view as typeof viewType)}
                    showCalendar={true}
                    showGraph={true}
                  />
                </div>
              )
            }
          />
        </div>

        <div className={cn("flex-1 min-w-0 bg-muted/30 transition-colors duration-300 ease-in-out pt-[71px]", viewType === "graph" ? "overflow-hidden" : "overflow-y-auto")}>
          <div 
            className="min-h-full flex flex-col transition-all duration-300 ease-in-out"
            style={{ 
              paddingLeft: isMobile ? '0px' : `calc(${sidebarLeft} + ${!isSidebarCollapsed ? "319px" : "0px"})`
            }}
          >
            {isLoading ? (
              <div className={cn("min-h-full min-w-0", viewType === "graph" ? "" : viewType === "kanban" ? "py-4 md:py-8" : "p-4 md:p-8")}>
                {viewType === "table" ? (
                  <RecordsTableSkeleton />
                ) : viewType === "calendar" ? (
                  <RecordsCalendarSkeleton />
                ) : viewType === "graph" ? (
                  <div className="w-full h-[calc(100vh-135px)] min-h-[600px] bg-muted/20 animate-pulse" />
                ) : (
                  <RecordsKanbanSkeleton />
                )}
              </div>
            ) : loadError ? (
              <div role="alert" className="p-8">
                <p>{loadError}</p>
                <Button variant="outline" onClick={() => void refreshData()}>{t("common.retry") || "Retry"}</Button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                  icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                  title={t("records.empty.title") || "No records found"}
                  description={t("records.empty.desc") || "Create a new record or adjust your filters."}
                  action={
                    <Button onClick={hasFilters ? clearFilters : () => handleCreateRecord()}>
                      {hasFilters ? t("records.sidebar.allRecords") : (t("records.new") || "New Record")}
                    </Button>
                  }
                  variant="fancy"
                />
              </div>
            ) : (
              <div className={cn("min-h-full min-w-0 flex flex-col", viewType === "graph" ? "" : viewType === "kanban" ? "py-4 md:py-8 px-4" : "p-4 md:p-8")}>
                {viewType === "table" ? (
                  <RecordsTable
                    records={filteredRecords.slice((visiblePage - 1) * itemsPerPage, visiblePage * itemsPerPage)}
                    currentPage={visiblePage}
                    itemsPerPage={itemsPerPage}
                    totalRecords={filteredRecords.length}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}
                    onRecordClick={(record) => router.push(`/records/${record.id}`)}
                    categories={categories}
                    selectedRecords={selectedRecords}
                    onToggleRecordSelection={(id) => {
                      const next = new Set(selectedRecords)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      setSelectedRecords(next)
                    }}
                    groupBy={groupBy}
                  />
                ) : viewType === "calendar" ? (
                  <RecordsCalendar
                    records={filteredRecords}
                    onRecordClick={(record) => router.push(`/records/${record.id}`)}
                  />
                ) : viewType === "graph" ? (
                  <RecordsGraph
                    records={filteredRecords}
                    toolsOffsetLeft={
                      isMobile
                        ? 16
                        : (isLayoutCollapsed ? 92 : 268) + (!isSidebarCollapsed ? 319 : 0)
                    }
                  />
                ) : (
                  <RecordsKanban
                    records={filteredRecords}
                    sortBy={sortBy}
                    onUpdateRecordStatus={async (recordId, newStatus) => {
                      // Only update status if grouping by status
                      if (groupBy === "status") {
                        const result = await updateLoadedRecord(recordId, { status: newStatus });
                        if (result.error) throw new Error(result.error);
                        refreshData();
                      } else if (groupBy === "category") {
                        const result = await updateLoadedRecord(recordId, { category_id: newStatus });
                        if (result.error) throw new Error(result.error);
                        refreshData();
                      }
                      // Note: team_member logic is handled inside RecordsKanban directly
                    }}
                    onRecordClick={(record) => router.push(`/records/${record.id}`)}
                    kanbanPagination={{}}
                    onLoadMore={() => {}}
                    totalCounts={{}}
                    selectedRecords={selectedRecords}
                    onToggleRecordSelection={(id) => {
                      const next = new Set(selectedRecords)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      setSelectedRecords(next)
                    }}
                    groupBy={groupBy}
                    categories={categories}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditorOpen && (
        <CategoryTemplateEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          category={editingCategory}
          categories={categories}
          onSave={handleSaveCategory}
          onDeleted={() => {
            setIsEditorOpen(false)
            setEditingCategory(null)
            setSelectedCategory("all")
            setSelectedRelation(null)
            setSelectedRecords(new Set())
            setCurrentPage(1)
            refreshData()
            toast.success("Collection moved to Trash")
          }}
        />
      )}

      {trashSiteId && trashSiteId === currentSite?.id && (
        <RecordsTrashDialog key={trashSiteId} siteId={trashSiteId}
          onClose={() => setTrashSiteId(null)} onRestored={refreshData} />
      )}

      {isCategorySelectOpen && (
        <Dialog open={isCategorySelectOpen} onOpenChange={setIsCategorySelectOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>{t("records.selectCategoryToCreate") || "Select Category"}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Select value={categoryToCreateIn} onValueChange={setCategoryToCreateIn}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("records.toast.selectCategory") || "Select a category"} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCategorySelectOpen(false)}>
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button 
                onClick={() => handleCreateRecord(categoryToCreateIn)} 
                disabled={isCreatingRecord || !categoryToCreateIn}
              >
                {isCreatingRecord ? <Loader className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("common.create") || "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
