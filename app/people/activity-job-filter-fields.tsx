
import { X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Switch } from "@/app/components/ui/switch"
import { lookupFetcher } from "./finder-api"
import { LookupChipsInput } from "./lookup-chips-input"
import { CollapsibleField } from "./collapsible-field"
import { ChipsInput } from "./chips-input"
import type { PeopleWorkspace } from "./use-people-workspace"

export function ActivityJobFilterFields({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    lookupDraftSetters,
    t,
    currentSite,
    jobPostingTitleChips,
    setJobPostingTitleChips,
    jobPostingTitleInput,
    setJobPostingTitleInput,
    jobPostingDescriptionChips,
    setJobPostingDescriptionChips,
    jobPostingDescriptionInput,
    setJobPostingDescriptionInput,
    jobFeaturedDateFrom,
    setJobFeaturedDateFrom,
    jobFeaturedDateTo,
    setJobFeaturedDateTo,
    includeRemote,
    setIncludeRemote,
    isJobActive,
    setIsJobActive,
    jobLocations,
    setJobLocations,
    jobLocationsExclude,
    setJobLocationsExclude,
    requireDeal,
    setRequireDeal,
    requireSiteVisit,
    setRequireSiteVisit,
    sectionOpenDefaults,
  } = workspace
  return (
<>
                <CollapsibleField
                  title={t('people.filters.crm.title') || 'CRM & site activity'}
                  defaultOpen={sectionOpenDefaults.crmActivity}
                  countBadge={(requireDeal ? 1 : 0) + (requireSiteVisit ? 1 : 0)}
                  onClear={() => {
                    setRequireDeal(false)
                    setRequireSiteVisit(false)
                  }}
                >
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('people.filters.crm.scopeHint') || 'Uses your selected site. Requires an active site.'}
                  </p>
                  <div className="space-y-2">
                    <div className="py-1.5 flex items-center justify-between gap-2">
                      <label htmlFor="filter-require-deal" className="text-sm">
                        {t('people.filters.crm.deals') || 'Deals'}
                      </label>
                      <Switch
                        id="filter-require-deal"
                        checked={requireDeal}
                        onCheckedChange={setRequireDeal}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {t('people.filters.crm.dealsHint') || 'Only people associated with a deal for this site'}
                    </p>
                    <div className="py-1.5 flex items-center justify-between gap-2 pt-1">
                      <label htmlFor="filter-require-site-visit" className="text-sm">
                        {t('people.filters.crm.siteVisits') || 'Site visits'}
                      </label>
                      <Switch
                        id="filter-require-site-visit"
                        checked={requireSiteVisit}
                        onCheckedChange={setRequireSiteVisit}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {t('people.filters.crm.siteVisitsHint') || 'Only people with recorded visits to this site'}
                    </p>
                  </div>
                </CollapsibleField>
                <CollapsibleField title={t('people.filters.jobPostings.title') || "Job Postings"} defaultOpen={sectionOpenDefaults.jobPostings}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.jobPostings.titleLabel') || 'Title'}</p>
                      <p className="text-xs text-muted-foreground mb-2">{t('people.filters.jobTitle.help') || 'Use "quotation marks" for exact matches. Press Enter to add as chip.'}</p>
                      <ChipsInput
                        values={jobPostingTitleChips}
                        onChange={setJobPostingTitleChips}
                        placeholder={t('people.filters.name.search') || "Search"}
                        inputValue={jobPostingTitleInput}
                        onInputChange={setJobPostingTitleInput}
                      />
                    </div>
                    <div className="flex flex-col items-start space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.jobTitle.desc') || 'Description'}</p>
                      <ChipsInput
                        values={jobPostingDescriptionChips}
                        onChange={setJobPostingDescriptionChips}
                        placeholder={t('people.filters.jobTitle.desc') || "Description"}
                        inputValue={jobPostingDescriptionInput}
                        onInputChange={setJobPostingDescriptionInput}
                      />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">{t('people.filters.jobPostings.dateSince') || 'Job featured date since'}</p>
                          {!jobFeaturedDateFrom && (
                            <Badge variant="outline" className="text-xs">{t('people.filters.notSet') || 'Not set'}</Badge>
                          )}
                          {jobFeaturedDateFrom && (
                            <button
                              type="button"
                              onClick={() => setJobFeaturedDateFrom(undefined)}
                              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                              aria-label={t('people.filters.clearDate') || 'Clear date'}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <DatePicker
                          date={jobFeaturedDateFrom || new Date()}
                          setDate={(date) => setJobFeaturedDateFrom(date)}
                          className="w-full"
                          mode="default"
                          placeholder={t('people.filters.selectStartDate') || "Select start date"}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">{t('people.filters.jobPostings.dateUntil') || 'Job featured date until'}</p>
                          {!jobFeaturedDateTo && (
                            <Badge variant="outline" className="text-xs">{t('people.filters.notSet') || 'Not set'}</Badge>
                          )}
                          {jobFeaturedDateTo && (
                            <button
                              type="button"
                              onClick={() => setJobFeaturedDateTo(undefined)}
                              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Clear date"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <DatePicker
                          date={jobFeaturedDateTo || new Date()}
                          setDate={(date) => setJobFeaturedDateTo(date)}
                          className="w-full"
                          mode="default"
                          placeholder={t('people.filters.selectEndDate')}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="py-1.5 flex items-center justify-between gap-2">
                        <label htmlFor="include-remote" className="text-sm">Include Remote</label>
                        <Switch id="include-remote" checked={includeRemote} onCheckedChange={setIncludeRemote} />
                      </div>
                      <div className="py-1.5 flex items-center justify-between gap-2">
                        <label htmlFor="job-active" className="text-sm">Active</label>
                        <Switch id="job-active" checked={isJobActive} onCheckedChange={setIsJobActive} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Locations</p>
                      <LookupChipsInput
                        values={jobLocations}
                        onChange={setJobLocations}
                        onTextChange={lookupDraftSetters.job_post_locations}
                        placeholder="Search locations"
                        fetcher={(q) => lookupFetcher('locations', q, currentSite?.id)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Locations Exclude</p>
                      <LookupChipsInput
                        values={jobLocationsExclude}
                        onChange={setJobLocationsExclude}
                        onTextChange={lookupDraftSetters.job_post_locations_exclude}
                        placeholder="Search locations to exclude"
                        fetcher={(q) => lookupFetcher('locations', q, currentSite?.id)}
                      />
                    </div>
                  </div>
                </CollapsibleField>
</>
  )
}
