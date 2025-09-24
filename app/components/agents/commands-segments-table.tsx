"use client"

import React, { useMemo } from "react"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { AlertCircle, Clock } from "@/app/components/ui/icons"
import type { Command } from "@/app/agents/types"

interface CommandsSegmentsTableProps {
  commands: Command[]
  onLoadMore: () => void
  hasMore: boolean
  isLoading?: boolean
  onRowClick?: (command: Command) => void
}

const getStatusBadge = (status: Command["status"]) => {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  switch (status) {
    case "completed":
      return <Badge className="bg-success/20 text-success border-success/20">Completed</Badge>
    case "running":
      return <Badge className="bg-info/20 text-info border-info/20">Running</Badge>
    case "pending":
      return <Badge className="bg-secondary/20 text-secondary-foreground border-secondary/20">Pending</Badge>
    case "failed":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/20">Failed</Badge>
    case "cancelled":
      return <Badge className="bg-muted text-muted-foreground border-muted/20">Cancelled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

const getStatusIcon = (status: Command["status"]) => {
  if (!status) return <Clock className="h-4 w-4 text-muted-foreground" />;
  switch (status) {
    case "completed":
      return null
    case "running":
      return <Clock className="h-4 w-4 text-info animate-pulse" />
    case "pending":
      return <Clock className="h-4 w-4 text-muted-foreground" />
    case "failed":
      return <AlertCircle className="h-4 w-4 text-destructive" />
    case "cancelled":
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch {
    return "—"
  }
}

const formatDuration = (duration?: number | null) => {
  if (!duration) return "—"
  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`
  const minutes = Math.floor(duration / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function CommandsSegmentsTable({ commands, onLoadMore, hasMore, isLoading = false, onRowClick }: CommandsSegmentsTableProps) {
  const safeCommands = useMemo(() => {
    if (!commands || !Array.isArray(commands)) return []
    return commands.filter(Boolean)
  }, [commands])

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Task</TableHead>
            <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Status</TableHead>
            <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Created</TableHead>
            <TableHead className="w-[110px] min-w-[110px] max-w-[110px]">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeCommands.length > 0 ? (
            safeCommands.map((command, index) => (
              <TableRow key={command.id || `cmd-${index}`} className="group hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onRowClick?.(command)}>
                <TableCell className="py-2 px-2 sm:px-4">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 flex-shrink-0 mt-0.5">
                      {getStatusIcon(command.status)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm line-clamp-2" title={command.task || "No task"}>{command.task || "No task"}</div>
                      {command.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={command.description}>
                          {command.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2 px-2 sm:px-4">{getStatusBadge(command.status)}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-4 whitespace-nowrap">{formatDate(command.created_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-4 whitespace-nowrap">{formatDuration(command.duration)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No commands found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="flex items-center justify-center px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoading}
            className="w-full max-w-xs"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                <span>Loading</span>
              </div>
            ) : "Load More"}
          </Button>
        </div>
      )}
    </Card>
  )
}


