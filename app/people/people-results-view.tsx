
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Card } from "@/app/components/ui/card"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Pagination } from "@/app/components/ui/pagination"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SidebarToggle } from "@/app/control-center/components/SidebarToggle"
import { Search, ChevronLeft } from "@/app/components/ui/icons"
import { DEFAULT_PAGE_SIZE } from "./finder-request-types"
import type { PeopleWorkspace } from "./use-people-workspace"
import { PeopleResultsTable } from "./people-results-table"
export function PeopleResultsView({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    isArtifact,
    t,
    isLayoutCollapsed,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    peopleTab,
    showResultsOnMobile,
    setShowResultsOnMobile,
    currentPage,
    itemsPerPage,
    pageJump,
    setPageJump,
    searchResults,
    totalResults,
    loading,
    addingToLeads,
    selectedPersonIds,
    isEnriching,
    setIsConfirmModalOpen,
    handleAddToLeads,
    onPageChange,
    isEmptyView,
  } = workspace
  return (

<>
      {/* Main content: hidden on mobile step 1, full-screen on step 2 */}
      <div
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out min-w-0 min-h-0 fixed right-0 top-[var(--topbar-height,64px)] bottom-0",
          !showResultsOnMobile ? "hidden md:flex" : "flex"
        )}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth >= 768
            ? `calc(100% - ${isArtifact ? 0 : (isLayoutCollapsed ? 64 : 256)}px - ${isSidebarCollapsed ? 0 : 319}px)`
            : '100%',
          left: typeof window !== 'undefined' && window.innerWidth >= 768
            ? `${(isArtifact ? 0 : (isLayoutCollapsed ? 64 : 256)) + (isSidebarCollapsed ? 0 : 319)}px`
            : '0px'
        }}
      >
        <div className="w-full z-[50]">
          <StickyHeader
            className="transition-all duration-300 ease-in-out pl-0 md:pl-4 !top-[var(--topbar-height,64px)] !fixed"
            style={{
              width: typeof window !== 'undefined' && window.innerWidth >= 768
                ? `calc(100% - ${isArtifact ? 0 : (isLayoutCollapsed ? 64 : 256)}px - ${isSidebarCollapsed ? 0 : 319}px)`
                : '100%',
              left: typeof window !== 'undefined' && window.innerWidth >= 768
                ? `${(isArtifact ? 0 : (isLayoutCollapsed ? 64 : 256)) + (isSidebarCollapsed ? 0 : 319)}px`
                : '0px'
            }}
          >
            <div className="flex w-full items-center pl-2">
              <SidebarToggle
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden md:flex z-50 mr-4 shrink-0"
              />
              <div className="transition-all duration-300 ease-in-out w-full pr-4 md:pr-12">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1.5 text-sm md:!hidden"
                    onClick={() => setShowResultsOnMobile(false)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="h-9 !hidden md:!flex" onClick={handleAddToLeads} disabled={totalResults === 0 || loading || addingToLeads}>
                    {addingToLeads ? 'Processing...' : `Enrich ${(totalResults || 0).toLocaleString()} Leads`}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-9 hidden md:flex"
                    disabled={selectedPersonIds.length === 0 || isEnriching}
                    onClick={() => setIsConfirmModalOpen(true)}
                  >
                    {isEnriching ? 'Saving...' : `Enrich & prospect selected${selectedPersonIds.length > 0 ? ` (${selectedPersonIds.length})` : ''}`}
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
                  ) : (
                    <>
<PeopleResultsTable workspace={workspace} />

                {peopleTab === "search" && (
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
                                  const next = Math.min(Math.max(1, isNaN(value) ? 1 : value), maxPages)
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
                                const next = Math.min(Math.max(1, isNaN(value) ? 1 : value), maxPages)
                                onPageChange(next)
                                setPageJump('')
                              }}
                            >
                              Go
                            </Button>
                          </div>
                        </div>
                </div>
                )}
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
