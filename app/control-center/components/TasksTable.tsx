"use client"

import React, { useMemo } from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Pagination } from "@/app/components/ui/pagination"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { ClipboardList, MessageSquare } from "@/app/components/ui/icons"
import { Task } from "@/app/types"
import { TaskSelectionAvatar } from "./TaskSelectionAvatar"
import { format, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  DocumentListHead,
  DocumentListRow,
  EntityAvatar,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

interface ExtendedTask extends Task {
  leadName?: string
  assigneeName?: string
  comments_count?: number
}

interface TasksTableProps {
  tasks: ExtendedTask[]
  currentPage: number
  itemsPerPage: number
  totalTasks: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onTaskClick: (task: ExtendedTask) => void
  categories: Array<{ id: string; name: string }>
  selectedTasks: Set<string>
  onToggleTaskSelection: (taskId: string) => void
}

const STATUS_ORDER = ["pending", "in_progress", "completed", "failed", "canceled"] as const

function serialLabel(serialId?: string) {
  if (!serialId) return null
  const match = serialId.match(/^([A-Z]+)-(\d+)$/)
  if (match) return `${match[1]}-${parseInt(match[2], 10)}`
  return serialId
}

function isOverdue(task: ExtendedTask) {
  if (!task.scheduled_date) return false
  if (task.status === "completed" || task.status === "canceled" || task.status === "failed") return false
  const due = new Date(task.scheduled_date)
  if (isNaN(due.getTime())) return false
  return due < startOfDay(new Date())
}

function taskAccent(task: ExtendedTask): "due" | "cancelled" | "none" {
  if (task.status === "canceled" || task.status === "failed") return "cancelled"
  if (task.status === "pending" || isOverdue(task)) return "due"
  return "none"
}

export function TasksTable({
  tasks,
  currentPage,
  itemsPerPage,
  totalTasks,
  onPageChange,
  onItemsPerPageChange,
  onTaskClick,
  selectedTasks,
  onToggleTaskSelection,
}: TasksTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalTasks / itemsPerPage)
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage

  const groupedTasks = useMemo(() => {
    const groups: Record<string, ExtendedTask[]> = {}
    STATUS_ORDER.forEach((status) => {
      groups[status] = []
    })
    tasks.forEach((task) => {
      const key = task.status && groups[task.status] ? task.status : "pending"
      groups[key].push(task)
    })
    return groups
  }, [tasks])

  if (tasks.length === 0) {
    return (
      <EmptyCard
        icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
        title={t("controlCenter.table.noTasksAll") || "No tasks found."}
        description={t("controlCenter.empty.desc") || "There are no tasks to display at this time."}
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[38%]">{t("controlCenter.table.title") || "Title"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("controlCenter.table.stage") || "Stage"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("controlCenter.table.assignee") || "Assignee"}</DocumentListHead>
            <DocumentListHead className="w-[18%]" align="right">{t("controlCenter.table.dueDate") || "Due Date"}</DocumentListHead>
            <DocumentListHead className="w-[14%]" align="right">{t("controlCenter.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {STATUS_ORDER.map((statusId) => {
            const statusItems = groupedTasks[statusId] || []
            if (statusItems.length === 0) return null
            const statusKey = statusId === "in_progress" ? "inProgress" : statusId
            const statusLabel = t(`controlCenter.status.${statusKey}`) || statusId.replace("_", " ")

            return (
              <React.Fragment key={statusId}>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="bg-muted/30 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot status={statusId} label={statusLabel} />
                      <span className="text-[11px] tabular-nums text-muted-foreground/70">
                        {statusItems.length}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {statusItems.map((task) => {
                  const overdue = isOverdue(task)
                  const serial = serialLabel(task.serial_id)
                  const lead = task.leadName || task.leads?.name
                  const comments = task.comments_count || task.comments?.length || 0
                  const meta = [
                    lead,
                    comments > 0
                      ? `${comments} ${comments === 1 ? (t("controlCenter.table.comment") || "comment") : (t("controlCenter.table.comments") || "comments")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                  const stageLabel = task.stage
                    ? t(`controlCenter.stages.${task.stage}`) || task.stage
                    : null
                  const dueDate = task.scheduled_date ? new Date(task.scheduled_date) : null
                  const dueValid = dueDate && !isNaN(dueDate.getTime())
                  const assignee = task.assigneeName || task.assignee_details?.name

                  return (
                    <DocumentListRow
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      accent={taskAccent(task)}
                      className={selectedTasks.has(task.id) ? "bg-primary/5" : undefined}
                    >
                      <TableCell className="py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <TaskSelectionAvatar
                            assigneeName={assignee}
                            isSelected={selectedTasks.has(task.id)}
                            size="md"
                            onToggle={(event) => {
                              event.stopPropagation()
                              onToggleTaskSelection(task.id)
                            }}
                          />
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-medium leading-tight text-foreground" title={task.title}>
                              {task.title}
                            </p>
                            {serial ? (
                              <p className="truncate font-mono text-[11px] leading-tight text-muted-foreground">
                                {serial}
                              </p>
                            ) : null}
                            {meta ? (
                              <p className="truncate text-[11px] leading-tight text-muted-foreground/80">{meta}</p>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        {stageLabel && task.stage ? (
                          <StatusDot status={task.stage} label={stageLabel} />
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        {assignee ? (
                          <div className="flex min-w-0 items-center gap-2">
                            <EntityAvatar name={assignee} className="h-7 w-7 text-[10px]" />
                            <span className="truncate text-sm">{assignee}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("controlCenter.table.unassigned") || "Unassigned"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className={cn(
                              "text-[15px] font-semibold tabular-nums tracking-tight whitespace-nowrap",
                              overdue && "text-amber-600 dark:text-amber-400",
                              (task.status === "canceled" || task.status === "failed") && "text-muted-foreground line-through decoration-muted-foreground/60"
                            )}
                          >
                            {dueValid ? format(dueDate, "MMM d, yyyy") : "—"}
                          </span>
                          {overdue ? (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              {t("controlCenter.table.overdue") || "Overdue"}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                        {comments > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {comments}
                          </span>
                        ) : null}
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
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalTasks)}</span>
            {" – "}
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + tasks.length, totalTasks)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalTasks}</span>
            {" "}
            {t("controlCenter.table.tasks") || "tasks"}
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
