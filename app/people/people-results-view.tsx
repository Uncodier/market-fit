import { useEffect, useMemo, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Card } from "@/app/components/ui/card"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Pagination } from "@/app/components/ui/pagination"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SidebarToggle } from "@/app/control-center/components/SidebarToggle"
import { Search, ChevronLeft, Loader } from "@/app/components/ui/icons"
import { DEFAULT_PAGE_SIZE } from "./finder-request-types"
import type { PeopleWorkspace } from "./use-people-workspace"
import { PeopleResultsTable } from "./people-results-table"
import { useSavedListMembers } from "./use-saved-list-members"
import { usePeopleResultGroups } from "./use-people-result-groups"
import { SAVED_LIST_PAGE_SIZE } from "./saved-list-types"
import { SavedListBreadcrumb } from "./saved-list-breadcrumb"
import { SavedListStatus } from "./saved-list-status"
export function PeopleResultsView({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    isArtifact,
    t,
    isLayoutCollapsed,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    showResultsOnMobile,
    setShowResultsOnMobile,
    pageJump,
    setPageJump,
    selectedPersonIds,
    isEnriching,
    openEnrichConfirmation,
    selectionLists,
  } = workspace
  const openList = workspace.selectedList?.siteId === workspace.currentSite?.id ? workspace.selectedList : null
  const saved = useSavedListMembers(openList)
  const selectedList = workspace.showingSavedSearch ? null : openList
  const autoRun = Boolean(selectedList?.query && saved.snapshot?.total === 0)
  const { runSavedSearch } = workspace
  useEffect(() => {
    if (autoRun) runSavedSearch()
  }, [autoRun, runSavedSearch])
  const listName = openList && (workspace.availableIcps?.find(list => list.id === openList.id)?.name || saved.snapshot?.name || 'Saved list')
  useEffect(() => {
    if (!listName) return
    const update = (name: string | null) => window.dispatchEvent(new CustomEvent('people:list-breadcrumb', { detail: name }))
    update(listName)
    return () => { update(null) }
  }, [listName])
  const savedResults = useMemo(() => saved.snapshot?.members.map(member => member.result) ?? [], [saved.snapshot])
  const savedGroups = usePeopleResultGroups({ searchResults: savedResults, setExpandedGroups: workspace.setExpandedGroups })
  const processingByPerson = useMemo(() => selectedList ? new Map(saved.snapshot?.members.map(member => [member.personId, member])) : undefined,
    [selectedList, saved.snapshot])
  const currentPage = selectedList ? saved.page : workspace.currentPage
  const itemsPerPage = selectedList ? SAVED_LIST_PAGE_SIZE : workspace.itemsPerPage
  const searchResults = selectedList ? savedResults : workspace.searchResults
  const totalResults = selectedList ? saved.snapshot?.total ?? 0 : workspace.totalResults
  const loading = selectedList ? saved.loading || autoRun : workspace.loading
  const onPageChange = (page: number) => {
    if (selectedList) {
      if (page === currentPage) return
      workspace.resetResultSelection()
      saved.onPageChange(page)
    } else workspace.onPageChange(page)
  }
  const isEmptyView = !openList && workspace.isEmptyView
  const tableWorkspace = selectedList ? { ...workspace, groupedResults: savedGroups.groupedResults,
    toggleGroup: savedGroups.toggleGroup, error: saved.error,
    addedPersonIds: new Set(saved.snapshot?.members.filter(member => member.lead).map(member => member.personId)) } : workspace
  const closeList = () => {
    workspace.setSelectedList(null)
    workspace.resetResultSelection()
    workspace.setPeopleTab('search')
    setIsSidebarCollapsed(false)
    setShowResultsOnMobile(false)
  }
  useEffect(() => {
    if (!openList || isArtifact) return
    window.addEventListener('people:return-to-search', closeList)
    return () => window.removeEventListener('people:return-to-search', closeList)
  }, [openList, isArtifact, closeList])
  const resultsLeft = (isArtifact ? 0 : (isLayoutCollapsed ? 64 : 256)) + (isSidebarCollapsed ? 0 : 319)
  const sidebarToggle = <SidebarToggle
    isCollapsed={isSidebarCollapsed}
    onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
    ariaLabelShow="Show filters"
    ariaLabelHide="Hide filters"
    className="hidden md:flex z-50 mr-4 shrink-0"
  />
  return (

<>
      {/* Main content: hidden on mobile step 1, full-screen on step 2 */}
      <div
        data-testid="people-results"
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out min-w-0 min-h-0 fixed right-0 left-0 md:left-[var(--people-results-left)] top-[var(--topbar-height,64px)] bottom-0",
          !showResultsOnMobile ? "hidden md:flex" : "flex"
        )}
        style={{ '--people-results-left': `${resultsLeft}px` } as CSSProperties}
      >
        <div className="w-full z-[50]">
          <StickyHeader
            className="transition-all duration-300 ease-in-out pl-0 md:pl-4 !top-[var(--topbar-height,64px)] !fixed left-0 w-full md:left-[var(--people-results-left)] md:w-[calc(100%_-_var(--people-results-left))]"
          >
            <div className="flex w-full min-w-0 items-center pl-2">
              {sidebarToggle}
              <div className="transition-all duration-300 ease-in-out w-full min-w-0 pr-4 md:pr-12 overflow-x-auto">
                <div className="flex min-w-max items-center justify-between">
                  <div className="flex shrink-0 items-center gap-2">
                  {isArtifact && listName && <SavedListBreadcrumb root={t('people.tabs.search') || 'Search people'} name={listName} onReturn={closeList} />}
                  {!openList && <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1.5 text-sm md:!hidden"
                    onClick={() => setShowResultsOnMobile(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>}
                </div>
                <div className="flex items-center gap-2" data-toolbar-icon-actions="off">
                  <Button variant="secondary" className="h-9 gap-2 px-4 !hidden md:!flex"
                    onClick={() => selectionLists.open('add')}
                    disabled={!selectedPersonIds.length || loading || saved.identityChanged || selectionLists.pending || isEnriching}>
                    Add to list{selectedPersonIds.length > 0 ? ` (${selectedPersonIds.length})` : ''}
                  </Button>
                  <Button variant="secondary" className="h-9 gap-2 px-4 !hidden md:!flex"
                    onClick={() => selectionLists.open('create')}
                    disabled={!selectedPersonIds.length || loading || saved.identityChanged || selectionLists.pending || isEnriching}>
                    Create list{selectedPersonIds.length > 0 ? ` (${selectedPersonIds.length})` : ''}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 gap-2 px-4 hidden md:flex"
                    disabled={selectedPersonIds.length === 0 || loading || saved.identityChanged || isEnriching || selectionLists.pending}
                    onClick={openEnrichConfirmation}
                  >
                    {isEnriching && <Loader className="h-4 w-4" />}
                    {isEnriching ? 'Enriching...' : `Enrich selected${selectedPersonIds.length > 0 ? ` (${selectedPersonIds.length})` : ''}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </StickyHeader>
        </div>
        <div className={cn("flex-1 min-h-0 min-w-0 w-full relative pt-[71px] flex flex-col bg-muted/30 transition-colors duration-300 ease-in-out", isEmptyView ? "overflow-visible" : "overflow-y-auto")} style={isEmptyView ? { height: 'calc(100vh - var(--topbar-height, 64px) - 71px)' } : undefined}>
          <div
            className={cn("transition-all duration-300 ease-in-out flex-1 flex flex-col min-h-full", isEmptyView ? "" : "p-8 space-y-4")}
          >
            {isEmptyView ? (
              <EmptyState
                variant="fancy"
                icon={<Search />}
                title="Find the right people"
                description="Use the filters on the left and click Search to discover matching people."
                className="min-h-full"
              />
            ) : (
            <Card>
              {selectedList && saved.snapshot && <div className="space-y-3 rounded-t-[inherit] border-b bg-muted/20 px-4 py-3 sm:px-6">
                <SavedListStatus snapshot={saved.snapshot} t={t} />
                {selectedList.query && !autoRun && <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={workspace.runSavedSearch}>Run saved search</Button>
                  <span className="text-xs text-muted-foreground">Runs the original filters and may use search credits.</span>
                </div>}
              </div>}
              <div>
                  {loading ? (
                    <>
                      <div className="divide-y">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className="flex items-center px-6 py-3 gap-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-64" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between px-6 py-4 border-t">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-72" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-8 w-8 rounded-md" />
                          ))}
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </div>
                    </>
                  ) : workspace.showingSavedSearch && !searchResults.length ? <div className="p-6 text-sm" role={workspace.error ? 'alert' : 'status'}>
                    {workspace.error || 'No people match this saved search.'}
                  </div> : selectedList && saved.error ? <div role="alert" className="p-6 space-y-3">
                    <p>{saved.error}</p>
                    {!saved.identityChanged && <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={saved.refresh}>Retry</Button>
                      {currentPage > 1 && <Button variant="ghost" onClick={() => onPageChange(1)}>Return to first page</Button>}
                    </div>}
                  </div> : selectedList && searchResults.length === 0 ? <div className="p-6 text-sm text-muted-foreground">
                    {totalResults && currentPage > 1 ? <Button variant="outline" onClick={() => onPageChange(1)}>Return to first page</Button> : 'No selected people in this list.'}
                  </div> : (
                    <>
<PeopleResultsTable workspace={tableWorkspace} processingByPerson={processingByPerson} />

                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                            {totalResults > 0 ? (
                              <>
                                Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, totalResults).toLocaleString()}</span> {t('people.table.pagination.to') || 'to'} <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + (searchResults?.length || 0), totalResults).toLocaleString()}</span> {t('people.table.pagination.of') || 'of'} <span className="font-medium">{(totalResults || 0).toLocaleString()}</span> {t('people.table.pagination.people') || 'people'}
                              </>
                            ) : (t('people.table.pagination.noResults') || 'No results')}
                    </p>
                  </div>
                        <div className="flex items-center gap-3">
                          <Pagination currentPage={currentPage} totalPages={Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))} onPageChange={onPageChange} disabled={loading} />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))}
                              placeholder="Go to"
                              className="h-8 w-[88px]"
                              value={pageJump}
                              onChange={(e) => setPageJump(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const value = Number(pageJump)
                                  const maxPages = Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))
                                 const next = Math.min(Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1), maxPages)
                                  onPageChange(next)
                                  setPageJump('')
                                }
                              }}
                              aria-label="Go to page"
                            />
                            <Button
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                const value = Number(pageJump)
                                const maxPages = Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))
                                 const next = Math.min(Math.max(1, Number.isFinite(value) ? Math.trunc(value) : 1), maxPages)
                                onPageChange(next)
                                setPageJump('')
                              }}
                            >
                              Go
                            </Button>
                          </div>
                        </div>
                </div>
                    </>
                  )}
              </div>
            </Card>
            )}
          </div>
        </div>
      </div>
</>
  )
}
