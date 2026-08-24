"use client"

import { useEffect, useState } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { Button } from "@/app/components/ui/button"
import { Switch } from "@/app/components/ui/switch"
import { Textarea } from "@/app/components/ui/textarea"
import { Plus, X } from "@/app/components/ui/icons"
import { apiClient } from "@/app/services/api-client-service"
import { cn } from "@/lib/utils"
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_STEP_ROLE,
  DEFAULT_STEP_SKILL,
  STEP_ROLE_OPTIONS,
  STEP_SKILL_OPTIONS,
  WF_FIELD_CLASS,
  WF_TEXTAREA_CLASS,
  roleFromSkill,
  type McpCatalogTool,
  type WorkflowMcpAction,
  type WorkflowStepSettings,
  type WorkflowStepStatus,
} from "./types"
import { WorkflowStepValidationList } from "./workflow-step-validation"
import { WorkflowSearchSelect } from "./workflow-search-select"

type StepTab = "task" | "output" | "validation" | "environment" | "tools"

const STEP_TABS: readonly { id: StepTab; label: string; title: string }[] = [
  { id: "task", label: "Task", title: "Task" },
  { id: "output", label: "Output", title: "Expected output" },
  { id: "validation", label: "Validation", title: "Validation rules" },
  { id: "environment", label: "Environment", title: "Environment settings" },
  { id: "tools", label: "Tools", title: "Required tool calls" },
]

function mergeSettings(node: InstanceNode, patch: Record<string, unknown>) {
  return { ...((node.settings as Record<string, unknown>) || {}), ...patch }
}

function stopInteract(event: React.SyntheticEvent) {
  event.stopPropagation()
}

function WorkflowStepTaskFields({
  nodeId,
  step,
  instructions,
  onPersist,
}: {
  nodeId: string
  step: WorkflowStepSettings
  instructions: string
  onPersist: (nextSettings: Record<string, unknown>, promptText?: string) => Promise<unknown>
}) {
  const skill = step.skill || DEFAULT_STEP_SKILL
  const role = step.role || DEFAULT_STEP_ROLE

  const persistStep = (patch: Partial<WorkflowStepSettings>) =>
    onPersist({ step: { ...step, ...patch } } as Record<string, unknown>)

  return (
    <>
      <Textarea
        defaultValue={instructions}
        key={`${nodeId}-instructions`}
        placeholder="Describe what this step should accomplish."
        className={`${WF_TEXTAREA_CLASS} max-h-[160px]`}
        onBlur={(event) => void onPersist({}, event.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium">Skill</span>
          <WorkflowSearchSelect
            options={STEP_SKILL_OPTIONS}
            value={skill}
            placeholder="Skill"
            onChange={(nextSkill) =>
              void persistStep({ skill: nextSkill, role: roleFromSkill(nextSkill) })
            }
          />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] font-medium">Role</span>
          <WorkflowSearchSelect
            options={STEP_ROLE_OPTIONS}
            value={role}
            placeholder="Role"
            onChange={(nextRole) => void persistStep({ role: nextRole })}
          />
        </label>
      </div>
    </>
  )
}

function WorkflowStepToolsList({
  actions,
  catalog,
  onChange,
}: {
  actions: WorkflowMcpAction[]
  catalog: McpCatalogTool[]
  onChange: (actions: WorkflowMcpAction[]) => void
}) {
  const selected = new Set(actions.map((item) => item.tool).filter(Boolean))
  const unused = catalog.filter((tool) => !selected.has(tool.name))

  const addTool = () => {
    const next = unused[0]
    onChange([
      ...actions,
      next
        ? { tool: next.name, hint: `Use ${next.name} to fulfill this step` }
        : { tool: "", hint: "" },
    ])
  }

  const updateAt = (index: number, patch: Partial<WorkflowMcpAction>) => {
    onChange(actions.map((item, i) => (i === index ? { ...item, ...patch } : item)))
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
          onClick={addTool}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">None (agent infers)</p>
      ) : (
        actions.map((action, index) => {
          const meta = catalog.find((tool) => tool.name === action.tool)
          const toolOptions = catalog
            .filter((tool) => tool.name === action.tool || !selected.has(tool.name))
            .map((tool) => ({ value: tool.name, label: tool.name }))
          const actionOptions = (meta?.actions || []).map((name) => ({ value: name, label: name }))
          return (
            <div key={`${action.tool}-${index}`} className="flex items-start gap-2">
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <WorkflowSearchSelect
                  options={toolOptions}
                  value={action.tool}
                  placeholder="Tool"
                  onChange={(tool) =>
                    updateAt(index, { tool, action: undefined, hint: tool ? `Use ${tool} to fulfill this step` : "" })
                  }
                />
                <WorkflowSearchSelect
                  options={actionOptions}
                  value={action.action || ""}
                  placeholder="Any action"
                  clearable
                  onChange={(next) => updateAt(index, { action: next || undefined })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
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

export function WorkflowStepBody({
  node,
  runStatus,
  onChange,
}: {
  node: InstanceNode
  runStatus?: WorkflowStepStatus
  onChange: (id: string, patch: Partial<InstanceNode>) => Promise<unknown>
}) {
  const [catalog, setCatalog] = useState<McpCatalogTool[]>([])
  const [tab, setTab] = useState<StepTab>("task")
  const settings = (node.settings || {}) as { title?: string; step?: WorkflowStepSettings }
  const step = (settings.step || {}) as WorkflowStepSettings
  const title = String(settings.title || "")
  const instructions = String((node.prompt as { text?: string })?.text || "")
  const sandbox = Boolean(step.requires_sandbox)
  const tabs = STEP_TABS

  useEffect(() => {
    void apiClient.get<{ tools?: McpCatalogTool[] }>("/api/workflows/mcp-catalog").then((res) => {
      const tools = (res.data as { tools?: McpCatalogTool[] })?.tools
      if (Array.isArray(tools)) setCatalog(tools)
    })
  }, [])

  const persist = (nextSettings: Record<string, unknown>, promptText?: string) => {
    const patch: Partial<InstanceNode> = { settings: nextSettings }
    if (promptText !== undefined) patch.prompt = { ...(node.prompt as object), text: promptText }
    return onChange(node.id, patch)
  }

  const toggleSandbox = async (checked: boolean) => {
    if (checked && typeof window !== "undefined" && !sessionStorage.getItem("wf-sandbox-confirm")) {
      const ok = window.confirm(
        "This step starts a billed VM. Resume uses this workflow’s plan id (not a requirement). Only enable if the step needs a repo/shell.",
      )
      if (!ok) return
      sessionStorage.setItem("wf-sandbox-confirm", "1")
    }
    await persist(mergeSettings(node, { step: { ...step, requires_sandbox: checked } }))
  }

  return (
    <div
      className="flex flex-col gap-3"
      onPointerDown={stopInteract}
      onMouseDown={stopInteract}
      onClick={stopInteract}
      onKeyDown={stopInteract}
    >
      <div className="flex items-center gap-2">
        <input
          className={cn(WF_FIELD_CLASS, "flex-1 text-sm font-medium bg-muted/30")}
          defaultValue={title}
          key={`${node.id}-title`}
          placeholder="Step title"
          onBlur={(event) => void persist(mergeSettings(node, { title: event.target.value }))}
        />
        {sandbox && (
          <div className="h-7 px-2.5 text-[11px] rounded-full font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center shrink-0">
            VM
          </div>
        )}
        {runStatus && runStatus !== "pending" && (
          <div className="h-7 px-2.5 text-[11px] rounded-full font-medium text-muted-foreground flex items-center capitalize shrink-0">
            {runStatus.replace("_", " ")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center bg-muted/50 p-1 rounded-2xl gap-1">
        {tabs.map(({ id, label, title: tabTitle }) => (
          <Button
            key={id}
            type="button"
            variant={tab === id ? "outline" : "ghost"}
            size="sm"
            title={tabTitle}
            className={`flex-1 h-7 text-[11px] rounded-full font-medium ${
              tab === id ? "bg-background shadow-sm border-white/10" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl bg-muted/30 p-3 flex flex-col gap-2">
        {tab === "task" && (
          <WorkflowStepTaskFields
            nodeId={node.id}
            step={step}
            instructions={instructions}
            onPersist={(patch, promptText) => persist(mergeSettings(node, patch), promptText)}
          />
        )}

        {tab === "output" && (
          <Textarea
            defaultValue={step.expected_output || ""}
            key={`${node.id}-expected`}
            placeholder="Expected output"
            className={`${WF_TEXTAREA_CLASS} font-mono max-h-[140px]`}
            onBlur={(event) =>
              void persist(mergeSettings(node, { step: { ...step, expected_output: event.target.value } }))
            }
          />
        )}

        {tab === "validation" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium">Success criteria</span>
              <Textarea
                defaultValue={(step.success_criteria || []).join("\n")}
                key={`${node.id}-criteria`}
                placeholder="How this step is considered done (one per line)"
                className={`${WF_TEXTAREA_CLASS} max-h-[120px]`}
                onBlur={(event) =>
                  void persist(
                    mergeSettings(node, {
                      step: {
                        ...step,
                        success_criteria: event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      },
                    }),
                  )
                }
              />
            </label>
            <WorkflowStepValidationList
              nodeId={node.id}
              rules={step.validation_rules}
              onChange={(validation_rules) =>
                void persist(mergeSettings(node, { step: { ...step, validation_rules } }))
              }
            />
          </>
        )}

        {tab === "environment" && (
          <>
            <label className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium">Requires sandbox (compute)</span>
              <Switch checked={sandbox} onCheckedChange={(checked) => void toggleSandbox(checked)} />
            </label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              This step starts a billed VM. Resume uses this workflow’s plan id. Only enable if the step needs a
              repo or shell.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium">Max retries</span>
              <input
                type="number"
                min={0}
                max={20}
                className={`w-full ${WF_FIELD_CLASS}`}
                defaultValue={step.max_retries ?? DEFAULT_MAX_RETRIES}
                key={`${node.id}-retries`}
                onBlur={(event) => {
                  const value = Math.min(20, Math.max(0, Number(event.target.value) || 0))
                  event.target.value = String(value)
                  void persist(mergeSettings(node, { step: { ...step, max_retries: value } }))
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium">Recovery plan</span>
              <Textarea
                defaultValue={step.recovery_plan || ""}
                key={`${node.id}-recovery`}
                placeholder="If this step fails, try this instead of the original Task (used only on retry)."
                className={`${WF_TEXTAREA_CLASS} max-h-[120px]`}
                onBlur={(event) =>
                  void persist(
                    mergeSettings(node, {
                      step: { ...step, recovery_plan: event.target.value.trim() || undefined },
                    }),
                  )
                }
              />
            </label>
          </>
        )}

        {tab === "tools" && (
          <WorkflowStepToolsList
            actions={step.mcp_actions || []}
            catalog={catalog}
            onChange={(mcp_actions) =>
              void persist(mergeSettings(node, { step: { ...step, mcp_actions } }))
            }
          />
        )}
      </div>
    </div>
  )
}
