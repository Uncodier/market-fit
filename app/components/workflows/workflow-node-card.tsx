"use client"

import type { InstanceNode } from "@/app/types/instance-nodes"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Trash2 } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { NODE_W, type WorkflowStepStatus, type WorkflowTriggerConfig, type WorkflowTriggerKind } from "./types"
import { isInteractiveTarget } from "./use-workflow-layout"
import { DEFAULT_CRON } from "./workflow-cron"
import { WorkflowStepBody } from "./workflow-step-body"
import { WorkflowTriggerBody } from "./workflow-trigger-body"

const STATUS_RING: Record<WorkflowStepStatus, string> = {
  pending: "ring-border",
  in_progress: "ring-primary animate-pulse",
  completed: "ring-emerald-500",
  failed: "ring-destructive",
  cancelled: "ring-muted-foreground/40",
}

const TITLE_MAP: Record<WorkflowTriggerKind, string> = {
  cron: "Cron",
  db_event: "Table",
  webhook: "Webhook",
  manual: "Manual",
  channel_message: "Channel message",
}

function triggerTitle(kinds: WorkflowTriggerKind[]) {
  if (!kinds || kinds.length === 0) return "Manual trigger"
  if (kinds.length === 1) return `${TITLE_MAP[kinds[0]]} trigger`
  return `Trigger: ${kinds.map(k => TITLE_MAP[k]).join(" + ")}`
}

function mergeSettings(node: InstanceNode, patch: Record<string, unknown>) {
  return { ...((node.settings as Record<string, unknown>) || {}), ...patch }
}

function WorkflowOutputPorts({
  active,
  onStartConnection,
  onAddStep,
}: {
  active: boolean
  onStartConnection: () => void
  onAddStep: () => void
}) {
  return (
    <div className="absolute z-20 top-1/2 -right-3 -translate-y-3 h-20 w-6">
      <button
        type="button"
        aria-label={active ? "Cancel connection" : "Start connection"}
        title={active ? "Cancel connection" : "Connect to a step"}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background transition-transform hover:scale-125",
          active ? "border-primary ring-2 ring-primary/30" : "border-primary",
        )}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onStartConnection()
        }}
      >
        <span className="h-2 w-2 rounded-full bg-primary" />
      </button>
      <button
        type="button"
        aria-label="Add step"
        title="Add step"
        className={cn(
          "absolute top-14 left-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-primary bg-background text-primary",
          "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-primary hover:text-primary-foreground focus-visible:opacity-100",
        )}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onAddStep()
        }}
      >
        <span aria-hidden className="text-base leading-none">+</span>
      </button>
    </div>
  )
}

export function WorkflowNodeCard({
  node,
  selected,
  runStatus,
  actionRunning,
  onSelect,
  onMouseDown,
  onChange,
  onDelete,
  onAddStep,
  onStartConnection,
  onInputConnection,
  connectionSourceId = null,
  hasExecutableStep = true,
  hasUnsupportedChannelStep = false,
  overlappingTriggers = 0,
}: {
  node: InstanceNode
  selected: boolean
  runStatus?: WorkflowStepStatus
  actionRunning?: boolean
  onSelect: () => void
  onMouseDown: (event: React.MouseEvent) => void
  onChange: (id: string, patch: Partial<InstanceNode>) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onAddStep: () => void
  onStartConnection: () => void
  onInputConnection: () => void
  connectionSourceId?: string | null
  hasExecutableStep?: boolean
  hasUnsupportedChannelStep?: boolean
  overlappingTriggers?: number
}) {
  const settings = (node.settings || {}) as {
    enabled?: boolean
    trigger?: WorkflowTriggerConfig
  }
  const trigger = (settings.trigger || { kind: "manual" }) as WorkflowTriggerConfig
  const isTrigger = node.type === "wf-trigger"

  const persist = (patch: Record<string, unknown>) =>
    onChange(node.id, { settings: mergeSettings(node, patch) })

  return (
    <Card
      tabIndex={0}
      onClick={onSelect}
      onMouseDown={onMouseDown}
      onKeyDown={(event) => {
        if (isInteractiveTarget(event.target)) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "group relative w-full shadow-[0_0_10px_rgba(0,0,0,0.05)] border-2 bg-card rounded-3xl cursor-grab active:cursor-grabbing text-left overflow-visible",
        selected ? "border-primary" : "border-foreground/10",
        runStatus ? `ring-2 ${STATUS_RING[runStatus]}` : "",
        actionRunning ? "imprenta-action-running" : "",
      )}
      style={{ width: NODE_W }}
    >
      <div
        className="absolute z-20 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ top: -36, right: -6 }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="h-8 w-8 rounded-full p-0 shadow-md shrink-0 [&_svg]:size-3"
          onClick={(event) => {
            event.stopPropagation()
            void onDelete(node.id)
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="relative p-5">
        {node.type !== "wf-trigger" && (
          <button
            type="button"
            className={cn(
              "absolute top-1/2 -translate-y-1/2 -left-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-background transition-transform hover:scale-125",
              connectionSourceId ? "border-primary" : "border-muted-foreground",
            )}
            aria-label={connectionSourceId ? "Connect step here" : node.parent_node_id ? "Disconnect step" : "Step input"}
            title={connectionSourceId ? "Connect step here" : node.parent_node_id ? "Disconnect from parent" : "Select an output to connect"}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onInputConnection()
            }}
          >
            <span className={cn("h-2 w-2 rounded-full", connectionSourceId ? "bg-primary" : "bg-muted-foreground")} />
          </button>
        )}
        <WorkflowOutputPorts active={connectionSourceId === node.id} onStartConnection={onStartConnection} onAddStep={onAddStep} />

        {isTrigger ? (
          <WorkflowTriggerBody
            node={node}
            trigger={trigger}
            enabled={Boolean(settings.enabled)}
            hasExecutableStep={hasExecutableStep}
            hasUnsupportedChannelStep={hasUnsupportedChannelStep}
            overlappingTriggers={overlappingTriggers}
            onPersist={persist}
            onKindsChange={(kinds) =>
              void persist({
                trigger: {
                  ...trigger,
                  kind: kinds[0] || "manual",
                  active_kinds: kinds,
                  ...(kinds.includes("cron") && !trigger.cron ? { cron: DEFAULT_CRON } : {}),
                },
                title: triggerTitle(kinds),
                ...(kinds.includes("channel_message") && (!hasExecutableStep || hasUnsupportedChannelStep) ? { enabled: false } : {}),
              })
            }
          />
        ) : (
          <WorkflowStepBody node={node} runStatus={runStatus} onChange={onChange} />
        )}
      </div>
    </Card>
  )
}
