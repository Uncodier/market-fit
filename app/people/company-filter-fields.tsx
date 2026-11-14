
import { Input } from "@/app/components/ui/input"
import { X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { lookupFetcher } from "./finder-api"
import { LookupChipsInput } from "./lookup-chips-input"
import { CollapsibleField } from "./collapsible-field"
import { ChipsInput } from "./chips-input"
import type { PeopleWorkspace } from "./use-people-workspace"

export function CompanyFilterFields({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    lookupDraftSetters,
    t,
    currentSite,
    employeeFrom,
    setEmployeeFrom,
    employeeTo,
    setEmployeeTo,
    revenueFrom,
    setRevenueFrom,
    revenueTo,
    setRevenueTo,
    domainRankFrom,
    setDomainRankFrom,
    domainRankTo,
    setDomainRankTo,
    companies,
    setCompanies,
    setCompanyInput,
    keywords,
    setKeywords,
    technologies,
    setTechnologies,
    orgDomains,
    setOrgDomains,
    setOrgDomainsInputText,
    orgDomainsInputText,
    orgBulkDomain,
    setOrgBulkDomain,
    orgDescription,
    setOrgDescription,
    orgLocations,
    setOrgLocations,
    orgIndustries,
    setOrgIndustries,
    orgIndustriesExclude,
    setOrgIndustriesExclude,
    orgLinkedinIds,
    setOrgLinkedinIds,
    setOrgLinkedinIdsInputText,
    orgLinkedinIdsInputText,
    orgFoundedRange,
    setOrgFoundedRange,
    sectionOpenDefaults,
  } = workspace
  return (
            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>🏢 Company Criteria</h3>
              <div className="space-y-3">
                <CollapsibleField title="Company" countBadge={companies.length} onClear={() => { setCompanies([]); setOrgLinkedinIds([]); setOrgDescription("") }} defaultOpen={sectionOpenDefaults.company}>
                  <div className="space-y-3">
                    <LookupChipsInput
                      values={companies}
                      onChange={setCompanies}
                      onTextChange={setCompanyInput}
                      placeholder="Search companies"
                      fetcher={(q) => lookupFetcher('organizations', q, currentSite?.id)}
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <Input className="h-10" placeholder="Boolean text query" value={orgDescription} onChange={(e)=> setOrgDescription(e.target.value)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">LinkedIn Identifiers</p>
                      <ChipsInput
                        values={orgLinkedinIds}
                        onChange={setOrgLinkedinIds}
                        inputValue={orgLinkedinIdsInputText}
                        onInputChange={setOrgLinkedinIdsInputText}
                        placeholder="linkedin.com/company/slug"
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Domains" defaultOpen={sectionOpenDefaults.domains} countBadge={orgDomains.length + (orgBulkDomain ? 1 : 0)} onClear={() => { setOrgDomains([]); setOrgBulkDomain("") }}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Domains</p>
                      <ChipsInput
                        values={orgDomains}
                        onChange={setOrgDomains}
                        inputValue={orgDomainsInputText}
                        onInputChange={setOrgDomainsInputText}
                        placeholder="example.com"
                      />
                      <p className="text-xs text-muted-foreground mt-1">You can also type domains in Company chips above.</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bulk Domain</p>
                      <Input
                        className="h-10"
                        placeholder="example.com"
                        value={orgBulkDomain}
                        onChange={(e) => {
                          const newValue = e.target.value
                          console.log('[People] Bulk Domain input changed:', newValue)
                          setOrgBulkDomain(newValue)
                        }}
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Location & Industry" defaultOpen={sectionOpenDefaults.compLocInd} countBadge={orgLocations.length + orgIndustries.length + orgIndustriesExclude.length + keywords.length} onClear={() => { setOrgLocations([]); setOrgIndustries([]); setOrgIndustriesExclude([]); setKeywords([]) }}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Locations</p>
                      <LookupChipsInput
                        values={orgLocations}
                        onChange={setOrgLocations}
                        onTextChange={lookupDraftSetters.organization_locations}
                        placeholder="Search locations"
                        fetcher={(q) => lookupFetcher('locations', q, currentSite?.id)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Industries (Include)</p>
                      <LookupChipsInput
                        values={orgIndustries}
                        onChange={setOrgIndustries}
                        onTextChange={lookupDraftSetters.organization_industries}
                        placeholder="Search industries"
                        fetcher={(q) => lookupFetcher('industries', q, currentSite?.id)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Industries (Exclude)</p>
                      <LookupChipsInput
                        values={orgIndustriesExclude}
                        onChange={setOrgIndustriesExclude}
                        onTextChange={lookupDraftSetters.organization_industries_exclude}
                        placeholder="Search industries to exclude"
                        fetcher={(q) => lookupFetcher('industries', q, currentSite?.id)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Keywords</p>
                      <LookupChipsInput
                        values={keywords}
                        onChange={setKeywords}
                        onTextChange={lookupDraftSetters.organization_keywords}
                        placeholder="Keywords"
                        fetcher={(q) => lookupFetcher('org_keywords', q, currentSite?.id)}
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Company Size & Founded" defaultOpen={sectionOpenDefaults.sizeFounded}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">Employees</p>
                      <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">From</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={employeeFrom === "" ? "" : employeeFrom}
                        onChange={(e) => {
                          const v = e.target.value
                          setEmployeeFrom(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-center pb-2">-</div>
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">To</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={employeeTo === "" ? "" : employeeTo}
                        onChange={(e) => {
                          const v = e.target.value
                          setEmployeeTo(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">Revenue (USD)</p>
                    <div className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-5">
                        <p className="text-xs text-muted-foreground mb-1">From</p>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          value={revenueFrom === "" ? "" : revenueFrom}
                          onChange={(e) => {
                            const v = e.target.value
                            setRevenueFrom(v === "" ? "" : Number(v))
                          }}
                          className="h-10"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-center pb-2">-</div>
                      <div className="col-span-5">
                        <p className="text-xs text-muted-foreground mb-1">To</p>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          value={revenueTo === "" ? "" : revenueTo}
                          onChange={(e) => {
                            const v = e.target.value
                            setRevenueTo(v === "" ? "" : Number(v))
                          }}
                          className="h-10"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-left text-xs text-muted-foreground">Founded Date Range</label>
                      {(!orgFoundedRange.start || !orgFoundedRange.end) && (
                        <Badge variant="outline" className="text-xs">Not set</Badge>
                      )}
                      {(orgFoundedRange.start || orgFoundedRange.end) && (
                        <button
                          type="button"
                          onClick={() => setOrgFoundedRange({})}
                          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Clear date range"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <CalendarDateRangePicker
                      initialStartDate={orgFoundedRange.start}
                      initialEndDate={orgFoundedRange.end}
                      onRangeChange={(start, end) => setOrgFoundedRange({ start, end })}
                      className="w-full [&_.btn]:h-10 [&_.btn]:items-start"
                    />
                    <p className="text-left text-xs text-muted-foreground">Pick the period for the company founding.</p>
                  </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title={t('people.filters.webTech.title') || "Web & Tech"} defaultOpen={false}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.technologies.title') || 'Technologies'}</p>
                      <LookupChipsInput
                        values={technologies}
                        onChange={setTechnologies}
                        onTextChange={lookupDraftSetters.organization_web_technologies}
                        placeholder={t('people.filters.technologies.search') || "Search technologies"}
                        fetcher={(q) => lookupFetcher('web_technologies', q, currentSite?.id)}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.webTech.domainRank') || 'Domain Rank'}</p>
                      <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.foundedDate.from') || 'From'}</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={domainRankFrom === "" ? "" : domainRankFrom}
                        onChange={(e) => {
                          const v = e.target.value
                          setDomainRankFrom(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-center pb-2">-</div>
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.foundedDate.to') || 'To'}</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={domainRankTo === "" ? "" : domainRankTo}
                        onChange={(e) => {
                          const v = e.target.value
                          setDomainRankTo(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                    </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleField>

                <CollapsibleField title={t('people.filters.foundedDate.title') || "Founded Date"} defaultOpen={sectionOpenDefaults.foundedDate}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-left text-xs text-muted-foreground">{t('people.filters.foundedDate.range') || 'Founded Date Range'}</label>
                      {(!orgFoundedRange.start || !orgFoundedRange.end) && (
                        <Badge variant="outline" className="text-xs">{t('people.filters.notSet') || 'Not set'}</Badge>
                      )}
                      {(orgFoundedRange.start || orgFoundedRange.end) && (
                        <button
                          type="button"
                          onClick={() => setOrgFoundedRange({})}
                          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={t('people.filters.clearDateRange') || 'Clear date range'}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <CalendarDateRangePicker
                      initialStartDate={orgFoundedRange.start}
                      initialEndDate={orgFoundedRange.end}
                      onRangeChange={(start, end) => setOrgFoundedRange({ start, end })}
                      className="w-full [&_.btn]:h-10 [&_.btn]:items-start"
                    />
                    <p className="text-left text-xs text-muted-foreground">{t('people.filters.foundedDate.help') || 'Pick the period for the company founding.'}</p>
                  </div>
                </CollapsibleField>
                <CollapsibleField title={t('people.filters.companyLinkedin.title') || "LinkedIn Identifiers"} defaultOpen={sectionOpenDefaults.companyLinkedin} countBadge={orgLinkedinIds.length} onClear={() => setOrgLinkedinIds([])}>
                  <ChipsInput
                    values={orgLinkedinIds}
                    onChange={setOrgLinkedinIds}
                    inputValue={orgLinkedinIdsInputText}
                    onInputChange={setOrgLinkedinIdsInputText}
                    placeholder="linkedin.com/company/slug"
                  />
                </CollapsibleField>
              </div>
            </div>
  )
}
