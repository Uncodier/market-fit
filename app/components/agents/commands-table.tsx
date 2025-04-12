"use client"

import React, { useState, useMemo, memo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Check, AlertCircle, Clock } from "@/app/components/ui/icons"
import { Command } from "@/app/agents/types"

// Maximum number of commands to display at once
const MAX_DISPLAY_COMMANDS = 20;

interface CommandsTableProps {
  commands: Command[]
}

// Memoized table component to prevent excessive re-renders
export const CommandsTable = memo(function CommandsTable({ commands }: CommandsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
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
        return <Check className="h-4 w-4 text-success" />
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
    } catch (error) {
      console.error("Invalid date format:", dateString);
      return "—";
    }
  }

  const formatDuration = (duration?: number | null) => {
    if (!duration) return "—"
    
    if (duration < 1000) {
      return `${duration}ms`
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`
    } else {
      const minutes = Math.floor(duration / 60000)
      const seconds = Math.floor((duration % 60000) / 1000)
      return `${minutes}m ${seconds}s`
    }
  }
  
  // Safe processing of commands with memoization
  const processedCommands = useMemo(() => {
    try {
      if (!commands || !Array.isArray(commands)) return [];
      
      // Only process a limited number of commands to prevent UI freezing
      return commands
        .slice(0, MAX_DISPLAY_COMMANDS)
        .filter(cmd => cmd != null); // Filter out null/undefined commands
    } catch (error) {
      console.error("Error processing commands for table:", error);
      return [];
    }
  }, [commands]);
  
  if (!processedCommands.length) {
    return (
      <div className="w-full text-center py-8">
        <p className="text-sm text-muted-foreground">No commands found</p>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">Task</TableHead>
            <TableHead className="w-[18%]">Status</TableHead>
            <TableHead className="w-[18%]">Created</TableHead>
            <TableHead className="w-[14%]">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processedCommands.map((command) => (
            <TableRow 
              key={command.id || `command-${Math.random()}`}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => toggleRow(command.id || "")}
            >
              <TableCell className="py-2 px-2 sm:px-4">
                <div className="flex items-start gap-1 sm:gap-2">
                  <div className="h-5 w-5 flex-shrink-0 mt-0.5">
                    {getStatusIcon(command.status)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate text-sm">{command.task || "No task"}</div>
                    {command.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5 max-w-[calc(100vw-140px)] sm:max-w-none">
                        {command.description}
                      </div>
                    )}
                    {command.status === "failed" && command.context && (
                      <div className="text-xs text-destructive truncate mt-1 p-1 rounded bg-destructive/5 border border-destructive/10">
                        {typeof command.context === 'string' 
                          ? (command.context.length > 100 
                            ? command.context.substring(0, 100) + "..." 
                            : command.context)
                          : "Error details"}
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-2 px-2 sm:px-4">{getStatusBadge(command.status)}</TableCell>
              <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-4 whitespace-nowrap">{formatDate(command.created_at)}</TableCell>
              <TableCell className="text-xs text-muted-foreground py-2 px-2 sm:px-4 whitespace-nowrap">{formatDuration(command.duration)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {commands.length > MAX_DISPLAY_COMMANDS && (
        <div className="text-xs text-muted-foreground text-center py-2 border-t border-border/50">
          Showing {MAX_DISPLAY_COMMANDS} of {commands.length} commands. Use filters to narrow results.
        </div>
      )}
    </div>
  );
}); 