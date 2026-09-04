"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLayout } from "@/app/context/LayoutContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { useAutoCollapseSidebar } from "@/app/hooks/use-auto-collapse-sidebar"
import { cn } from "@/lib/utils"
import { ControlCenterHeader } from "@/app/control-center/components/ControlCenterHeader"
import { ViewSelector } from "@/app/components/view-selector"
import { SearchInput } from "@/app/components/ui/search-input"
import { Button } from "@/app/components/ui/button"
import { PlusCircle, ClipboardList } from "@/app/components/ui/icons"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Badge } from "@/app/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { ListOrdered, Check, ChevronDown, Loader, Tag, Trash2, Folder } from "@/app/components/ui/icons"
import { subDays, isWithinInterval, parseISO, startOfDay, endOfDay } from "date-fns"
import { useRecordsData } from "./hooks/useRecordsData"
import { RecordsSidebar } from "./components/RecordsSidebar"

// Import the new specific Record views
import { RecordsTable, RecordsTableSkeleton } from "./components/RecordsTable"
import { RecordsKanban, RecordsKanbanSkeleton } from "./components/RecordsKanban"
import { RecordsCalendar, RecordsCalendarSkeleton } from "./components/RecordsCalendar"
import { RecordsGraph } from "./components/RecordsGraph"

import { CategoryTemplateEditor } from "./components/CategoryTemplateEditor"
import { createRecordCategory, updateRecordCategory, RecordCategory, createRecord, deleteRecord, updateRecord } from "./actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

export default function RecordsPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAutoCollapseSidebar()

  const { categories, records, isLoading, refreshData } = useRecordsData(currentSite?.id)
  
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedRelation, setSelectedRelation] = useState<{ fieldName: string, targetId: string } | null>(null)
  const [recordSearchQuery, setRecordSearchQuery] = useState("")
  const [viewType, setViewType] = useState<"table" | "kanban" | "calendar" | "graph">("table")
  const [groupBy, setGroupBy] = useState<"status" | "category" | "date" | "team_member">("status")
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title_asc" | "title_desc">("newest")
  const [dateRange, setDateRange] = useState({
    startDate: startOfDay(subDays(new Date(), 30)),
    endDate: endOfDay(new Date())
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)
  const [isCategorySelectOpen, setIsCategorySelectOpen] = useState(false)
  const [categoryToCreateIn, setCategoryToCreateIn] = useState<string>("")
  const [isCreatingRecord, setIsCreatingRecord] = useState(false)

  const handleBulkDelete = async () => {
    if (!confirm(t("records.bulk.confirmDelete", { count: selectedRecords.size }) || `Are you sure you want to delete ${selectedRecords.size} records?`)) return
    
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedRecords).map(id => deleteRecord(id))
      await Promise.all(promises)
      
      setSelectedRecords(new Set())
      toast.success(t("records.bulk.deleted", { count: selectedRecords.size }) || `${selectedRecords.size} records deleted successfully`)
      refreshData()
    } catch (error) {
      console.error("Error in bulk delete:", error)
      toast.error(t("records.bulk.deleteError") || "Failed to delete some records")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedRecords).map(id => updateRecord(id, { status: newStatus }))
      await Promise.all(promises)
      
      setSelectedRecords(new Set())
      toast.success(t("records.bulk.statusUpdated", { count: selectedRecords.size }) || `Status updated for ${selectedRecords.size} records`)
      refreshData()
    } catch (error) {
      console.error("Error in bulk status change:", error)
      toast.error(t("records.bulk.statusError") || "Failed to update status for some records")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkCategoryChange = async (newCategoryId: string) => {
    setIsBulkActionLoading(true)
    try {
      const promises = Array.from(selectedRecords).map(id => updateRecord(id, { category_id: newCategoryId }))
      await Promise.all(promises)
      
      setSelectedRecords(new Set())
      toast.success(t("records.bulk.categoryUpdated", { count: selectedRecords.size }) || `Category updated for ${selectedRecords.size} records`)
      refreshData()
    } catch (error) {
      console.error("Error in bulk category change:", error)
      toast.error(t("records.bulk.categoryError") || "Failed to update category for some records")
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<RecordCategory | null>(null)

  // Layout calculations
  const [sidebarLeft, setSidebarLeft] = useState('256px')
  useEffect(() => {
    setSidebarLeft(isMobile ? '0px' : (isLayoutCollapsed ? '64px' : '256px'))
  }, [isLayoutCollapsed, isMobile])

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
  const filteredRecords = records.filter(r => {
    if (selectedCategory !== "all" && r.category_id !== selectedCategory) return false
    if (selectedRelation) {
      if (r.relations?.[selectedRelation.fieldName] !== selectedRelation.targetId) return false
    }
    if (recordSearchQuery && !r.title.toLowerCase().includes(recordSearchQuery.toLowerCase())) return false
    
    // Date range filter
    if (r.created_at) {
      try {
        const recordDate = parseISO(r.created_at)
        if (!isWithinInterval(recordDate, { start: dateRange.startDate, end: dateRange.endDate })) {
          return false
        }
      } catch (e) {
        console.error("Error parsing date", e)
      }
    }
    return true
  }).sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    
    if (sortBy === "newest") return dateB - dateA
    if (sortBy === "oldest") return dateA - dateB
    if (sortBy === "title_asc") return a.title.localeCompare(b.title)
    if (sortBy === "title_desc") return b.title.localeCompare(a.title)
    return 0
  })

  // Handlers
  const handleEditTemplate = (category?: RecordCategory) => {
    setEditingCategory(category || null)
    setIsEditorOpen(true)
  }

  const handleSaveCategory = async (data: any) => {
    if (!currentSite?.id) return
    if (editingCategory) {
      await updateRecordCategory(editingCategory.id, data)
      toast.success(t("records.toast.templateUpdated") || "Template updated")
    } else {
      await createRecordCategory({ ...data, site_id: currentSite.id })
      toast.success(t("records.toast.templateCreated") || "Template created")
    }
    refreshData()
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
          }}
          isCollapsed={isSidebarCollapsed}
          onEditTemplate={handleEditTemplate}
          onCreateCategory={() => handleEditTemplate()}
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
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="rounded-full px-2 py-0">
                    {selectedRecords.size} {t("records.bulk.selected") || "selected"}
                  </Badge>
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {t("records.bulk.chooseAction") || "Choose bulk action"}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedRecords(new Set())} disabled={isBulkActionLoading}>
                      {t("records.bulk.cancel") || "Cancel"}
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" disabled={isBulkActionLoading}>
                          <Tag className="h-4 w-4" />
                          <span className="hidden sm:inline">{t("records.bulk.changeStatus") || "Change Status"}</span>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {["draft", "published", "archived"].map(status => (
                          <DropdownMenuItem key={status} onClick={() => handleBulkStatusChange(status)} className="capitalize">
                            {t(`status.${status}`) || status}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" disabled={isBulkActionLoading}>
                          <Folder className="h-4 w-4" />
                          <span className="hidden sm:inline">{t("records.bulk.changeCategory") || "Change Category"}</span>
                          <ChevronDown className="h-3 w-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {categories.map(category => (
                          <DropdownMenuItem key={category.id} onClick={() => handleBulkCategoryChange(category.id)}>
                            {category.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4 text-destructive hover:text-destructive" onClick={handleBulkDelete} disabled={isBulkActionLoading}>
                      {isBulkActionLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      <span className="hidden sm:inline">{t("records.bulk.delete") || "Delete"}</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Tabs value={groupBy} onValueChange={(val: any) => setGroupBy(val)} className="hidden md:block">
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
                    onChange={(e) => setRecordSearchQuery(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
              )
            }
            rightContent={
              selectedRecords.size > 0 ? null : (
                <div className="flex items-center gap-2">
                  <div className="md:hidden">
                    <Select value={groupBy} onValueChange={(val: any) => setGroupBy(val)}>
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
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-9 gap-2 rounded-full px-4" title={t("records.sort.by") || "Sort by"}>
                        <ListOrdered className="h-4 w-4" />
                        <span className="hidden sm:inline font-normal">
                          {sortBy === "newest"
                            ? (t("records.sort.newest") || "Newest")
                            : sortBy === "oldest"
                              ? (t("records.sort.oldest") || "Oldest")
                              : sortBy === "title_asc"
                                ? (t("records.sort.titleAsc") || "Title (A-Z)")
                                : (t("records.sort.titleDesc") || "Title (Z-A)")}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("newest")}>
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "newest" ? "opacity-100" : "opacity-0")} />
                        {t("records.sort.newest") || "Newest"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("oldest")}>
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "oldest" ? "opacity-100" : "opacity-0")} />
                        {t("records.sort.oldest") || "Oldest"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("title_asc")}>
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "title_asc" ? "opacity-100" : "opacity-0")} />
                        {t("records.sort.titleAsc") || "Title (A-Z)"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={() => setSortBy("title_desc")}>
                        <Check className={cn("mr-2 h-4 w-4", sortBy === "title_desc" ? "opacity-100" : "opacity-0")} />
                        {t("records.sort.titleDesc") || "Title (Z-A)"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <CalendarDateRangePicker 
                    onRangeChange={(start, end) => setDateRange({ startDate: start, endDate: end })} 
                    initialStartDate={dateRange.startDate}
                    initialEndDate={dateRange.endDate}
                  />

                  <ViewSelector
                    currentView={viewType}
                    onViewChange={(view) => setViewType(view as any)}
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
            ) : filteredRecords.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState 
                  icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                  title={t("records.empty.title") || "No records found"}
                  description={t("records.empty.desc") || "Create a new record or adjust your filters."}
                  action={
                    <Button onClick={() => handleCreateRecord()}>
                      {t("records.new") || "New Record"}
                    </Button>
                  }
                  variant="fancy"
                />
              </div>
            ) : (
              <div className={cn("min-h-full min-w-0 flex flex-col", viewType === "graph" ? "" : viewType === "kanban" ? "py-4 md:py-8 px-4" : "p-4 md:p-8")}>
                {viewType === "table" ? (
                  <RecordsTable
                    records={filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
                    currentPage={currentPage}
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
                        const { updateRecord } = await import("./actions");
                        await updateRecord(recordId, { status: newStatus });
                        refreshData();
                      } else if (groupBy === "category") {
                        const { updateRecord } = await import("./actions");
                        await updateRecord(recordId, { category_id: newStatus });
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
        />
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
