
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { lookupFetcher } from "./finder-api"
import { LookupChipsInput } from "./lookup-chips-input"
import { CollapsibleField } from "./collapsible-field"
import { type FinderSimpleEventSource, type FinderSimpleEventReason } from "./finder-request-types"
import type { PeopleWorkspace } from "./use-people-workspace"

export function FundingSignalFilterFields({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    lookupDraftSetters,
    t,
    currentSite,
    fundingRange,
    setFundingRange,
    fundingType,
    setFundingType,
    fundingDateRange,
    setFundingDateRange,
    fundingRangeTouched,
    setFundingRangeTouched,
    technologies,
    setTechnologies,
    simpleEventSource,
    setSimpleEventSource,
    simpleEventReason,
    setSimpleEventReason,
    simpleEventDateRange,
    setSimpleEventDateRange,
    sectionOpenDefaults,
  } = workspace
  return (
<>
                <CollapsibleField
                  title="Funding"
                  defaultOpen={sectionOpenDefaults.funding}
                  countBadge={
                    (fundingDateRange.start || fundingDateRange.end ? 1 : 0) +
                    (fundingRangeTouched && (fundingRange[0] !== 0 || fundingRange[1] !== 0) ? 1 : 0) +
                    (fundingType ? 1 : 0)
                  }
                  onClear={() => {
                    setFundingDateRange({})
                    setFundingType("")
                    setFundingRange([0, 0])
                    setFundingRangeTouched(false)
                  }}
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Funding Date</p>
                        {(!fundingDateRange.start || !fundingDateRange.end) && (
                          <Badge variant="outline" className="text-xs">Not set</Badge>
                        )}
                        {(fundingDateRange.start || fundingDateRange.end) && (
                          <button
                            type="button"
                            onClick={() => setFundingDateRange({})}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear date range"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <CalendarDateRangePicker
                        initialStartDate={fundingDateRange.start}
                        initialEndDate={fundingDateRange.end}
                        onRangeChange={(start, end)=> setFundingDateRange({ start, end })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Funding Amount (USD)</p>
                        {(fundingRange[0] !== 0 || fundingRange[1] !== 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFundingRange([0, 0])
                              setFundingRangeTouched(false)
                            }}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear funding amount"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-12 items-end gap-2">
                        <div className="col-span-5">
                          <p className="text-xs text-muted-foreground mb-1">From</p>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100000000}
                            step={1000}
                            value={fundingRange[0]}
                            onChange={(e) => {
                              const v = e.target.value
                              const num = v === "" ? 0 : Math.min(100000000, Math.max(0, Number(v)))
                              setFundingRange((prev) => [Math.min(num, prev[1]), prev[1]])
                              setFundingRangeTouched(true)
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
                            max={100000000}
                            step={1000}
                            value={fundingRange[1]}
                            onChange={(e) => {
                              const v = e.target.value
                              const num = v === "" ? 0 : Math.min(100000000, Math.max(0, Number(v)))
                              setFundingRange((prev) => {
                                const to = Math.max(num, prev[0])
                                return [prev[0], to]
                              })
                              setFundingRangeTouched(true)
                            }}
                            className="h-10"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Funding Type</p>
                        {fundingType && (
                          <button
                            type="button"
                            onClick={() => setFundingType("")}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear funding type"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Select value={fundingType} onValueChange={setFundingType}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="angel">Angel</SelectItem>
                          <SelectItem value="convertible_note">Convertible note</SelectItem>
                          <SelectItem value="corporate_round">Corporate round</SelectItem>
                          <SelectItem value="debt_financing">Debt financing</SelectItem>
                          <SelectItem value="equity_crowdfunding">Equity crowdfunding</SelectItem>
                          <SelectItem value="grant">Grant</SelectItem>
                          <SelectItem value="initial_coin_offering">Initial coin offering</SelectItem>
                          <SelectItem value="non_equity_assistance">Non equity assistance</SelectItem>
                          <SelectItem value="post_ipo_debt">Post IPO debt</SelectItem>
                          <SelectItem value="post_ipo_equity">Post IPO equity</SelectItem>
                          <SelectItem value="post_ipo_secondary">Post IPO secondary</SelectItem>
                          <SelectItem value="pre_seed">Pre seed</SelectItem>
                          <SelectItem value="private_equity">Private equity</SelectItem>
                          <SelectItem value="product_crowdfunding">Product crowdfunding</SelectItem>
                          <SelectItem value="secondary_market">Secondary market</SelectItem>
                          <SelectItem value="seed">Seed</SelectItem>
                          <SelectItem value="series_a">Series A</SelectItem>
                          <SelectItem value="series_b">Series B</SelectItem>
                          <SelectItem value="series_c">Series C</SelectItem>
                          <SelectItem value="series_d">Series D</SelectItem>
                          <SelectItem value="series_e">Series E</SelectItem>
                          <SelectItem value="series_f">Series F</SelectItem>
                          <SelectItem value="series_g">Series G</SelectItem>
                          <SelectItem value="series_h">Series H</SelectItem>
                          <SelectItem value="series_i">Series I</SelectItem>
                          <SelectItem value="series_j">Series J</SelectItem>
                          <SelectItem value="series_unknown">Series unknown</SelectItem>
                          <SelectItem value="undisclosed">Undisclosed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title={t('people.filters.technologies.title') || "Technologies"} countBadge={technologies.length} defaultOpen={sectionOpenDefaults.technologies}>
                  <LookupChipsInput
                    values={technologies}
                    onChange={setTechnologies}
                    onTextChange={lookupDraftSetters.organization_web_technologies}
                    placeholder={t('people.filters.technologies.search') || "Search technologies"}
                    fetcher={(q) => lookupFetcher('web_technologies', q, currentSite?.id)}
                  />
                </CollapsibleField>
                <CollapsibleField title={t('people.filters.signals.title') || "Signals"} defaultOpen={sectionOpenDefaults.signals}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.signals.simpleEventSource') || 'Simple Event Source'}</p>
                      <Select value={simpleEventSource ?? ""} onValueChange={(v) => setSimpleEventSource(v as FinderSimpleEventSource)}>
                        <SelectTrigger className="h-10"><SelectValue placeholder={t('people.filters.signals.selectSource') || "Select source"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product_hunt">Product Hunt</SelectItem>
                          <SelectItem value="form_c_sec_gov">Form C (sec.gov)</SelectItem>
                          <SelectItem value="form_d_sec_gov">Form D (sec.gov)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">{t('people.filters.signals.simpleEventReason') || 'Simple Event Reason'}</p>
                      <Select value={simpleEventReason ?? ""} onValueChange={(v) => setSimpleEventReason(v as FinderSimpleEventReason)}>
                        <SelectTrigger className="h-10"><SelectValue placeholder={t('people.filters.signals.selectReason') || "Select reason"} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="report_released">Report released</SelectItem>
                          <SelectItem value="promoted_on_site">Promoted on site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">{t('people.filters.signals.featuredDate') || 'Simple Event Featured Date'}</p>
                        {(!simpleEventDateRange.start || !simpleEventDateRange.end) && (
                          <Badge variant="outline" className="text-xs">{t('people.filters.notSet') || 'Not set'}</Badge>
                        )}
                        {(simpleEventDateRange.start || simpleEventDateRange.end) && (
                          <button
                            type="button"
                            onClick={() => setSimpleEventDateRange({})}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={t('people.filters.clearDateRange') || 'Clear date range'}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <CalendarDateRangePicker
                        initialStartDate={simpleEventDateRange.start}
                        initialEndDate={simpleEventDateRange.end}
                        onRangeChange={(start, end)=> setSimpleEventDateRange({ start, end })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </CollapsibleField>
</>
  )
}
