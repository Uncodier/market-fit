import { Fragment } from "react"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { ChevronDown, ChevronRight, Check } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import type { PeopleWorkspace } from "./use-people-workspace"
import { CompanyLogo } from "./company-logo"

export function PeopleResultsTable({ workspace }: { workspace: PeopleWorkspace }) {
  const {
    error,
    expandedGroups,
    selectedPersonIds,
    addedPersonIds,
    groupedResults,
    toggleGroup,
    togglePersonSelection,
  } = workspace
  return (
                <div className="overflow-x-auto">
                <Table className="w-full min-w-[2600px]" style={{ tableLayout: 'fixed' }}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap" style={{ width: 56, minWidth: 56 }}> </TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 140, minWidth: 140 }}>Person Name</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 150, minWidth: 150 }}>Role Title</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 140, minWidth: 140 }}>Company</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 120, minWidth: 120 }}>Person Location</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 100, minWidth: 100 }}>Start Date</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 100, minWidth: 100 }}>End Date</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 160, minWidth: 160 }}>Headline</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 200, minWidth: 200 }}>Role Description</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 80, minWidth: 80 }}>Current</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 320, minWidth: 320 }}>Person Description</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 200, minWidth: 200 }}>Org Description</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 90, minWidth: 90 }}>Employees</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 90, minWidth: 90 }}>Revenue</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 100, minWidth: 100 }}>Founded</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 130, minWidth: 130 }}>Industry</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 240, minWidth: 240 }}>Person LinkedIn</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 240, minWidth: 240 }}>Company LinkedIn</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: 240, minWidth: 240 }}>Company Website</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                          {error && (
                            <TableRow>
                              <TableCell colSpan={19}>
                                <div className="py-8 text-center text-sm text-destructive">{error}</div>
                              </TableCell>
                            </TableRow>
                          )}
                          {!error && groupedResults.map(group => {
                            const isExpandable = group.roles.length > 1
                            const isExpanded = !!expandedGroups[group.key]
                            const primary = group.roles[0]
                            return (
                              <Fragment key={group.key}>
                                <TableRow
                                  key={`${group.key}-row`}
                                  className={cn(
                                    "group hover:bg-muted/50 transition-colors cursor-pointer",
                                    selectedPersonIds.includes(group.personId) ? 'bg-primary/10 hover:bg-primary/15' : ''
                                  )}
                                  onClick={(e) => {
                                    // Don't toggle selection if clicking on expand button, dropdown, or links
                                    const target = e.target as HTMLElement
                                    if (target.closest('button') || target.closest('[role="menu"]') || target.closest('a')) {
                                      return
                                    }
                                    // Toggle selection on row click
                                    togglePersonSelection(group.personId)
                                  }}
                                >
                                  <TableCell className="w-[56px]">
                                    <div className="relative h-8 w-8">
                                      <Avatar className={cn(
                                        "h-8 w-8 border",
                                        addedPersonIds.has(group.personId)
                                          ? "border-green-500/50 ring-2 ring-green-500/20"
                                          : "border-primary/10"
                                      )}>
                                      {group.avatarUrl ? (
                                        <AvatarImage src={group.avatarUrl} alt={group.personName} />
                                      ) : null}
                                      <AvatarFallback className={cn(
                                        "text-[10px] leading-none font-medium text-center",
                                        addedPersonIds.has(group.personId)
                                          ? "bg-green-50 text-green-700"
                                          : "bg-muted text-foreground"
                                      )}>
                                        {group.personName.split(' ').map((s: string) => s[0]).slice(0,2).join('').toUpperCase()}
                                      </AvatarFallback>
                                      </Avatar>
                                      {selectedPersonIds.includes(group.personId) && (
                                        <div className="absolute inset-0 h-8 w-8 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center border-2 border-background transition-colors">
                                          <Check className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                      )}
                                      {addedPersonIds.has(group.personId) && !selectedPersonIds.includes(group.personId) && (
                                        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                                          <Check className="h-2.5 w-2.5 text-white" />
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-0.5 flex items-center gap-2">
                                      {isExpandable && (
                                        <button
                                          type="button"
                                          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"
                                          onClick={(e) => { e.stopPropagation(); toggleGroup(group.key) }}
                                          aria-label={isExpanded ? 'Collapse roles' : 'Expand roles'}
                                        >
                                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                      )}
                                      <p className="font-medium text-sm line-clamp-2" title={group.personName}>{group.personName}</p>
                                      {group.roles.length > 1 && (
                                        <Badge variant="secondary" className="ml-1">{group.roles.length}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{primary.title}</TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <CompanyLogo name={group.companyName} src={group.companyLogoUrl} />
                                      <div className="line-clamp-2" title={group.companyName}>{group.companyName}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="line-clamp-2" title={group.location}>{group.location}</div>
                                  </TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{primary.start ?? "N/A"}</TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{primary.end ?? (primary.start ? "Present" : "N/A")}</TableCell>
                                  <TableCell className="font-medium min-w-0">
                                    <div className="line-clamp-2 min-w-0" title={group.personHeadline}>{group.personHeadline || "—"}</div>
                                  </TableCell>
                                  <TableCell className="font-medium min-w-0">
                                    <div className="line-clamp-2 min-w-0" title={primary.description}>{primary.description || "—"}</div>
                                  </TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">
                                    {primary.isCurrent ? <Badge variant="secondary" className="text-xs">Current</Badge> : "—"}
                                  </TableCell>
                                  <TableCell className="font-medium min-w-0">
                                    <div className="line-clamp-3 min-w-0" title={group.personDescription}>{group.personDescription || "—"}</div>
                                  </TableCell>
                                  <TableCell className="font-medium min-w-0">
                                    <div className="line-clamp-2 min-w-0" title={group.organizationDescription}>{group.organizationDescription || "—"}</div>
                                  </TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{group.organizationEmployees != null ? group.organizationEmployees.toLocaleString() : "—"}</TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{group.organizationRevenue != null ? `$${group.organizationRevenue >= 1e6 ? `${(group.organizationRevenue / 1e6).toFixed(1)}M` : group.organizationRevenue >= 1e3 ? `${(group.organizationRevenue / 1e3).toFixed(1)}K` : group.organizationRevenue}` : "—"}</TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{group.organizationFoundedDate || "—"}</TableCell>
                                  <TableCell className="font-medium min-w-0">
                                    <div className="line-clamp-2 min-w-0" title={group.organizationIndustries}>{group.organizationIndustries || "—"}</div>
                                  </TableCell>
                                  <TableCell className="font-medium min-w-0 max-w-[240px]" onClick={(e) => e.stopPropagation()}>
                                    {group.personLinkedIn ? (
                                      <a href={group.personLinkedIn} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline text-sm break-all" title={group.personLinkedIn}>
                                        {group.personLinkedIn}
                                      </a>
                                    ) : "—"}
                                  </TableCell>
                                  <TableCell className="font-medium min-w-0 max-w-[240px]" onClick={(e) => e.stopPropagation()}>
                                    {group.companyLinkedIn ? (
                                      <a href={group.companyLinkedIn} target="_blank" rel="noopener noreferrer" className="block text-primary hover:underline text-sm break-all" title={group.companyLinkedIn}>
                                        {group.companyLinkedIn}
                                      </a>
                                    ) : "—"}
                                  </TableCell>
                                  <TableCell className="font-medium min-w-0 max-w-[240px]" onClick={(e) => e.stopPropagation()}>
                                    {(group.companyWebsite || group.companyDomain) ? (
                                      <a
                                        href={group.companyWebsite || (group.companyDomain ? `https://${group.companyDomain}` : "#")}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-primary hover:underline text-sm break-all"
                                        title={group.companyWebsite || (group.companyDomain ? `https://${group.companyDomain}` : "")}
                                      >
                                        {group.companyWebsite || (group.companyDomain ? `https://${group.companyDomain}` : "")}
                                      </a>
                                    ) : "—"}
                                  </TableCell>
                                </TableRow>

                                {isExpandable && isExpanded && group.roles.slice(1).map((role: any) => (
                                  <TableRow key={`${group.key}-${role.id}`} className="group hover:bg-muted/30 transition-colors border-l-4 border-l-blue-200 bg-muted/20">
                                    <TableCell className="w-[56px]"></TableCell>
                                    <TableCell>
                                      <div className="pl-8 text-sm text-muted-foreground">Additional role</div>
                                    </TableCell>
                                    <TableCell className="font-medium">{role.title}</TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        <CompanyLogo name={group.companyName} src={group.companyLogoUrl} />
                                        <div className="line-clamp-2" title={group.companyName}>{group.companyName}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="line-clamp-2" title={group.location}>{group.location}</div>
                                    </TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{role.start ?? "N/A"}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{role.end ?? (role.start ? "Present" : "N/A")}</TableCell>
                                    <TableCell className="font-medium min-w-0">
                                      <div className="line-clamp-2 min-w-0" title={group.personHeadline}>{group.personHeadline || "—"}</div>
                                    </TableCell>
                                    <TableCell className="font-medium min-w-0">
                                      <div className="line-clamp-2 min-w-0" title={role.description}>{role.description || "—"}</div>
                                    </TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">
                                      {role.isCurrent ? <Badge variant="secondary" className="text-xs">Current</Badge> : "—"}
                                    </TableCell>
                                    <TableCell className="font-medium min-w-0">
                                      <div className="line-clamp-3 min-w-0" title={group.personDescription}>{group.personDescription || "—"}</div>
                                    </TableCell>
                                    <TableCell className="font-medium min-w-0">
                                      <div className="line-clamp-2 min-w-0" title={group.organizationDescription}>{group.organizationDescription || "—"}</div>
                                    </TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{group.organizationEmployees != null ? group.organizationEmployees.toLocaleString() : "—"}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{group.organizationRevenue != null ? `$${group.organizationRevenue >= 1e6 ? `${(group.organizationRevenue / 1e6).toFixed(1)}M` : group.organizationRevenue >= 1e3 ? `${(group.organizationRevenue / 1e3).toFixed(1)}K` : group.organizationRevenue}` : "—"}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{group.organizationFoundedDate || "—"}</TableCell>
                                    <TableCell className="font-medium min-w-0">
                                      <div className="line-clamp-2 min-w-0" title={group.organizationIndustries}>{group.organizationIndustries || "—"}</div>
                                    </TableCell>
                                    <TableCell />
                                    <TableCell />
                                    <TableCell />
                                  </TableRow>
                                ))}
                              </Fragment>
                            )
                          })}
                  </TableBody>
                </Table>
                </div>
  )
}
