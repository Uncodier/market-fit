"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { ChevronDown, ChevronRight, Loader, Users } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Pagination } from "@/app/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { TooltipProvider } from "@/app/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { Lead } from "@/app/leads/types"
import { JOURNEY_STAGES } from "@/app/leads/types"
import { cn } from "@/lib/utils"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import { useLeadTableActions } from "./use-lead-table-actions"
import { LeadRowMenu } from "./lead-row-menu"
import { LeadAssigneeCell } from "./lead-assignee-cell"

const JOURNEY_LABELS = [
  ...JOURNEY_STAGES,
  { id: "not_contacted", label: "Unaware" },
]

function journeyLabel(stageId: string) {
  return JOURNEY_LABELS.find((stage) => stage.id === stageId)?.label || "Unknown"
}

function statusLabel(status: string) {
  if (status === "not_qualified") return "Not qualified"
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
}

function hasRealCompany(lead: Lead) {
  return Boolean(
    lead.companies?.name ||
    (lead.company && typeof lead.company === "object" && lead.company.name) ||
    typeof lead.company === "string"
  )
}

function leadContactLine(lead: Lead) {
  return lead.email || lead.phone || "—"
}

export interface CompanyGroup {
  companyName: string
  companyKey: string
  leads: Lead[]
  mostAdvancedLead: Lead
  mostAdvancedStage: string
  leadCount: number
  isExpanded: boolean
}

interface GroupedLeadsTableProps {
  companyGroups: CompanyGroup[]
  currentPage: number
  itemsPerPage: number
  totalLeads: number
  totalCompanies: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onLeadClick: (lead: Lead) => void
  forceReload: number
  invalidateJourneyStageCache: (leadId: string) => void
  onUpdateLead?: (leadId: string, updates: Partial<Lead> & { invalidated?: boolean }) => void
  onDeleteLead?: (leadId: string) => Promise<void>
  userData: Record<string, { name: string; avatar_url: string | null }>
  onToggleCompanyExpansion: (companyKey: string) => void
  segments: Array<{ id: string; name: string }>
  leadJourneyStages: Record<string, string>
  isLoadingJourneyStages: boolean
  reloadingLeads: Set<string>
  selectedLeads?: Set<string>
  onSelectLeads?: (leadIds: Set<string>) => void
}

export function GroupedLeadsTable({
  companyGroups,
  currentPage,
  itemsPerPage,
  totalLeads,
  totalCompanies,
  onPageChange,
  onItemsPerPageChange,
  onLeadClick,
  invalidateJourneyStageCache,
  onUpdateLead,
  onDeleteLead,
  userData,
  onToggleCompanyExpansion,
  segments,
  leadJourneyStages,
  isLoadingJourneyStages,
  reloadingLeads,
  selectedLeads = new Set(),
  onSelectLeads,
}: GroupedLeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalCompanies / itemsPerPage)
  const paginatedCompanies = (companyGroups || []).slice(indexOfFirstItem, indexOfFirstItem + itemsPerPage)
  const actions = useLeadTableActions({
    companyGroups,
    invalidateJourneyStageCache,
    onUpdateLead,
    onDeleteLead,
  })

  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return null
    return segments.find((segment) => segment.id === segmentId)?.name || null
  }

  const toggleLead = (leadId: string, checked: boolean) => {
    if (!onSelectLeads) return
    const next = new Set(selectedLeads)
    if (checked) next.add(leadId)
    else next.delete(leadId)
    onSelectLeads(next)
  }

  if (paginatedCompanies.length === 0) {
    return (
      <EmptyCard
        icon={<Users className="h-16 w-16 text-muted-foreground" />}
        title="No companies found"
        description="There are no companies to display."
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[920px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-10 px-3">
                <Checkbox
                  checked={
                    paginatedCompanies.length > 0 &&
                    paginatedCompanies.every((group) => group.leads.every((lead) => selectedLeads.has(lead.id)))
                  }
                  onCheckedChange={(checked) => {
                    if (!onSelectLeads) return
                    const next = new Set(selectedLeads)
                    const pageLeads = paginatedCompanies.flatMap((group) => group.leads)
                    pageLeads.forEach((lead) => {
                      if (checked) next.add(lead.id)
                      else next.delete(lead.id)
                    })
                    onSelectLeads(next)
                  }}
                  aria-label="Select all on page"
                />
              </DocumentListHead>
              <DocumentListHead className="w-[28%]">Company</DocumentListHead>
              <DocumentListHead className="w-[24%]">Lead</DocumentListHead>
              <DocumentListHead className="w-[12%]">Status</DocumentListHead>
              <DocumentListHead className="w-[12%]">Journey</DocumentListHead>
              <DocumentListHead className="w-[14%]">Assignee</DocumentListHead>
              <DocumentListHead className="w-[8%]" align="right">Actions</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCompanies.map((group) => {
              const lead = group.mostAdvancedLead
              const journey = group.mostAdvancedStage || "not_contacted"
              const segment = getSegmentName(lead.segment_id)
              const companyMeta = [
                group.leadCount > 1 ? `${group.leadCount} contacts` : null,
                segment,
              ].filter(Boolean).join(" · ") || null

              return (
                <React.Fragment key={group.companyKey}>
                  <DocumentListRow
                    onClick={() => {
                      if (group.leadCount > 1) onToggleCompanyExpansion(group.companyKey)
                      else onLeadClick(lead)
                    }}
                  >
                    <TableCell className="px-3 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={group.leads.every((item) => selectedLeads.has(item.id))}
                        onCheckedChange={(checked) => {
                          if (!onSelectLeads) return
                          const next = new Set(selectedLeads)
                          group.leads.forEach((item) => {
                            if (checked) next.add(item.id)
                            else next.delete(item.id)
                          })
                          onSelectLeads(next)
                        }}
                        aria-label={`Select all leads in ${group.companyName}`}
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex min-w-0 items-center gap-1">
                        {group.leadCount > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={(event) => {
                              event.stopPropagation()
                              onToggleCompanyExpansion(group.companyKey)
                            }}
                          >
                            {group.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                        <EntityCell
                          name={group.companyName}
                          secondary={companyMeta}
                          secondaryMono={false}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5">
                      {group.leadCount === 1 ? (
                        <EntityCell
                          name={hasRealCompany(lead) ? lead.name : leadContactLine(lead)}
                          secondary={hasRealCompany(lead) ? leadContactLine(lead) : (lead.email ? lead.phone : null)}
                          meta={lead.position}
                          secondaryMono={false}
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{group.leadCount} people</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusDot status={lead.status} label={statusLabel(lead.status)} />
                    </TableCell>
                    <TableCell className="py-3.5">
                      {isLoadingJourneyStages || reloadingLeads.has(lead.id) ? (
                        <Skeleton className="h-4 w-20" />
                      ) : (
                        <StatusDot status={journey} label={journeyLabel(journey)} />
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      <LeadAssigneeCell
                        assigneeId={lead.assignee_id}
                        currentUserId={actions.user?.id}
                        assigneeName={lead.assignee_id ? userData[lead.assignee_id]?.name : undefined}
                        assigning={actions.assigningLeads[lead.id]}
                        onToggle={() => actions.handleToggleAssignee(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                      <LeadRowMenu
                        lead={lead}
                        leadCount={group.leadCount}
                        loading={actions.loadingActions[lead.id]}
                        success={actions.successActions[lead.id]}
                        onResearch={() => actions.handleLeadResearch(lead.id, group.leadCount > 1, group.leads)}
                        onFollowUp={() => actions.handleLeadFollowUp(lead.id, group.leadCount > 1, group.leads)}
                        onInvalidate={() => actions.handleLeadInvalidation(lead.id, group.leadCount > 1, group.leads)}
                        onEdit={() => onLeadClick(lead)}
                        onConversation={() => actions.handleNewConversation(lead.id)}
                        onDelete={onDeleteLead ? () => actions.handleDeleteLead(lead) : undefined}
                      />
                    </TableCell>
                  </DocumentListRow>

                  {group.leadCount > 1 && group.isExpanded && group.leads.map((child) => {
                    const childJourney = leadJourneyStages[child.id] || "not_contacted"
                    return (
                      <DocumentListRow key={child.id} onClick={() => onLeadClick(child)} className="bg-muted/20">
                        <TableCell className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedLeads.has(child.id)}
                            onCheckedChange={(checked) => toggleLead(child.id, Boolean(checked))}
                            aria-label={`Select ${child.name || child.email}`}
                          />
                        </TableCell>
                        <TableCell className="py-3" />
                        <TableCell className="py-3 pl-8">
                          <EntityCell
                            name={child.name || leadContactLine(child)}
                            secondary={child.email}
                            meta={child.position}
                            secondaryMono={false}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <StatusDot status={child.status} label={statusLabel(child.status)} />
                        </TableCell>
                        <TableCell className="py-3">
                          {isLoadingJourneyStages || reloadingLeads.has(child.id) ? (
                            <Skeleton className="h-4 w-20" />
                          ) : (
                            <StatusDot status={childJourney} label={journeyLabel(childJourney)} />
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <LeadAssigneeCell
                            assigneeId={child.assignee_id}
                            currentUserId={actions.user?.id}
                            assigneeName={child.assignee_id ? userData[child.assignee_id]?.name : undefined}
                            assigning={actions.assigningLeads[child.id]}
                            onToggle={() => actions.handleToggleAssignee(child.id)}
                          />
                        </TableCell>
                        <TableCell className="py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <LeadRowMenu
                            lead={child}
                            loading={actions.loadingActions[child.id]}
                            success={actions.successActions[child.id]}
                            onResearch={() => actions.handleLeadResearch(child.id)}
                            onFollowUp={() => actions.handleLeadFollowUp(child.id)}
                            onInvalidate={() => actions.handleLeadInvalidation(child.id)}
                            onEdit={() => onLeadClick(child)}
                            onConversation={() => actions.handleNewConversation(child.id)}
                            onDelete={onDeleteLead ? () => actions.handleDeleteLead(child) : undefined}
                          />
                        </TableCell>
                      </DocumentListRow>
                    )
                  })}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/60 px-4 py-3 gap-4">
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCompanies)}</span>
              {" – "}
              <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + itemsPerPage, totalCompanies)}</span>
              {" of "}
              <span className="font-medium text-foreground">{totalCompanies}</span>
              {" companies · "}
              <span className="font-medium text-foreground">{totalLeads}</span> leads
            </p>
            <Select value={itemsPerPage.toString()} onValueChange={onItemsPerPageChange}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={itemsPerPage.toString()} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5, 10, 20, 50].map((value) => (
                  <SelectItem key={value} value={value.toString()}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </div>

      <AlertDialog open={actions.showDeleteDialog} onOpenChange={actions.setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{actions.leadToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => actions.setShowDeleteDialog(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={actions.confirmDeleteLead}
              disabled={actions.isDeletingLead}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
            >
              {actions.isDeletingLead ? (
                <>
                  <Loader className="mr-2 h-4 w-4" />
                  Deleting...
                </>
              ) : (
                "Delete Lead"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
