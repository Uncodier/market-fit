"use client"

import React, { useMemo } from "react"
import { Card } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { AlertCircle, Clock, FileText, User, Bot, Settings, CheckCircle2, XCircle } from "@/app/components/ui/icons"
import { InstanceLog } from "@/app/agents/actions"

interface AgentToolsTableProps {
  logs: InstanceLog[]
  onLoadMore: () => void
  hasMore: boolean
  isLoading?: boolean
  onRowClick?: (log: InstanceLog) => void
}

const getLevelBadge = (level: InstanceLog["level"]) => {
  if (!level) return <Badge variant="outline">Unknown</Badge>;
  switch (level) {
    case "debug":
      return <Badge className="bg-muted/20 text-muted-foreground border-muted/20">Debug</Badge>
    case "info":
      return <Badge className="bg-info/20 text-info border-info/20">Info</Badge>
    case "warn":
      return <Badge className="bg-warning/20 text-warning border-warning/20">Warning</Badge>
    case "error":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/20">Error</Badge>
    case "critical":
      return <Badge className="bg-destructive/30 text-destructive border-destructive/30">Critical</Badge>
    default:
      return <Badge variant="outline">{level}</Badge>
  }
}

const getLogTypeIcon = (logType: InstanceLog["log_type"]) => {
  switch (logType) {
    case "system":
      return <FileText className="h-4 w-4 text-muted-foreground" />
    case "user_action":
      return <User className="h-4 w-4 text-blue-500" />
    case "agent_action":
      return <Bot className="h-4 w-4 text-green-500" />
    case "tool_call":
      return <Settings className="h-4 w-4 text-orange-500" />
    case "tool_result":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />
    case "performance":
      return <Clock className="h-4 w-4 text-purple-500" />
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />
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

const formatTokens = (tokensUsed?: any) => {
  if (!tokensUsed) return "—"
  
  if (typeof tokensUsed === 'object') {
    const promptTokens = tokensUsed.promptTokens || tokensUsed.prompt_tokens || 0
    const completionTokens = tokensUsed.completionTokens || tokensUsed.completion_tokens || 0
    const totalTokens = tokensUsed.totalTokens || tokensUsed.total_tokens || (promptTokens + completionTokens)
    
    if (totalTokens > 0) {
      return (
        <div className="text-xs">
          <div>{promptTokens.toLocaleString()} / {completionTokens.toLocaleString()}</div>
          <div className="text-muted-foreground">({totalTokens.toLocaleString()} total) </div>
        </div>
      )
    }
  }
  
  return "—"
}

export function AgentToolsTable({ logs, onLoadMore, hasMore, isLoading = false, onRowClick }: AgentToolsTableProps) {
  const safeLogs = useMemo(() => {
    if (!logs || !Array.isArray(logs)) return []
    return logs.filter(Boolean)
  }, [logs])

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Message</TableHead>
            <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Level</TableHead>
            <TableHead className="w-[130px] min-w-[130px] max-w-[130px]">Created</TableHead>
            <TableHead className="w-[140px] min-w-[140px] max-w-[140px]">Tokens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {safeLogs.length > 0 ? (
            safeLogs.map((log, index) => (
              <TableRow key={log.id || `log-${index}`} className="group hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => onRowClick?.(log)}>
                <TableCell className="py-2 px-2 sm:px-4">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 flex-shrink-0 mt-0.5">
                      {getLogTypeIcon(log.log_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm line-clamp-2" title={log.message || "No message"}>{log.message || "No message"}</div>
                      {log.tool_name && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={log.tool_name}>
                          {log.tool_name}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2 px-2 sm:px-4">{getLevelBadge(log.level)}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-4 whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-4">{formatTokens(log.tokens_used)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No logs found
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
