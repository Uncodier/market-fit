
import { Input } from "@/app/components/ui/input"
import { X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Switch } from "@/app/components/ui/switch"
import { lookupFetcher } from "./finder-api"
import { LookupChipsInput } from "./lookup-chips-input"
import { CollapsibleField } from "./collapsible-field"
import { ChipsInput } from "./chips-input"
import type { PeopleWorkspace } from "./use-people-workspace"

export function PersonFilterFields({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    lookupDraftSetters,
    t,
    currentSite,
    query,
    setQuery,
    industries,
    setIndustries,
    personIndustriesExclude,
    setPersonIndustriesExclude,
    locations,
    setLocations,
    setPersonLocationInput,
    personNameChips,
    setPersonNameChips,
    personNameInput,
    setPersonNameInput,
    personHeadlineChips,
    setPersonHeadlineChips,
    personHeadlineInput,
    setPersonHeadlineInput,
    jobTitleChips,
    setJobTitleChips,
    jobTitleInput,
    setJobTitleInput,
    skills,
    setSkills,
    personLinkedinIds,
    setPersonLinkedinIds,
    setPersonLinkedinIdsInputText,
    personLinkedinIdsInputText,
    isCurrentRole,
    setIsCurrentRole,
    roleDateSince,
    setRoleDateSince,
    roleDateUntil,
    setRoleDateUntil,
    sectionOpenDefaults,
  } = workspace
  return (
            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>👤 Person Criteria</h3>
              <div className="space-y-3">
                <CollapsibleField title="Name" defaultOpen={sectionOpenDefaults.name} onClear={() => { setPersonNameChips([]); setPersonNameInput(""); setPersonHeadlineChips([]); setPersonHeadlineInput(""); setPersonLinkedinIds([]); setPersonLinkedinIdsInputText("") }}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{t('people.filters.name.help') || 'Use “quotation marks" for exact matches. Press Enter to add as chip.'}</p>
                      <ChipsInput
                        values={personNameChips}
                        onChange={setPersonNameChips}
                        placeholder={t('people.filters.name.search') || 'Search'}
                        inputValue={personNameInput}
                        onInputChange={setPersonNameInput}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{t('people.filters.name.headline') || 'Headline'}</p>
                      <ChipsInput
                        values={personHeadlineChips}
                        onChange={setPersonHeadlineChips}
                        placeholder={t('people.filters.name.search') || 'Search'}
                        inputValue={personHeadlineInput}
                        onInputChange={setPersonHeadlineInput}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">{t('people.filters.name.linkedin') || 'LinkedIn Identifiers'}</p>
                      <ChipsInput
                        values={personLinkedinIds}
                        onChange={setPersonLinkedinIds}
                        inputValue={personLinkedinIdsInputText}
                        onInputChange={setPersonLinkedinIdsInputText}
                        placeholder="linkedin.com/in/slug"
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title={t('people.filters.jobTitle.title') || "Job Title"} defaultOpen={sectionOpenDefaults.jobTitle} onClear={() => { setJobTitleChips([]); setJobTitleInput(""); setQuery(""); setIsCurrentRole(true); setRoleDateSince(undefined); setRoleDateUntil(undefined) }}>
                  <p className="text-xs text-muted-foreground mb-2">{t('people.filters.jobTitle.help') || 'Use "quotation marks" for exact matches. Press Enter to add as chip.'}</p>
                  <ChipsInput
                    values={jobTitleChips}
                    onChange={setJobTitleChips}
                    placeholder={t('people.filters.name.search') || 'Search'}
                    inputValue={jobTitleInput}
                    onInputChange={setJobTitleInput}
                  />
                  {/* Job description (boolean search) */}
                  <div className="mt-4 flex flex-col items-start space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">{t('people.filters.jobTitle.desc') || 'Description'}</p>
                    <Input placeholder={t('people.filters.jobTitle.keywords') || 'Keywords'} className="h-10" value={query} onChange={(e)=> setQuery(e.target.value)} />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-left text-xs text-muted-foreground">{t('people.filters.jobTitle.dateSince') || 'Role date since'}</label>
                        {!roleDateSince && (
                          <Badge variant="outline" className="text-xs">{t('people.filters.notSet') || 'Not set'}</Badge>
                        )}
                        {roleDateSince && (
                          <button
                            type="button"
                            onClick={() => setRoleDateSince(undefined)}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('people.filters.clearDate') || 'Clear date'}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <DatePicker
                        date={roleDateSince || new Date()}
                        setDate={(date) => setRoleDateSince(date)}
                        className="w-full"
                        mode="default"
                        placeholder={t('people.filters.selectStartDate') || 'Select start date'}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-left text-xs text-muted-foreground">{t('people.filters.jobTitle.dateUntil') || 'Role date until'}</label>
                        {!roleDateUntil && (
                          <Badge variant="outline" className="text-xs">{t('people.filters.notSet') || 'Not set'}</Badge>
                        )}
                        {roleDateUntil && (
                          <button
                            type="button"
                            onClick={() => setRoleDateUntil(undefined)}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('people.filters.clearDate') || 'Clear date'}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <DatePicker
                        date={roleDateUntil || new Date()}
                        setDate={(date) => setRoleDateUntil(date)}
                        className="w-full"
                        mode="default"
                        placeholder={t('people.filters.selectEndDate') || 'Select end date'}
                      />
                    </div>
                    <p className="text-left text-xs text-muted-foreground">{t('people.filters.jobTitle.pickPeriod') || 'Pick the period for the role.'}</p>
                  </div>
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="current-role" className="text-left text-sm text-foreground">Role is current</label>
                    <Switch id="current-role" checked={isCurrentRole} onCheckedChange={setIsCurrentRole} />
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Industry" defaultOpen={sectionOpenDefaults.personIndustry} countBadge={industries.length + personIndustriesExclude.length} onClear={() => { setIndustries([]); setPersonIndustriesExclude([]) }}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Include</p>
                      <LookupChipsInput
                        values={industries}
                        onChange={setIndustries}
                        onTextChange={lookupDraftSetters.person_industries}
                        placeholder="Search industries"
                        fetcher={(q) => lookupFetcher('industries', q, currentSite?.id)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Exclude</p>
                      <LookupChipsInput
                        values={personIndustriesExclude}
                        onChange={setPersonIndustriesExclude}
                        onTextChange={lookupDraftSetters.person_industries_exclude}
                        placeholder="Search industries to exclude"
                        fetcher={(q) => lookupFetcher('industries', q, currentSite?.id)}
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Location" defaultOpen={sectionOpenDefaults.personLocation} countBadge={locations.length} onClear={() => setLocations([])}>
                  <LookupChipsInput
                    values={locations}
                    onChange={setLocations}
                    onTextChange={setPersonLocationInput}
                    placeholder="Search locations"
                    fetcher={(q) => lookupFetcher('locations', q, currentSite?.id)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Skills" countBadge={skills.length} onClear={() => setSkills([])} defaultOpen={sectionOpenDefaults.skills}>
                  <LookupChipsInput
                    values={skills}
                    onChange={setSkills}
                    onTextChange={lookupDraftSetters.person_skills}
                    placeholder="Search skills"
                    fetcher={(q) => lookupFetcher('skills', q, currentSite?.id)}
                  />
                </CollapsibleField>
                <CollapsibleField title="LinkedIn Identifiers" defaultOpen={sectionOpenDefaults.personLinkedin} countBadge={personLinkedinIds.length} onClear={() => { setPersonLinkedinIds([]); setPersonLinkedinIdsInputText("") }}>
                  <ChipsInput
                    values={personLinkedinIds}
                    onChange={setPersonLinkedinIds}
                    inputValue={personLinkedinIdsInputText}
                        onInputChange={setPersonLinkedinIdsInputText}
                    placeholder="linkedin.com/in/slug"
                  />
                </CollapsibleField>
              </div>
            </div>
  )
}
