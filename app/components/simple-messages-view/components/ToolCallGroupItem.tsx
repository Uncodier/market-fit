import React from 'react'
import { ChevronDown, ChevronRight, Code, LayoutGrid, Zap, Search } from "@/app/components/ui/icons"
import { InstanceLog } from '../types'
import { ToolCallGroup, formatToolDisplayName } from '../utils'
import { ToolCallItem } from './ToolCallItem'

interface ToolCallGroupItemProps {
  group: ToolCallGroup
  isDarkMode: boolean
  isExpanded: boolean
  onToggleExpand: (groupId: string) => void
  collapsedToolDetails: Set<string>
  onToggleToolDetails: (logId: string) => void
  isBrowserVisible?: boolean
}

const renderToolIcon = (toolName: string) => {
  const lower = toolName.toLowerCase()
  if (lower === 'computer') return <Code className="h-3.5 w-3.5" />
  if (lower === 'structured_output') return <LayoutGrid className="h-3.5 w-3.5" />
  if (lower.includes('search') || lower === 'websearch') return <Search className="h-3.5 w-3.5" />
  return <Zap className="h-3.5 w-3.5" />
}

export const ToolCallGroupItem: React.FC<ToolCallGroupItemProps> = ({
  group,
  isDarkMode,
  isExpanded,
  onToggleExpand,
  collapsedToolDetails,
  onToggleToolDetails,
  isBrowserVisible = false
}) => {
  const { toolName, logs, failCount, groupId } = group
  const displayName = formatToolDisplayName(toolName)
  const totalCount = logs.length
  const pendingCount = logs.filter(l => l.details?.status === 'pending').length

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div
        className="rounded-lg text-xs cursor-pointer hover:opacity-90 transition-all duration-200 ease-in-out"
        style={{
          backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
          borderLeft: '3px solid var(--primary)',
          boxShadow: 'none',
          outline: 'none',
          filter: 'none'
        }}
      >
        <div
          className="flex items-center gap-2 p-3"
          onClick={() => onToggleExpand(groupId)}
          title={isExpanded ? "Click to collapse" : "Click to expand"}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0" />
          )}
          {renderToolIcon(toolName)}
          <span className="font-medium text-muted-foreground">
            Tool Call: {displayName}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {totalCount}
          </span>
          {failCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100/90 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {failCount} failed
            </span>
          )}
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-yellow-100/90 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
              <div className="w-2 h-2 bg-yellow-600 rounded-full animate-pulse" />
              {pendingCount} pending
            </span>
          )}
        </div>

        {isExpanded && (
          <div className="border-t border-muted/30 pt-2 pb-2 px-3 space-y-2">
            {logs.map((log, index) => (
              <ToolCallItem
                key={log.id}
                log={log}
                isDarkMode={isDarkMode}
                collapsedToolDetails={collapsedToolDetails}
                onToggleToolDetails={onToggleToolDetails}
                isBrowserVisible={isBrowserVisible}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
