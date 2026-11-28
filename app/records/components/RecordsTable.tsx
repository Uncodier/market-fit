"use client"

import { useScopedPreviewState } from "../hooks/useScopedPreviewState"
import { buildPreviewRequests, fetchPreviewBatches, fieldPreviewKey } from "../lib/entity-preview-request"
import { useSite } from "@/app/context/SiteContext"
import React, { useMemo, useEffect } from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { Button } from "@/app/components/ui/button"
import { ChevronDown, ClipboardList } from "@/app/components/ui/icons"
import { type RecordCategory, type RecordItem, resolveRelationsForSidebar } from "../actions"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { DocumentListHead, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Skeleton } from "@/app/components/ui/skeleton"
import { groupTableRecords, type RecordGrouping } from "../lib/table-record-order"
import { recordStatusGroup, recordStatusLabel } from "../lib/record-status"
import { recordFieldLabel } from "../lib/field-values"
import { descriptionProperty, statusProperty, titleProperty, type SaveRecordProperty } from "../lib/record-properties"
import type { ValidatedTemplateField } from "../lib/template-validation"
import { OpenRecordButton, RecordPropertyCell } from "./RecordPropertyEditor"
import { RecordsTableProperties, type SaveTableProperty } from "./RecordsTableProperties"
import { useUserData } from "@/app/hooks/use-user-data"
import { RecordMemberAvatar } from "./RecordMemberAvatar"

const NO_FIELDS: ValidatedTemplateField[] = []
export const RECORDS_TABLE_PAGE_SIZES = [20, 50] as const

interface RecordsTableProps {
  records: RecordItem[]
  currentPage: number
  itemsPerPage: number
  totalRecords: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onRecordClick: (record: RecordItem) => void
  onSaveProperty: SaveRecordProperty
  activeCategory?: RecordCategory
  categories: RecordCategory[]
  onAddProperty: SaveTableProperty
  onManageProperties: (category: RecordCategory, fieldId?: string) => void
  onViewCategory: (category: RecordCategory) => void
  emptyAction?: { label: string; run: () => void }
  selectedRecords: Set<string>
  onToggleRecordSelection: (recordId: string) => void
  groupBy?: RecordGrouping
}

export function RecordsTable({
  records,
  currentPage,
  itemsPerPage,
  totalRecords,
  onPageChange,
  onItemsPerPageChange,
  onRecordClick,
  onSaveProperty,
  activeCategory,
  categories,
  onAddProperty,
  onManageProperties,
  onViewCategory,
  emptyAction,
  selectedRecords,
  onToggleRecordSelection,
  groupBy = "status"
}: RecordsTableProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalRecords / itemsPerPage)
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  // Headers and cells share the saved template order, not the order of row values.
  const fields: ValidatedTemplateField[] = activeCategory?.template_fields ?? NO_FIELDS
  const hasPropertiesHeader = categories.length > 0 || Boolean(activeCategory)
  const columnCount = 4 + fields.length + Number(!activeCategory) + Number(hasPropertiesHeader)

  const { groupedRecords, groupKeys } = useMemo(() => groupTableRecords(records, groupBy), [records, groupBy])

  const [resolvedNames, setResolvedNames] = useScopedPreviewState<Record<string, string>>(currentSite?.id, {})
  const [relationLabels, setRelationLabels] = useScopedPreviewState<Record<string, string>>(currentSite?.id, {})
  const relationRequests = JSON.stringify(records.flatMap(record => record.site_id === currentSite?.id
    ? buildPreviewRequests(fields, record.relations || {}) : []))
  const { userData } = useUserData(Object.keys(relationLabels)
    .filter(key => key.startsWith("team_member:"))
    .map(key => key.slice("team_member:".length)))

  useEffect(() => {
    let active = true
    setRelationLabels({})
    if (currentSite?.id && relationRequests !== "[]") {
      fetchPreviewBatches(JSON.parse(relationRequests), currentSite.id, resolveRelationsForSidebar)
        .then(labels => { if (active) setRelationLabels(labels) })
        .catch(console.error)
    }
    return () => { active = false }
  }, [currentSite?.id, relationRequests, setRelationLabels])

  useEffect(() => {
    let active = true
    setResolvedNames({})
    if (currentSite?.id && groupBy === "team_member") {
      const idsToResolve = groupKeys.filter(k => k !== "unassigned")
      if (idsToResolve.length > 0) {
        fetchPreviewBatches([{ target: 'team_member', ids: idsToResolve }], currentSite.id, resolveRelationsForSidebar)
          .then(names => { if (active) setResolvedNames(names) })
          .catch(console.error)
      }
    }
    return () => { active = false }
  }, [currentSite?.id, groupBy, groupKeys, setResolvedNames])

  const createdAtLabel = t("records.table.createdAt") || "Created At"
  const notesProperty = { ...descriptionProperty, label: t("records.table.notes") || "Notes" }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-full" style={{ width: (activeCategory ? 832 : 992) + fields.length * 176 + (hasPropertiesHeader ? 48 : 0) }}>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-72 truncate pl-4">{t("records.table.title") || "Title"}</DocumentListHead>
            {!activeCategory && <DocumentListHead className="w-40 truncate">{t("records.table.category") || "Category"}</DocumentListHead>}
            {activeCategory && fields.map(field => <DocumentListHead key={field.id} className="w-44 border-l border-border/60 px-2">
              <button type="button" className="group/column flex w-full items-center gap-1 rounded px-2 py-1.5 text-left uppercase hover:bg-muted"
                title={`Manage property: ${recordFieldLabel(field)}`} onClick={() => onManageProperties(activeCategory, field.id)}>
                <span className="min-w-0 flex-1 truncate">{recordFieldLabel(field)}</span>
                <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
              </button>
            </DocumentListHead>)}
            <DocumentListHead className="w-60 truncate">{notesProperty.label}</DocumentListHead>
            <DocumentListHead className="w-32 truncate">{t("records.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-44" align="right">
              <span className="block truncate" title={createdAtLabel}>{createdAtLabel}</span>
            </DocumentListHead>
            {hasPropertiesHeader && <DocumentListHead className="sticky right-0 w-12 border-l border-border/60 bg-card px-2">
              <RecordsTableProperties key={activeCategory?.id ?? currentSite?.id} {...{ activeCategory, categories }}
                onAdd={onAddProperty} onManage={onManageProperties} onViewCategory={onViewCategory} />
            </DocumentListHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 && <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="p-0">
              <div className="sticky left-0 w-72 space-y-2 px-4 py-6 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><ClipboardList className="size-4" /> {t("records.table.noRecords") || "No records found."}</p>
                {emptyAction && <Button size="sm" variant="outline" onClick={emptyAction.run}>{emptyAction.label}</Button>}
              </div>
            </TableCell>
          </TableRow>}
          {groupKeys.map((groupId) => {
            const statusItems = groupedRecords[groupId] || []
            if (statusItems.length === 0) return null
            
            let groupLabel = groupId
            if (groupBy === "status") {
              groupLabel = recordStatusLabel(groupId, t)
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
                  <TableCell colSpan={columnCount} className="bg-card py-2.5">
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
                  const recordCategory = !activeCategory && categories.find(category => category.id === record.category_id)
                  const categoryLabel = (recordCategory || record.category)?.name || (t("records.uncategorized") || "Uncategorized")

                  return (
                    <TableRow
                      key={record.id}
                      className={cn("group/record border-border/50 hover:bg-muted/30", selectedRecords.has(record.id) && "bg-primary/5")}
                    >
                      <TableCell className="px-2 py-1">
                        <div className="flex min-w-0 items-center gap-2 pl-2 pr-2">
                          <Checkbox
                            aria-label={`Select ${record.title}`}
                            checked={selectedRecords.has(record.id)}
                            onCheckedChange={() => onToggleRecordSelection(record.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <RecordPropertyCell record={record} property={titleProperty} onSave={onSaveProperty} className="font-medium" />
                          </div>
                          <OpenRecordButton title={record.title} onOpen={() => onRecordClick(record)} />
                        </div>
                      </TableCell>
                      {!activeCategory && <TableCell className="px-3 py-1 text-muted-foreground">
                        {recordCategory ? <button type="button" className="flex w-full items-center rounded px-1 text-left hover:underline"
                          title={`View ${categoryLabel} properties`} onClick={() => onViewCategory(recordCategory)}>
                          <span className="min-w-0 flex-1 truncate">{categoryLabel}</span>
                        </button> : <span className="block truncate px-1" title={categoryLabel}>{categoryLabel}</span>}
                      </TableCell>}
                      {fields.map(field => {
                        const id = record.relations?.[field.name]
                        const label = field.type === "relation" && typeof id === "string"
                          ? relationLabels[fieldPreviewKey(field, id)] : undefined
                        const member = field.type === "relation" && field.relationTarget === "team_member"
                          && typeof id === "string" && id.trim() && record.site_id === currentSite?.id
                        return <TableCell key={field.id} className="border-l border-border/50 px-2 py-1">
                          <RecordPropertyCell record={record} property={{ key: "field", field, label: recordFieldLabel(field) }}
                            relationLabel={label} onSave={onSaveProperty}>
                            {member ? <RecordMemberAvatar name={label} src={label ? userData[id]?.avatar_url : undefined} /> : undefined}
                          </RecordPropertyCell>
                        </TableCell>
                      })}
                      <TableCell className="px-2 py-1">
                        <RecordPropertyCell record={record} property={notesProperty} onSave={onSaveProperty} className="text-muted-foreground" />
                      </TableCell>
                      <TableCell className="px-2 py-1">
                        <RecordPropertyCell record={record} property={statusProperty} onSave={onSaveProperty}>
                          <StatusDot status={recordStatusGroup(record.status)} label={recordStatusLabel(recordStatusGroup(record.status), t)} />
                        </RecordPropertyCell>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-1 text-right text-xs tabular-nums text-muted-foreground">
                        {createdValid ? format(createdDate, "MMM d, yyyy") : "—"}
                      </TableCell>
                      {hasPropertiesHeader && <TableCell className="border-l border-border/50 p-0" />}
                    </TableRow>
                  )
                })}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
      {records.length > 0 && <div className="flex items-center justify-between gap-4 px-4 py-3">
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
              {RECORDS_TABLE_PAGE_SIZES.map((value) => (
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
      </div>}
    </div>
  )
}

export function RecordsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 4 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index === 4 && "ml-auto")} />
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
                  <Skeleton className="h-4 w-36" />
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="h-3 w-32" />
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
