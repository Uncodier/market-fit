import React from 'react'
import {
  Brain,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Loader,
  Server,
  Zap,
} from '@/app/components/ui/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from '../utils/markdownComponents'
import { InstancePlan } from '../types'
import {
  getProcessHeader,
  isStepCompletedLog,
  processGroupLogs,
  splitProcessAnswer,
  type ProcessActivityKind,
  type ProcessGroup,
  type ProcessGroupEntry,
} from '../group-timeline-process'
import { ToolCallItem } from './ToolCallItem'
import { StepCompletedItem } from './StepCompletedItem'
import { CompletedPlanCard } from './CompletedPlanCard'

interface ProcessGroupItemProps {
  group: ProcessGroup
  isDarkMode: boolean
  isExpanded: boolean
  isLive?: boolean
  onToggleExpand: (groupId: string) => void
  collapsedToolDetails: Set<string>
  onToggleToolDetails: (logId: string) => void
  isBrowserVisible?: boolean
  onEditPlan?: (plan: InstancePlan) => void
}

function ActivityIcon({ kind }: { kind: ProcessActivityKind }) {
  if (kind === 'tool') return <Zap className="h-3.5 w-3.5 shrink-0" />
  if (kind === 'step') return <ListTodo className="h-3.5 w-3.5 shrink-0" />
  if (kind === 'infrastructure') return <Server className="h-3.5 w-3.5 shrink-0" />
  return <Brain className="h-3.5 w-3.5 shrink-0" />
}

function ProcessEntryBody({
  entry,
  isDarkMode,
  collapsedToolDetails,
  onToggleToolDetails,
  isBrowserVisible,
  onEditPlan,
}: {
  entry: ProcessGroupEntry
  isDarkMode: boolean
  collapsedToolDetails: Set<string>
  onToggleToolDetails: (logId: string) => void
  isBrowserVisible?: boolean
  onEditPlan?: (plan: InstancePlan) => void
}) {
  if (entry.type === 'completed_plan') {
    return <CompletedPlanCard plan={entry.data} onEditPlan={onEditPlan} />
  }

  const log = entry.data
  if (isStepCompletedLog(log)) {
    return <StepCompletedItem log={log} isDarkMode={isDarkMode} />
  }

  if (log.log_type === 'tool_call' || log.log_type === 'tool_result') {
    return (
      <ToolCallItem
        log={log}
        isDarkMode={isDarkMode}
        collapsedToolDetails={collapsedToolDetails}
        onToggleToolDetails={onToggleToolDetails}
        isBrowserVisible={isBrowserVisible}
      />
    )
  }

  const text = (log.message || '').trim()
  if (!text) return null

  return (
    <div className="text-xs leading-relaxed text-muted-foreground prose prose-sm max-w-none dark:prose-invert prose-p:my-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

export function ProcessGroupItem({
  group,
  isDarkMode,
  isExpanded,
  isLive = false,
  onToggleExpand,
  collapsedToolDetails,
  onToggleToolDetails,
  isBrowserVisible = false,
  onEditPlan,
}: ProcessGroupItemProps) {
  const logs = processGroupLogs(group)
  const { processLogs, answer } = splitProcessAnswer(logs)
  const processLogIds = new Set(processLogs.map((log) => log.id))
  const processEntries = group.entries.filter((entry) =>
    entry.type === 'completed_plan' || (entry.type === 'log' && processLogIds.has(entry.data.id))
  )
  const activity = getProcessHeader(
    isLive ? group.entries : processEntries,
    isLive,
    answer?.created_at
  )
  const showAccordion = processEntries.length > 0 || isLive

  return (
    <div className="w-full min-w-0 overflow-hidden">
      {showAccordion && (
        <div className="w-full min-w-[min(100%,450px)] overflow-hidden max-w-[calc(100%-80px)] lg:max-w-3xl">
          <button
            type="button"
            className="flex items-center gap-2 py-1 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onToggleExpand(group.groupId)}
            title={isExpanded ? 'Hide thought process' : 'Show thought process'}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            <ActivityIcon kind={activity.kind} />
            <span className="font-medium truncate">{activity.label}</span>
            {isLive && <Loader className="h-3.5 w-3.5 shrink-0 text-muted-foreground animate-spin" />}
          </button>

          {isExpanded && processEntries.length > 0 && (
            <div
              className="mt-2 mb-3 pl-6 border-l-2 border-border/50 space-y-4"
            >
              {processEntries.map((entry) => (
                <ProcessEntryBody
                  key={entry.type === 'log' ? entry.data.id : `plan-${entry.data.id}`}
                  entry={entry}
                  isDarkMode={isDarkMode}
                  collapsedToolDetails={collapsedToolDetails}
                  onToggleToolDetails={onToggleToolDetails}
                  isBrowserVisible={isBrowserVisible}
                  onEditPlan={onEditPlan}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {answer && (
        <div className="w-full min-w-0 overflow-hidden">
          <div
            className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words"
            style={{
              wordWrap: 'break-word',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
              paddingLeft: isBrowserVisible ? '0.75rem' : '2rem',
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {answer.message}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
