"use client"

import React from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ClipboardList, MoreHorizontal } from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useToast } from "@/app/components/ui/use-toast"
import { formatCurrency } from "@/app/lib/formatters"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import {
  COMPLETION_STATUS,
  REQUIREMENT_STATUS,
  REQUIREMENT_TYPE_LABELS,
  type CompletionStatusType,
  type Requirement,
  type RequirementPriority,
  type RequirementStatusType,
} from "./types"

const STATUS_OPTIONS: RequirementStatusType[] = [
  REQUIREMENT_STATUS.BACKLOG,
  REQUIREMENT_STATUS.IN_PROGRESS,
  REQUIREMENT_STATUS.ON_REVIEW,
  REQUIREMENT_STATUS.DONE,
  REQUIREMENT_STATUS.VALIDATED,
  REQUIREMENT_STATUS.CANCELED,
]

const PRIORITY_OPTIONS: RequirementPriority[] = ["high", "medium", "low"]

function statusLabelKey(status: RequirementStatusType) {
  if (status === "in-progress") return "requirements.status.inProgress"
  if (status === "on-review") return "requirements.status.onReview"
  return `requirements.status.${status}`
}

function statusFallback(status: RequirementStatusType) {
  if (status === "in-progress") return "In Progress"
  if (status === "on-review") return "On Review"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDate(value: string) {
  try {
    return format(new Date(value), "MMM d, yyyy")
  } catch {
    return value
  }
}

function requirementAccent(requirement: Requirement): "due" | "cancelled" | "none" {
  if (requirement.status === "canceled" || requirement.completionStatus === COMPLETION_STATUS.REJECTED) {
    return "cancelled"
  }
  if (requirement.priority === "high" && requirement.status !== "done" && requirement.status !== "validated") {
    return "due"
  }
  return "none"
}

function isLocked(requirement: Requirement) {
  return (
    requirement.completionStatus === COMPLETION_STATUS.COMPLETED
    || requirement.completionStatus === COMPLETION_STATUS.REJECTED
  )
}

export function RequirementsTable({
  requirements,
  currency,
  onOpen,
  onUpdateStatus,
  onUpdatePriority,
  emptyTitle,
  emptyDescription,
}: {
  requirements: Requirement[]
  currency: string
  onOpen: (requirement: Requirement) => void
  onUpdateStatus: (id: string, status: RequirementStatusType) => Promise<void>
  onUpdatePriority: (id: string, priority: RequirementPriority) => Promise<void>
  emptyTitle?: string
  emptyDescription?: string
}) {
  const { t } = useLocalization()
  const { toast } = useToast()

  const changeStatus = async (id: string, status: RequirementStatusType) => {
    try {
      await onUpdateStatus(id, status)
      toast({
        title: t("requirements.success.statusTitle") || "Status updated",
        description: t("requirements.success.statusDesc") || "The requirement status has been updated.",
      })
    } catch {
      // Parent already surfaces the error
    }
  }

  const changePriority = async (id: string, priority: RequirementPriority) => {
    try {
      await onUpdatePriority(id, priority)
      toast({
        title: t("requirements.success.priorityTitle") || "Priority updated",
        description: t("requirements.success.priorityDesc") || "The requirement priority has been updated.",
      })
    } catch {
      // Parent already surfaces the error
    }
  }

  if (requirements.length === 0) {
    return (
      <EmptyCard
        icon={<ClipboardList className="h-12 w-12 text-muted-foreground" />}
        title={emptyTitle || t("requirements.empty.noTitle") || "No requirements found"}
        description={emptyDescription || t("requirements.empty.noDesc") || "No requirements created yet. Create a new one to start."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[880px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[36%]">{t("requirements.list.goal") || "Goal"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("requirements.list.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("requirements.list.priority") || "Priority"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("requirements.list.campaign") || "Campaign"}</DocumentListHead>
            <DocumentListHead className="w-[12%]" align="right">{t("requirements.list.budget") || "Budget"}</DocumentListHead>
            <DocumentListHead className="w-[6%]" align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requirements.map((requirement) => {
            const typeMeta = REQUIREMENT_TYPE_LABELS[requirement.type]
            const typeLabel = typeMeta ? (t(typeMeta.key) || typeMeta.fallback) : requirement.type
            const locked = isLocked(requirement)
            const paid = Boolean(
              requirement.metadata?.payment_status?.outsourced && requirement.metadata.payment_status.status === "paid"
            ) || Boolean(requirement.campaignOutsourced)
            const campaign = requirement.campaignNames?.[0] || (t("requirements.list.noCampaign") || "No campaign")
            const segments = requirement.segmentNames?.length
              ? requirement.segmentNames.slice(0, 2).join(", ") + (requirement.segmentNames.length > 2 ? ` +${requirement.segmentNames.length - 2}` : "")
              : null

            return (
              <DocumentListRow
                key={requirement.id}
                onClick={() => onOpen(requirement)}
                accent={requirementAccent(requirement)}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={requirement.title}
                    secondary={typeLabel}
                    meta={[formatDate(requirement.createdAt), segments].filter(Boolean).join(" · ") || null}
                    secondaryMono={false}
                  />
                </TableCell>
                <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
                  <StatusDot
                    status={requirement.status}
                    label={t(statusLabelKey(requirement.status)) || statusFallback(requirement.status)}
                  />
                </TableCell>
                <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
                  <StatusDot
                    status={requirement.priority}
                    label={t(`requirements.priority.${requirement.priority}`) || requirement.priority}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <p className="truncate text-sm text-muted-foreground">{campaign}</p>
                </TableCell>
                <TableCell className="py-3.5">
                  {paid ? (
                    <p className="text-right text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {t("requirements.list.paid") || "Paid"}
                    </p>
                  ) : requirement.budget ? (
                    <MoneyCell amountLabel={formatCurrency(requirement.budget, currency)} />
                  ) : (
                    <p className="text-right text-sm text-muted-foreground">—</p>
                  )}
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("common.open") || "Open"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => onOpen(requirement)}>
                        {t("common.open") || "Open"}
                      </DropdownMenuItem>
                      {!locked ? (
                        <>
                          <DropdownMenuSeparator />
                          {STATUS_OPTIONS.map((status) => (
                            <DropdownMenuItem
                              key={status}
                              disabled={requirement.status === status}
                              onClick={() => changeStatus(requirement.id, status)}
                            >
                              {t(statusLabelKey(status)) || statusFallback(status)}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          {PRIORITY_OPTIONS.map((priority) => (
                            <DropdownMenuItem
                              key={priority}
                              disabled={requirement.priority === priority}
                              onClick={() => changePriority(requirement.id, priority)}
                            >
                              {t(`requirements.priority.${priority}`) || priority}
                            </DropdownMenuItem>
                          ))}
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{requirements.length}</span>
          {" "}
          {requirements.length === 1
            ? (t("requirements.list.goal") || "goal")
            : (t("requirements.list.goals") || "goals")}
        </p>
      </div>
    </div>
  )
}

export function RequirementsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead>Goal</DocumentListHead>
            <DocumentListHead>Status</DocumentListHead>
            <DocumentListHead>Priority</DocumentListHead>
            <DocumentListHead>Campaign</DocumentListHead>
            <DocumentListHead align="right">Budget</DocumentListHead>
            <DocumentListHead align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-14" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
