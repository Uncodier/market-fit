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

function triggerTitle(kind: WorkflowTriggerKind) {
  if (kind === "cron") return "Cron trigger"
  if (kind === "db_event") return "Table trigger"
  if (kind === "webhook") return "Webhook trigger"
  return "Manual trigger"
}

function mergeSettings(node: InstanceNode, patch: Record<string, unknown>) {
  return { ...((node.settings as Record<string, unknown>) || {}), ...patch }
}

function WorkflowAddStepPort({ onAddStep }: { onAddStep: () => void }) {
  return (
    <div className="absolute z-20 h-4 w-4" style={{ top: "50%", right: -12, marginTop: -8 }}>
      <button
        type="button"
        aria-label="Add step"
        title="Add step"
        className={cn(
          "relative box-border h-4 w-4 cursor-pointer appearance-none p-0 leading-none",
          "border-2 border-solid border-primary bg-background text-primary",
          "hover:bg-primary hover:text-primary-foreground",
          "focus-visible:outline-none",
        )}
        style={{ borderRadius: "50%", transform: "none" }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onAddStep()
        }}
      >
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center group-hover:opacity-0">
          <span className="block h-1.5 w-1.5 bg-primary" style={{ borderRadius: "50%" }} />
        </span>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="relative block h-[7px] w-[7px]">
            <span className="absolute bg-current" style={{ left: 3, top: 0, width: 1, height: 7 }} />
            <span className="absolute bg-current" style={{ left: 0, top: 3, width: 7, height: 1 }} />
          </span>
        </span>
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
          <div
            className="absolute top-1/2 -translate-y-1/2 -left-3 w-4 h-4 bg-background border-2 border-muted-foreground rounded-full flex items-center justify-center z-20"
            aria-hidden
          >
            <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
          </div>
        )}
        <WorkflowAddStepPort onAddStep={onAddStep} />

        {isTrigger ? (
          <WorkflowTriggerBody
            node={node}
            trigger={trigger}
            enabled={Boolean(settings.enabled)}
            onPersist={persist}
            onKindChange={(kind) =>
              void persist({
                trigger: {
                  ...trigger,
                  kind,
                  ...(kind === "cron" && !trigger.cron ? { cron: DEFAULT_CRON } : {}),
                },
                title: triggerTitle(kind),
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
