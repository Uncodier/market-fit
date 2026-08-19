"use client"

import React, { useMemo, useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ClipboardList } from "@/app/components/ui/icons"
import { RecordItem, resolveRelationsForSidebar } from "../actions"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { DocumentListHead, DocumentListRow, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Skeleton } from "@/app/components/ui/skeleton"
import { DynamicFieldBadges } from "./DynamicFieldBadges"

interface RecordsTableProps {
  records: RecordItem[]
  currentPage: number
  itemsPerPage: number
  totalRecords: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onRecordClick: (record: RecordItem) => void
  categories: Array<{ id: string; name: string }>
  selectedRecords: Set<string>
  onToggleRecordSelection: (recordId: string) => void
  groupBy?: "status" | "category" | "date" | "team_member"
}

const STATUS_ORDER = ["draft", "published", "archived"] as const

export function RecordsTable({
  records,
  currentPage,
  itemsPerPage,
  totalRecords,
  onPageChange,
  onItemsPerPageChange,
  onRecordClick,
  categories,
  selectedRecords,
  onToggleRecordSelection,
  groupBy = "status"
}: RecordsTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage

  const { groupedRecords, groupKeys } = useMemo(() => {
    const groups: Record<string, RecordItem[]> = {}
    
    if (groupBy === "status") {
      STATUS_ORDER.forEach((status) => {
        groups[status] = []
      })
    }

    records.forEach((record) => {
      let key = "unknown"
      if (groupBy === "status") {
        key = record.status && groups[record.status] ? record.status : "draft"
      } else if (groupBy === "category") {
        key = record.category_id || "uncategorized"
      } else if (groupBy === "date") {
        if (record.created_at) {
          key = format(new Date(record.created_at), "yyyy-MM")
        } else {
          key = "unknown_date"
        }
      } else if (groupBy === "team_member") {
        // Find the first relation that points to team_member (or site_users etc)
        // Without full schema here, we might just look for any relation named "assignee" or "team_member" or similar
        // Let's find any value in relations that is a UUID and hope we can resolve it, 
        // or look up the category template fields to find which one is team_member.
        // For simplicity, we just use "unassigned" as a fallback until we resolve names.
        let memberId = "unassigned"
        if (record.category?.template_fields) {
          const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
          if (teamMemberField && record.relations?.[teamMemberField.name]) {
            memberId = record.relations[teamMemberField.name]
          }
        }
        key = memberId
      }

      if (!groups[key]) groups[key] = []
      groups[key].push(record)
    })
    
    let keys = Object.keys(groups)
    if (groupBy === "status") {
      keys = STATUS_ORDER.slice()
    } else if (groupBy === "date") {
      keys = keys.sort((a, b) => b.localeCompare(a)) // sort descending
    } else if (groupBy === "category" || groupBy === "team_member") {
      keys = keys.sort()
    }

    return { groupedRecords: groups, groupKeys: keys }
  }, [records, groupBy])

  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (groupBy === "team_member") {
      const idsToResolve = groupKeys.filter(k => k !== "unassigned")
      if (idsToResolve.length > 0) {
        resolveRelationsForSidebar([{ target: 'team_member', ids: idsToResolve }])
          .then(names => setResolvedNames(names))
          .catch(console.error)
      }
    }
  }, [groupBy, groupKeys])

  if (records.length === 0) {
    return (
      <EmptyCard
        icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
        title={t("records.table.noRecords") || "No records found."}
        description={t("records.empty.desc") || "There are no records to display at this time."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[40%] pl-4">{t("records.table.title") || "Title"}</DocumentListHead>
            <DocumentListHead className="w-[20%]">{t("records.table.category") || "Category"}</DocumentListHead>
            <DocumentListHead className="w-[20%]">{t("records.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right pr-4">{t("records.table.createdAt") || "Created At"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupKeys.map((groupId) => {
            const statusItems = groupedRecords[groupId] || []
            if (statusItems.length === 0) return null
            
            let groupLabel = groupId
            if (groupBy === "status") {
              groupLabel = t(`status.${groupId}`) || groupId.charAt(0).toUpperCase() + groupId.slice(1)
            } else if (groupBy === "category") {
              const cat = categories.find(c => c.id === groupId)
              groupLabel = cat ? cat.name : (t("records.uncategorized") || "Uncategorized")
            } else if (groupBy === "date") {
              if (groupId === "unknown_date") groupLabel = (t("records.unknownDate") || "Unknown Date")
              else {
                const [year, month] = groupId.split("-")
                const d = new Date(parseInt(year), parseInt(month) - 1)
                groupLabel = format(d, "MMMM yyyy")
              }
            } else if (groupBy === "team_member") {
              if (groupId === "unassigned") groupLabel = "Unassigned"
              else groupLabel = resolvedNames[groupId] || "Loading..."
            }

            return (
              <React.Fragment key={groupId}>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="bg-muted/30 py-2.5">
                    <div className="flex items-center gap-2">
                      {groupBy === "status" ? (
                        <StatusDot status={groupId} label={groupLabel} />
                      ) : (
                        <span className="text-sm font-medium">{groupLabel}</span>
                      )}
                      <span className="text-[11px] tabular-nums text-muted-foreground/70">
                        {statusItems.length}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {statusItems.map((record) => {
                  const createdDate = record.created_at ? new Date(record.created_at) : null
                  const createdValid = createdDate && !isNaN(createdDate.getTime())

                  return (
                    <DocumentListRow
                      key={record.id}
                      onClick={() => onRecordClick(record)}
                      accent="none"
                      className={selectedRecords.has(record.id) ? "bg-primary/5" : undefined}
                    >
                      <TableCell className="py-3.5">
                        <div className="flex min-w-0 items-center gap-3 pl-4">
                          <Checkbox
                            checked={selectedRecords.has(record.id)}
                            onCheckedChange={() => onToggleRecordSelection(record.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mr-2"
                          />
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-medium leading-tight text-foreground" title={record.title}>
                              {record.title}
                            </p>
                            {record.description ? (
                              <p className="truncate text-[11px] leading-tight text-muted-foreground/80">{record.description}</p>
                            ) : null}
                            <div className="overflow-hidden">
                              <DynamicFieldBadges record={record} limit={3} className="mt-1" />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-sm font-medium text-muted-foreground">{record.category?.name || (t("records.uncategorized") || "Uncategorized")}</span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <StatusDot status={record.status} label={record.status} />
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <div className="flex flex-col items-end gap-0.5 pr-4">
                          <span className="text-[15px] font-semibold tabular-nums tracking-tight whitespace-nowrap">
                            {createdValid ? format(createdDate, "MMM d, yyyy") : "—"}
                          </span>
                        </div>
                      </TableCell>
                    </DocumentListRow>
                  )
                })}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalRecords)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + records.length, totalRecords)}</span>
            {" "}
            {t("records.table.of") || "of"}
            {" "}
            <span className="font-medium text-foreground">{totalRecords}</span>
            {" "}
            {t("records.table.records") || "records"}
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
        {totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  )
}

export function RecordsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 4 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 3 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index === 3 && "ml-auto")} />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex min-w-0 items-center gap-3 pl-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="py-3.5">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>
              <TableCell className="py-3.5 text-right">
                <div className="flex flex-col items-end gap-0.5 pr-4">
                  <Skeleton className="h-4 w-20" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
