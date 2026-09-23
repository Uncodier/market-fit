"use client"

import { Button } from "@/app/components/ui/button"
import { Plus, X } from "@/app/components/ui/icons"
import {
  type McpCatalogTool,
  type WorkflowMcpAction,
} from "./types"
import { WorkflowSearchSelect } from "./workflow-search-select"

function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function toolDisplayLabel(tool: McpCatalogTool) {
  return tool.label?.trim() || humanize(tool.name)
}

export function WorkflowStepToolsList({
  actions,
  catalog,
  loading,
  error,
  onRetry,
  onChange,
}: {
  actions: WorkflowMcpAction[]
  catalog: McpCatalogTool[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onChange: (actions: WorkflowMcpAction[]) => void
}) {
  const selected = new Set(actions.map((item) => item.tool).filter(Boolean))
  const unused = catalog.filter((tool) => !selected.has(tool.name))

  const addTool = () => {
    const next = unused[0]
    onChange([
      ...actions,
      next
        ? {
            tool: next.name,
            hint: `Use ${toolDisplayLabel(next)} to fulfill this step`,
          }
        : { tool: "", hint: "" },
    ])
  }

  const updateAt = (index: number, patch: Partial<WorkflowMcpAction>) => {
    onChange(
      actions.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Tools</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={loading || unused.length === 0}
          onClick={addTool}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground py-1">Loading tools...</p>
      )}
      {!loading && error && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2">
          <p className="min-w-0 text-[11px] text-destructive">
            Could not load tools: {error}
          </p>
          {onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </div>
      )}
      {!loading && !error && catalog.length === 0 && (
        <p className="text-xs text-muted-foreground py-1">
          No tools available
        </p>
      )}

      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">
          None (agent infers)
        </p>
      ) : (
        actions.map((action, index) => {
          const meta = catalog.find((tool) => tool.name === action.tool)
          const toolOptions = catalog
            .filter(
              (tool) => tool.name === action.tool || !selected.has(tool.name),
            )
            .map((tool) => ({
              value: tool.name,
              label: toolDisplayLabel(tool),
            }))
          const actionOptions = (meta?.actions || []).map((name) => ({
            value: name,
            label: humanize(name),
          }))

          return (
            <div
              key={`${action.tool}-${index}`}
              className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/50 p-2"
            >
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <WorkflowSearchSelect
                  options={toolOptions}
                  value={action.tool}
                  placeholder="Tool"
                  allowCreate={false}
                  onChange={(tool) => {
                    const selectedTool = catalog.find(
                      (item) => item.name === tool,
                    )
                    updateAt(index, {
                      tool,
                      action: undefined,
                      hint: selectedTool
                        ? `Use ${toolDisplayLabel(selectedTool)} to fulfill this step`
                        : "",
                    })
                  }}
                />
                {actionOptions.length > 0 && (
                  <WorkflowSearchSelect
                    options={actionOptions}
                    value={action.action || ""}
                    placeholder="All actions"
                    allowCreate={false}
                    clearable
                    onChange={(next) =>
                      updateAt(index, { action: next || undefined })
                    }
                  />
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove tool"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive mt-1"
                onClick={() => onChange(actions.filter((_, i) => i !== index))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        })
      )}
    </div>
  )
}
