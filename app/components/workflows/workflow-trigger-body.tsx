"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { Button } from "@/app/components/ui/button"
import { Switch } from "@/app/components/ui/switch"
import { Check, Copy, PlayCircle, Plus, X } from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { apiClient } from "@/app/services/api-client-service"
import {
  DB_EVENT_TABLES,
  DEFAULT_PLAN_TYPE,
  PLAN_TYPE_OPTIONS,
  TRIGGER_KIND_OPTIONS,
  WF_FIELD_CLASS,
  WF_TEXTAREA_CLASS,
  type WorkflowTriggerConfig,
  type WorkflowTriggerKind,
} from "./types"
import { WorkflowCronFields } from "./workflow-cron-fields"
import { WorkflowSearchSelect } from "./workflow-search-select"

function stopInteract(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function webhookCallUrl(node: InstanceNode) {
  const base = (
    process.env.NEXT_PUBLIC_API_SERVER_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/\/$/, "")
  const params = new URLSearchParams({
    site_id: node.site_id,
    instance_id: node.instance_id,
    trigger_id: node.id,
  })
  return `${base}/api/workflows/triggers/dispatch?${params}`
}

function WorkflowTriggerTableEvents({
  trigger,
  onPersist,
}: {
  trigger: WorkflowTriggerConfig
  onPersist: (patch: Record<string, unknown>) => Promise<unknown>
}) {
  const events =
    trigger.db_events ||
    (trigger.table
      ? [
          {
            table: trigger.table,
            op: (Array.isArray(trigger.op) ? trigger.op : trigger.op ? [trigger.op] : ["insert"]) as (
              | "insert"
              | "update"
              | "delete"
            )[],
          },
        ]
      : [])

  const addEvent = () => {
    void onPersist({ trigger: { ...trigger, db_events: [...events, { table: "leads", op: ["insert"] }] } })
  }

  const updateAt = (index: number, patch: Partial<{ table: string; op: ("insert" | "update" | "delete")[] }>) => {
    const newEvents = events.map((ev, i) => (i === index ? { ...ev, ...patch } : ev))
    void onPersist({ trigger: { ...trigger, db_events: newEvents } })
  }

  const removeAt = (index: number) => {
    const newEvents = events.filter((_, i) => i !== index)
    void onPersist({ trigger: { ...trigger, db_events: newEvents } })
  }

  return (
    <div className="flex flex-col gap-2 bg-background/30 rounded-xl p-2 border border-border/40">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium pl-1">Table Events</p>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={addEvent}>
          <Plus className="h-2.5 w-2.5 mr-1" />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="text-[10px] text-muted-foreground py-1 pl-1">No tables selected</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {events.map((ev, index) => (
            <div
              key={index}
              className="flex flex-col gap-1.5 p-1.5 bg-background/70 border border-border/60 rounded-xl relative group"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-background/80"
                onClick={() => removeAt(index)}
              >
                <X className="h-3 w-3" />
              </Button>

              <div className="pr-5">
                <WorkflowSearchSelect
                  options={DB_EVENT_TABLES.map((table) => ({ value: table, label: table }))}
                  value={ev.table}
                  placeholder="Table"
                  allowCreate
                  onChange={(table) => updateAt(index, { table })}
                />
              </div>

              <div className="flex items-center gap-1">
                {(["insert", "update", "delete"] as const).map((op) => {
                  const isActive = ev.op.includes(op)
                  return (
                    <Button
                      key={op}
                      type="button"
                      variant={isActive ? "outline" : "ghost"}
                      size="sm"
                      className={`flex-1 h-6 text-[10px] rounded-lg ${
                        isActive
                          ? "bg-background shadow-sm border-white/10"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => {
                        let newOps = isActive ? ev.op.filter((o) => o !== op) : [...ev.op, op]
                        if (newOps.length === 0) newOps = ["insert"]
                        updateAt(index, { op: newOps })
                      }}
                    >
                      {op}
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function WorkflowTriggerBody({
  node,
  trigger,
  enabled,
  onPersist,
  onKindsChange,
}: {
  node: InstanceNode
  trigger: WorkflowTriggerConfig
  enabled: boolean
  onPersist: (patch: Record<string, unknown>) => Promise<unknown>
  onKindsChange: (kinds: WorkflowTriggerKind[]) => void
}) {
  const [testing, setTesting] = useState(false)
  const [copied, setCopied] = useState(false)
  const webhookUrl = useMemo(() => webhookCallUrl(node), [node.id, node.instance_id, node.site_id])
  const planType = trigger.plan_type || DEFAULT_PLAN_TYPE
  const activeKinds = trigger.active_kinds || (trigger.kind ? [trigger.kind] : ["manual"])

  const runTest = async () => {
    setTesting(true)
    try {
      const response = await apiClient.post(`/api/workflows/${node.instance_id}/test`, {
        payload: { source: activeKinds[0] || "manual", trigger_id: node.id },
      })
      if (!response.success) throw new Error(response.error?.message || "Test failed")
      toast.success("Test run started (no side effects).")
    } catch (error: any) {
      toast.error(error?.message || "Workflow test failed")
    } finally {
      setTesting(false)
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Could not copy URL")
    }
  }

  return (
    <div
      className="flex flex-col gap-3"
      onPointerDown={stopInteract}
      onClick={stopInteract}
      onKeyDown={stopInteract}
    >
      <div className="flex items-center bg-muted/50 p-1 rounded-2xl gap-1">
        {TRIGGER_KIND_OPTIONS.map(({ kind, label }) => {
          const isActive = activeKinds.includes(kind)
          return (
            <Button
              key={kind}
              type="button"
              variant={isActive ? "outline" : "ghost"}
              size="sm"
              className={`flex-1 h-7 text-[11px] rounded-full font-medium ${
                isActive
                  ? "bg-background shadow-sm border-white/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => {
                let next = isActive ? activeKinds.filter((k) => k !== kind) : [...activeKinds, kind]
                if (next.length === 0) next = ["manual"]
                onKindsChange(next)
              }}
            >
              {label}
            </Button>
          )
        })}
      </div>

      <div className="rounded-2xl bg-muted/30 p-3 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <input
            className={`w-full ${WF_FIELD_CLASS}`}
            placeholder="Workflow Name (e.g. Lead processing)"
            defaultValue={trigger.name || ""}
            key={`${node.id}-name`}
            onBlur={(event) => void onPersist({ trigger: { ...trigger, name: event.target.value } })}
          />
          <textarea
            className={WF_TEXTAREA_CLASS}
            placeholder="Description..."
            defaultValue={trigger.description || ""}
            key={`${node.id}-desc`}
            onBlur={(event) => void onPersist({ trigger: { ...trigger, description: event.target.value } })}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium">Plan type</span>
            <WorkflowSearchSelect
              options={PLAN_TYPE_OPTIONS}
              value={planType}
              placeholder="Plan type"
              allowCreate={false}
              onChange={(next) =>
                void onPersist({
                  trigger: { ...trigger, plan_type: next as typeof planType },
                })
              }
            />
          </label>
        </div>

        {activeKinds.includes("webhook") && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium">Webhook URL</span>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => void copyUrl()}>
                {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <code className="block min-h-9 text-[10px] leading-relaxed text-muted-foreground break-all bg-background/70 border border-border/60 rounded-3xl px-3 py-2">
              POST {webhookUrl}
            </code>
          </div>
        )}

        {activeKinds.includes("cron") && <WorkflowCronFields trigger={trigger} onPersist={onPersist} />}

        {activeKinds.includes("db_event") && <WorkflowTriggerTableEvents trigger={trigger} onPersist={onPersist} />}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full"
            disabled={testing}
            onClick={() => void runTest()}
          >
            {testing ? (
              <LoadingSkeleton variant="button" size="sm" />
            ) : (
              <>
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                Test
              </>
            )}
          </Button>
          <label className="flex items-center gap-2">
            <span className="text-[11px] font-medium">Active</span>
            <Switch checked={enabled} onCheckedChange={(checked) => void onPersist({ enabled: checked })} />
          </label>
        </div>
      </div>
    </div>
  )
}
