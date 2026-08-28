"use client"

import React, { useMemo, useState, useEffect } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { cn } from "@/lib/utils"
import { format, formatDistanceToNow } from "date-fns"
import { Clock, CheckCircle2, FileText, Ban, Calendar, Folder, Users } from "@/app/components/ui/icons"
import { RecordItem, resolveRelationsForSidebar } from "../actions"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Skeleton } from "@/app/components/ui/skeleton"
import { DynamicFieldBadges } from "./DynamicFieldBadges"
import { publicPromptImageUrl } from "@/app/lib/image-utils"

export function RecordsKanbanSkeleton() {
  return (
    <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-4">
      <div className="flex gap-4 min-w-max px-4 md:px-8 pb-4 items-stretch justify-start min-h-[calc(100vh-220px)] after:content-[''] after:w-px after:shrink-0">
        {Array.from({ length: 3 }).map((_, colIndex) => (
          <div key={colIndex} className="flex-shrink-0 w-80 flex flex-col max-h-full">
            <div className="flex items-center justify-between mb-4 flex-none px-1">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-4">
              {Array.from({ length: 4 }).map((_, cardIndex) => (
                <Card key={cardIndex} className="bg-card shadow-sm border-border cursor-default">
                  <CardContent className="p-3">
                    <div className="flex gap-2">
                      <div className="pt-0.5">
                        <Skeleton className="h-4 w-4 rounded" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <div className="flex-1 min-w-0 space-y-1.5 mt-0.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="h-5 w-16 rounded-full shrink-0" />
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <Skeleton className="h-5 w-20 rounded-full" />
                          <div className="flex items-center gap-1.5">
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface KanbanPaginationState {
  page: number
  hasMore: boolean
  isLoading: boolean
}

interface RecordsKanbanProps {
  records: RecordItem[]
  sortBy: "newest" | "oldest" | "title_asc" | "title_desc"
  onUpdateRecordStatus: (recordId: string, newStatus: string) => Promise<void>
  onRecordClick: (record: RecordItem) => void
  kanbanPagination: Record<string, KanbanPaginationState>
  onLoadMore: (status: string) => void
  totalCounts: Record<string, number>
  selectedRecords: Set<string>
  onToggleRecordSelection: (recordId: string) => void
  groupBy?: "status" | "category" | "date" | "team_member"
  categories?: Array<{ id: string; name: string; icon?: string | null }>
}

// Define record statuses
const getRecordStatuses = (t: (key: string) => string) => [
  { id: "draft", name: t('status.draft') || "Draft", icon: <FileText className="h-4 w-4" /> },
  { id: "published", name: t('status.published') || "Published", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "archived", name: t('status.archived') || "Archived", icon: <Ban className="h-4 w-4" /> }
]

export function RecordsKanban({ 
  records, 
  sortBy, 
  onUpdateRecordStatus, 
  onRecordClick, 
  kanbanPagination, 
  onLoadMore, 
  totalCounts, 
  selectedRecords, 
  onToggleRecordSelection,
  groupBy = "status",
  categories = []
}: RecordsKanbanProps) {
  const { t } = useLocalization()
  const [localRecords, setLocalRecords] = React.useState(records)

  React.useEffect(() => {
    setLocalRecords(records)
  }, [records])

  const RECORD_STATUSES = getRecordStatuses(t)

  const sortRecords = React.useCallback((recordA: RecordItem, recordB: RecordItem) => {
    const createdA = new Date(recordA.created_at || 0).getTime()
    const createdB = new Date(recordB.created_at || 0).getTime()
    if (sortBy === "newest") return createdB - createdA
    if (sortBy === "oldest") return createdA - createdB
    if (sortBy === "title_asc") return recordA.title.localeCompare(recordB.title)
    if (sortBy === "title_desc") return recordB.title.localeCompare(recordA.title)
    return 0
  }, [sortBy])

  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({})

  const kanbanColumns = React.useMemo(() => {
    if (groupBy === "status") {
      return RECORD_STATUSES
    } else if (groupBy === "category") {
      const usedCategoryIds = new Set(localRecords.map(r => r.category_id))
      return categories.filter(c => usedCategoryIds.has(c.id)).map(c => ({
        id: c.id,
        name: c.name,
        icon: <Folder className="h-4 w-4" />
      }))
    } else if (groupBy === "date") {
      const dateMap = new Map<string, { id: string, name: string, icon: React.ReactNode }>()
      localRecords.forEach(r => {
        if (!r.created_at) return
        const key = format(new Date(r.created_at), "yyyy-MM")
        if (!dateMap.has(key)) {
          const d = new Date(r.created_at)
          dateMap.set(key, {
            id: key,
            name: format(d, "MMMM yyyy"),
            icon: <Calendar className="h-4 w-4" />
          })
        }
      })
      const cols = Array.from(dateMap.values())
      cols.sort((a, b) => b.id.localeCompare(a.id))
      return cols
    } else if (groupBy === "team_member") {
      const memberMap = new Map<string, { id: string, name: string, icon: React.ReactNode }>()
      localRecords.forEach(record => {
        let memberId = "unassigned"
        if (record.category?.template_fields) {
          const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
          if (teamMemberField && record.relations?.[teamMemberField.name]) {
            memberId = record.relations[teamMemberField.name]
          }
        }
        if (!memberMap.has(memberId)) {
          memberMap.set(memberId, {
            id: memberId,
            name: memberId === "unassigned" ? "Unassigned" : (resolvedNames[memberId] || "Loading..."),
            icon: <Users className="h-4 w-4" />
          })
        }
      })
      return Array.from(memberMap.values())
    }
    return RECORD_STATUSES
  }, [groupBy, localRecords, categories, RECORD_STATUSES, resolvedNames])

  useEffect(() => {
    if (groupBy === "team_member") {
      const idsToResolve = new Set<string>()
      localRecords.forEach(record => {
        if (record.category?.template_fields) {
          const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
          if (teamMemberField && record.relations?.[teamMemberField.name]) {
            idsToResolve.add(record.relations[teamMemberField.name])
          }
        }
      })
      if (idsToResolve.size > 0) {
        resolveRelationsForSidebar([{ target: 'team_member', ids: Array.from(idsToResolve) }])
          .then(names => setResolvedNames(names))
          .catch(console.error)
      }
    }
  }, [groupBy, localRecords])

  const recordsByStatus = kanbanColumns.reduce((acc, col) => {
    const statusRecords = localRecords
      .filter(record => {
        if (groupBy === "status") return (record.status || 'draft') === col.id
        if (groupBy === "category") return record.category_id === col.id
        if (groupBy === "date") {
          if (!record.created_at) return false
          return format(new Date(record.created_at), "yyyy-MM") === col.id
        }
        if (groupBy === "team_member") {
          let memberId = "unassigned"
          if (record.category?.template_fields) {
            const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
            if (teamMemberField && record.relations?.[teamMemberField.name]) {
              memberId = record.relations[teamMemberField.name]
            }
          }
          return memberId === col.id
        }
        return false
      })
      .sort(sortRecords)
    
    // Apply pagination: show up to 50 records per column initially, then load more
    const pagination = kanbanPagination[col.id] || { page: 1, hasMore: false, isLoading: false }
    const itemsPerPage = 50
    const maxItems = pagination.page * itemsPerPage
    
    acc[col.id] = statusRecords.slice(0, maxItems)
    return acc
  }, {} as Record<string, RecordItem[]>)

  // Helper function to check if there are more records to load for a status
  const hasMoreRecords = (statusId: string) => {
    const allStatusRecords = localRecords.filter(record => {
      if (groupBy === "status") return (record.status || 'draft') === statusId
      if (groupBy === "category") return record.category_id === statusId
      if (groupBy === "date") {
        if (!record.created_at) return false
        return format(new Date(record.created_at), "yyyy-MM") === statusId
      }
      if (groupBy === "team_member") {
        let memberId = "unassigned"
        if (record.category?.template_fields) {
          const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
          if (teamMemberField && record.relations?.[teamMemberField.name]) {
            memberId = record.relations[teamMemberField.name]
          }
        }
        return memberId === statusId
      }
      return false
    })
    const pagination = kanbanPagination[statusId] || { page: 1, hasMore: false, isLoading: false }
    const itemsPerPage = 50
    const maxItems = pagination.page * itemsPerPage
    
    return allStatusRecords.length > maxItems || pagination.hasMore
  }

  const getGroupTotalCount = (groupId: string) => {
    return localRecords.filter(record => {
      if (groupBy === "status") return (record.status || 'draft') === groupId
      if (groupBy === "category") return record.category_id === groupId
      if (groupBy === "date") {
        if (!record.created_at) return false
        return format(new Date(record.created_at), "yyyy-MM") === groupId
      }
      if (groupBy === "team_member") {
        let memberId = "unassigned"
        if (record.category?.template_fields) {
          const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
          if (teamMemberField && record.relations?.[teamMemberField.name]) {
            memberId = record.relations[teamMemberField.name]
          }
        }
        return memberId === groupId
      }
      return false
    }).length
  }

  // Handle drag end
  const handleDragEnd = async (result: any) => {
    if (groupBy === "date") return // Cannot drag across dates

    const { destination, source, draggableId } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50)
    }

    const newStatus = destination.droppableId
    const sourceStatus = source.droppableId
    
    const draggedRecord = localRecords.find(r => r.id === draggableId)
    if (!draggedRecord) return

    // Update local state immediately for responsiveness
    setLocalRecords(prevRecords => {
      const updatedRecords = prevRecords.map(record => {
        if (record.id === draggableId) {
          if (groupBy === "status") {
            return { ...record, status: newStatus }
          } else if (groupBy === "category") {
            return { ...record, category_id: newStatus, category: categories?.find(c => c.id === newStatus) as any || record.category }
          } else if (groupBy === "team_member") {
            // we'll update the relations field for team member
            let newRelations = { ...(record.relations || {}) }
            if (record.category?.template_fields) {
              const teamMemberField = record.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
              if (teamMemberField) {
                if (newStatus === "unassigned") {
                  delete newRelations[teamMemberField.name]
                } else {
                  newRelations[teamMemberField.name] = newStatus
                }
              }
            }
            return { ...record, relations: newRelations }
          }
        }
        return record
      })
      return updatedRecords
    })

    try {
      const destCol = kanbanColumns.find(s => s.id === newStatus)
      toast.success(
        sourceStatus !== newStatus 
          ? `${t("records.toast.movedTo") || 'Record moved to'} ${destCol?.name || 'new group'}`
          : (t("records.toast.reordered") || "Record reordered successfully")
      )

      if (groupBy === "team_member") {
         const { updateRecord } = await import("../actions");
         let newRelations = { ...(draggedRecord.relations || {}) }
         if (draggedRecord.category?.template_fields) {
           const teamMemberField = draggedRecord.category.template_fields.find((f: any) => f.relationTarget === 'team_member')
           if (teamMemberField) {
             if (newStatus === "unassigned") {
               delete newRelations[teamMemberField.name]
             } else {
               newRelations[teamMemberField.name] = newStatus
             }
             await updateRecord(draggableId, { relations: newRelations })
           }
         }
      } else {
        await onUpdateRecordStatus(draggableId, newStatus)
      }
    } catch (error) {
      // If server update fails, revert local state
      setLocalRecords(records)
      console.error('Failed to update record:', error)
      toast.error(t("records.toast.updateFailed") || "Failed to update record")
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-4 min-w-max px-4 md:px-8 pb-4 items-stretch justify-start min-h-[calc(100vh-220px)] after:content-[''] after:w-px after:shrink-0">
          {kanbanColumns.map(status => (
            <div key={status.id} className="flex-shrink-0 w-80 flex flex-col">
              <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status.icon}
                    <h3 className="font-medium text-sm">{status.name}</h3>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getGroupTotalCount(status.id)}
                  </Badge>
                </div>
              </div>
              <Droppable droppableId={status.id} isDropDisabled={groupBy === "date"}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "bg-muted/30 rounded-b-md p-2 border-b border-x flex-1 flex flex-col min-h-[150px]",
                      snapshot.isDraggingOver && "bg-muted/50"
                    )}
                  >
                    {recordsByStatus[status.id]?.length > 0 ? (
                      recordsByStatus[status.id].map((record, index) => {
                        let coverUrl: string | null = null;
                        let coverFieldName: string | null = null;
                        
                        const templateFields = record.category?.template_fields || [];
                        for (const field of templateFields) {
                          const value = record.data?.[field.name];
                          if (!value) continue;
                          
                          if (field.aiPreview?.enabled) {
                            const prompt = (field.aiPreview.promptTemplate || "Generate an image about: {value}").replace(/{value}/g, String(value));
                            coverUrl = publicPromptImageUrl(prompt, 400);
                            coverFieldName = field.name;
                            break;
                          } else if (field.type === 'file' && typeof value === 'string' && value.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
                            coverUrl = value;
                            coverFieldName = field.name;
                            break;
                          }
                        }

                        return (
                        <Draggable key={record.id} draggableId={record.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <Card
                                className={cn(
                                  "mb-2 cursor-pointer transition-shadow duration-200 hover:shadow-md relative select-none overflow-hidden",
                                  snapshot.isDragging && "shadow-lg",
                                  selectedRecords.has(record.id) && "ring-2 ring-primary/40 bg-primary/5"
                                )}
                                onClick={() => onRecordClick(record)}
                              >
                                {coverUrl && (
                                  <div className="w-full h-28 bg-muted relative border-b border-border/10">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={coverUrl} alt={record.title} className="w-full h-full object-cover" loading="lazy" />
                                  </div>
                                )}
                                <CardContent className={cn("p-3", coverUrl && "pt-3")}>
                                  <div className="flex items-start justify-between min-w-0 mb-1">
                                    <div className="flex gap-3 items-start min-w-0 flex-1">
                                      <Checkbox
                                        checked={selectedRecords.has(record.id)}
                                        onCheckedChange={() => onToggleRecordSelection(record.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-0.5"
                                      />
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <h3 className="text-sm font-medium line-clamp-1">{record.title}</h3>
                                      </div>
                                    </div>
                                  </div>

                                  <p className="text-xs text-muted-foreground mt-2 mb-2 line-clamp-2 min-h-[0.5rem] ml-7">
                                    {record.description || (t("records.kanban.noDescription") || "No description")}
                                  </p>

                                  <div className="ml-7 mb-2">
                                    <DynamicFieldBadges 
                                      record={record} 
                                      limit={3} 
                                      className="mt-0" 
                                      ignoreFields={coverFieldName ? [coverFieldName] : undefined}
                                    />
                                  </div>

                                  {/* Separator */}
                                  <div className="h-px bg-border/50 my-2 ml-7" />

                                  {/* Card footer: Category badge on left, time on right */}
                                  <div className="flex items-center justify-between gap-2 mt-2 ml-7">
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant="outline" 
                                        className="bg-primary/5 text-primary border-primary/20"
                                      >
                                        {record.category?.name || (t("records.uncategorized") || "Uncategorized")}
                                      </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center text-[10px] text-muted-foreground">
                                        <Clock className="h-3 w-3 mr-1" />
                                        <span>
                                          {record.created_at ? formatDistanceToNow(new Date(record.created_at), { addSuffix: true }) : (t("records.unknown") || "Unknown")}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                        )
                      })
                    ) : (
                      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                        {t('records.kanban.noRecords') || 'No records found'}
                      </div>
                    )}
                    {provided.placeholder}
                    
                    {/* Load More Button */}
                    {hasMoreRecords(status.id) && kanbanPagination[status.id] && (
                      <div className="flex justify-center mt-2">
                        <Button
                          variant="outline"
                          onClick={() => onLoadMore(status.id)}
                          disabled={kanbanPagination[status.id].isLoading}
                          className="w-full max-w-xs"
                          size="sm"
                        >
                          {kanbanPagination[status.id].isLoading ? (
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                              <span>{t('records.kanban.loading') || 'Loading'}</span>
                            </div>
                          ) : (t('records.kanban.loadMore') || "Load More")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </div>
    </DragDropContext>
  )
}