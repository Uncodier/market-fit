"use client"

import React from "react"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Bot, Loader, Trash2 } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import {
  DocumentListHead,
  DocumentListRow,
  EntityAvatar,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"
import { cn } from "@/lib/utils"
import {
  getInstanceDisplayName,
  getInstancePreview,
  getInstanceStatusKey,
  getInstanceStatusLabel,
  type InstanceMessages,
  type InstanceStats,
  type RobotInstance,
} from "./instance-browser-model"

interface InstanceBrowserTableProps {
  instances: RobotInstance[]
  instanceStats: Record<string, InstanceStats>
  instanceMessages: Record<string, InstanceMessages>
  isLoadingStats: boolean
  isLoadingMessages: boolean
  onSelect: (id: string) => void
  onDelete?: (instance: { id: string; name: string }) => void
  deletingInstanceIds?: Set<string>
  emptyTitle: string
  emptyDescription: string
  labels: {
    name: string
    status: string
    nodes: string
    workflows: string
    files: string
    requirements: string
    updated: string
    delete: string
    deleting: string
  }
}

function CountCell({ value, loading }: { value?: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-4 w-8" />
  return (
    <span className={cn("text-sm tabular-nums", value ? "font-medium text-foreground" : "text-muted-foreground")}>
      {value || "—"}
    </span>
  )
}

function InstanceAvatar({ name, avatarUrl, loading }: { name: string; avatarUrl?: string | null; loading: boolean }) {
  if (loading) return <Skeleton className="h-9 w-9 rounded-full" />
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full border border-border object-cover bg-muted"
      />
    )
  }
  return <EntityAvatar name={name} />
}

export function InstanceBrowserTable({
  instances,
  instanceStats,
  instanceMessages,
  isLoadingStats,
  isLoadingMessages,
  onSelect,
  onDelete,
  deletingInstanceIds,
  emptyTitle,
  emptyDescription,
  labels,
}: InstanceBrowserTableProps) {
  if (instances.length === 0) {
    return (
      <EmptyCard
        icon={<Bot className="h-8 w-8 text-muted-foreground" />}
        title={emptyTitle}
        description={emptyDescription}
        variant="simple"
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[860px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[32%] pl-4">{labels.name}</DocumentListHead>
              <DocumentListHead className="w-[14%]">{labels.status}</DocumentListHead>
              <DocumentListHead className="w-[9%]">{labels.nodes}</DocumentListHead>
              <DocumentListHead className="w-[11%]">{labels.workflows}</DocumentListHead>
              <DocumentListHead className="w-[8%]">{labels.files}</DocumentListHead>
              <DocumentListHead className="w-[12%]">{labels.requirements}</DocumentListHead>
              <DocumentListHead className="w-[10%]">{labels.updated}</DocumentListHead>
              <DocumentListHead className="w-[48px]" align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((instance) => {
              const displayName = getInstanceDisplayName(instance)
              const stats = instanceStats[instance.id]
              const previewLoading = isLoadingMessages && !instanceMessages[instance.id]
              const statsLoading = isLoadingStats && !stats
              const preview = getInstancePreview(instanceMessages[instance.id])
              const statusKey = getInstanceStatusKey(instance.status)
              const updatedAt = instance.updated_at || instance.created_at
              const updatedDate = updatedAt ? new Date(updatedAt) : null
              const updatedValid = updatedDate && !isNaN(updatedDate.getTime())
              const isDeleting = deletingInstanceIds?.has(instance.id) ?? false
              const isRunning = ["running", "active"].includes(instance.status || "")

              return (
                <DocumentListRow
                  key={instance.id}
                  onClick={() => onSelect(instance.id)}
                  accent="none"
                  className={isRunning ? "bg-emerald-500/5" : undefined}
                >
                  <TableCell className="py-3.5">
                    <div className="flex min-w-0 items-center gap-3 pl-4">
                      <InstanceAvatar name={displayName} avatarUrl={stats?.avatarUrl} loading={statsLoading} />
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium leading-tight text-foreground" title={displayName}>
                          {displayName}
                        </p>
                        {previewLoading ? (
                          <Skeleton className="h-3 w-40" />
                        ) : preview ? (
                          <p className="truncate text-[11px] leading-tight text-muted-foreground/80" title={preview}>
                            {preview}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={statusKey} label={getInstanceStatusLabel(instance.status)} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <CountCell value={stats?.nodes} loading={statsLoading} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <CountCell value={stats?.workflows} loading={statsLoading} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <CountCell value={stats?.assets} loading={statsLoading} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <CountCell value={stats?.requirements} loading={statsLoading} />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {updatedValid ? format(updatedDate, "MMM d, yyyy") : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                    {onDelete ? (
                      <div className="flex justify-end pr-2 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={isDeleting}
                              onClick={() => onDelete({ id: instance.id, name: displayName })}
                            >
                              {isDeleting ? <Loader className="h-4 w-4" size={16} /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isDeleting ? labels.deleting : labels.delete}</TooltipContent>
                        </Tooltip>
                      </div>
                    ) : null}
                  </TableCell>
                </DocumentListRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
