
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"
import { Search } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { SavedListsPanel } from "./saved-lists-panel"
import type { PeopleWorkspace } from "./use-people-workspace"
import { PersonFilterFields } from "./person-filter-fields"
import { CompanyFilterFields } from "./company-filter-fields"
import { ActivityJobFilterFields } from "./activity-job-filter-fields"
import { FundingSignalFilterFields } from "./funding-signal-filter-fields"
export function PeopleSidebar({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    t,
    isSidebarCollapsed,
    sidebarLeft,
    peopleTab,
    setPeopleTab,
    showResultsOnMobile,
    error,
    loading,
    availableIcps,
    icpListLoading,
    icpListError,
    refreshIcps,
    savedSectionOpenDefaults,
    setSavedSectionOpenDefaults,
    setQuery,
    setIndustries,
    setPersonIndustriesExclude,
    setLocations,
    setEmployeeFrom,
    setEmployeeTo,
    setRevenueFrom,
    setRevenueTo,
    setPersonNameChips,
    setPersonNameInput,
    setPersonHeadlineChips,
    setPersonHeadlineInput,
    setJobTitleChips,
    setJobTitleInput,
    setSkills,
    setCompanies,
    setKeywords,
    setPersonLinkedinIds,
    setPersonLinkedinIdsInputText,
    setRoleDateSince,
    setRoleDateUntil,
    setRoleYearsOnPositionStart,
    setRoleYearsOnPositionEnd,
    setJobPostingTitleChips,
    setJobPostingTitleInput,
    setJobPostingDescriptionChips,
    setJobPostingDescriptionInput,
    setJobFeaturedDateFrom,
    setJobFeaturedDateTo,
    setIncludeRemote,
    setIsJobActive,
    setJobLocations,
    setJobLocationsExclude,
    setFundingRange,
    setFundingType,
    setFundingDateRange,
    setFundingRangeTouched,
    setTechnologies,
    setOrgDomains,
    setOrgDomainsInputText,
    setOrgBulkDomain,
    setOrgDescription,
    setOrgLocations,
    setOrgIndustries,
    setOrgIndustriesExclude,
    setOrgLinkedinIds,
    setOrgLinkedinIdsInputText,
    setOrgFoundedRange,
    setSimpleEventSource,
    setSimpleEventReason,
    setSimpleEventDateRange,
    setRequireDeal,
    setRequireSiteVisit,
    handleLoadIcp,
    handleDeleteIcp,
    handleOpenEditIcp,
    onClickSearch,
  } = workspace
  return (
    <div className={cn(
      "fixed transition-all duration-200 ease-in-out z-10 bg-background md:bg-transparent",
      isSidebarCollapsed ? "w-0 opacity-0" : "w-full md:w-[319px] opacity-100",
      showResultsOnMobile ? "hidden md:block" : "block"
    )} style={{ left: sidebarLeft, top: "var(--topbar-height, 64px)", height: "calc(100vh - var(--topbar-height, 64px))" }}>
      <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r relative flex flex-col">
        {/* Tab selector - min height matches main toolbar (71px) */}
        <div className="flex-shrink-0 min-h-[71px] flex items-center p-3 border-b border-border/50">
          <Tabs value={peopleTab} onValueChange={(v) => setPeopleTab(v as "search" | "saved")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="search" className="text-xs">{t('people.tabs.search') || 'Search people'}</TabsTrigger>
              <TabsTrigger value="saved" className="text-xs">{t('people.tabs.saved') || 'Saved lists'}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {/* Content */}
        <div className="h-full overflow-hidden flex flex-col min-h-0">
          <div className={cn("h-full overflow-auto p-4 flex-1", peopleTab === "saved" ? "flex flex-col pb-4" : "space-y-4 pb-[110px]")}>
            {peopleTab === "saved" && (
            <div className={cn("flex flex-col min-h-0", availableIcps.length === 0 && !icpListLoading ? "flex-1" : "space-y-3")}>
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex-shrink-0" style={{ fontSize: '10.8px' }}>📋 {t('people.saved.title') || 'Saved Lists'}</h3>
              <SavedListsPanel
                lists={availableIcps}
                loading={icpListLoading}
                error={icpListError}
                onRetry={refreshIcps}
                onLoad={handleLoadIcp}
                onDelete={handleDeleteIcp}
                onEdit={handleOpenEditIcp}
                t={t}
                openSections={savedSectionOpenDefaults}
                onSectionOpenChange={(status, open) => setSavedSectionOpenDefaults(previous => ({ ...previous, [status]: open }))}
              />
            </div>
            )}
            {peopleTab === "search" && (
            <>
            <PersonFilterFields workspace={workspace} />
            <CompanyFilterFields workspace={workspace} />
            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>🎯 {t('people.filters.buyingIntent') || 'Buying Intent'}</h3>
              <div className="space-y-3">
              <ActivityJobFilterFields workspace={workspace} />
              <FundingSignalFilterFields workspace={workspace} />
              </div>
            </div>
            </>
            )}
            {/* bottom action bar handles actions */}
          </div>
          {/* Bottom action bar - only in Search people tab */}
          {peopleTab === "search" && (
          <div
            className={cn(
              "absolute bottom-0 left-0 w-full border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 h-[71px]",
              isSidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
            )}
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
          >
            <div className="h-full w-full flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={()=>{ setQuery(""); setIndustries([]); setPersonIndustriesExclude([]); setLocations([]); setEmployeeFrom(""); setEmployeeTo(""); setRevenueFrom(""); setRevenueTo(""); setPersonNameChips([]); setPersonNameInput(""); setPersonHeadlineChips([]); setPersonHeadlineInput(""); setJobTitleChips([]); setJobTitleInput(""); setSkills([]); setCompanies([]); setKeywords([]); setTechnologies([]); setJobPostingTitleChips([]); setJobPostingTitleInput(""); setJobPostingDescriptionChips([]); setJobPostingDescriptionInput(""); setJobFeaturedDateFrom(undefined); setJobFeaturedDateTo(undefined); setIncludeRemote(false); setIsJobActive(false); setJobLocations([]); setJobLocationsExclude([]); setFundingDateRange({}); setFundingType(""); setFundingRange([0, 0]); setFundingRangeTouched(false); setPersonLinkedinIds([]); setPersonLinkedinIdsInputText(""); setOrgDomains([]); setOrgDomainsInputText(""); setOrgBulkDomain(""); setOrgDescription(""); setOrgLocations([]); setOrgIndustries([]); setOrgIndustriesExclude([]); setOrgLinkedinIds([]); setOrgLinkedinIdsInputText(""); setOrgFoundedRange({}); setSimpleEventSource(null); setSimpleEventReason(null); setSimpleEventDateRange({}); setRequireDeal(false); setRequireSiteVisit(false); setRoleDateSince(undefined); setRoleDateUntil(undefined); setRoleYearsOnPositionStart(""); setRoleYearsOnPositionEnd(""); }}
              >
                {t('people.search.clear') || 'Clear'}
              </Button>
            <Button className="flex-1 h-10 gap-2 !min-w-0" onClick={onClickSearch} disabled={loading}>
                <Search className="h-4 w-4" />
              {loading ? (t('people.search.searching') || 'Searching…') : (t('people.search.btnShort') || 'Search')}
              </Button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
