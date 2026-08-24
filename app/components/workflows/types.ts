export const WF_NODE_TYPES = ['wf-trigger', 'wf-step'] as const
export const WF_LEGACY_NODE_TYPES = ['wf-condition'] as const
export const WF_LOAD_NODE_TYPES = [...WF_NODE_TYPES, ...WF_LEGACY_NODE_TYPES] as const
export type WorkflowNodeType = (typeof WF_NODE_TYPES)[number]

export const WF_RESULT_TYPE = 'wf-result'
export const WF_RESULT_ID_PREFIX = 'dummy-result-'
export const WF_OVERALL_RESULT_ID_PREFIX = 'dummy-result-overall-'

export function isWorkflowResultId(id: string) {
  return id.startsWith(WF_RESULT_ID_PREFIX)
}

export function isOverallResultId(id: string) {
  return id.startsWith(WF_OVERALL_RESULT_ID_PREFIX)
}

export type WorkflowRunPlanStep = {
  id?: string
  status?: string
  title?: string
  created_at?: string
  updated_at?: string
  step_output?: string
  output?: string
  metadata?: { node_id?: string }
}

export type WorkflowRunPlan = {
  id: string
  status?: string
  created_at?: string
  updated_at?: string
  metadata?: { workflow_run?: boolean }
  steps?: WorkflowRunPlanStep[]
}

export const DB_EVENT_TABLES = [
  'leads',
  'deals',
  'conversations',
  'tasks',
  'quotations',
  'reservations',
  'content',
  'sales',
] as const

export type WorkflowTriggerKind = 'cron' | 'db_event' | 'webhook' | 'manual'

export const TRIGGER_KIND_OPTIONS: readonly { kind: WorkflowTriggerKind; label: string }[] = [
  { kind: 'manual', label: 'Manual' },
  { kind: 'cron', label: 'Cron' },
  { kind: 'db_event', label: 'Table' },
  { kind: 'webhook', label: 'Webhook' },
]

export type WorkflowPlanType = 'objective' | 'task' | 'verification' | 'milestone'

export const PLAN_TYPE_OPTIONS: readonly { value: WorkflowPlanType; label: string }[] = [
  { value: 'objective', label: 'Objective' },
  { value: 'task', label: 'Task' },
  { value: 'verification', label: 'Verification' },
  { value: 'milestone', label: 'Milestone' },
]

export interface WorkflowTriggerConfig {
  kind: WorkflowTriggerKind
  name?: string
  description?: string
  plan_type?: WorkflowPlanType
  cron?: string
  cron_preset?: 'custom'
  table?: string
  op?: ('insert' | 'update' | 'delete')[] | 'insert' | 'update' | 'delete'
  // Multiple table events
  db_events?: { table: string; op: ('insert' | 'update' | 'delete')[] }[]
  filter?: Record<string, unknown>
}

export const STEP_SKILL_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'makinari-rol-workflow-step', label: 'Workflow step' },
  { value: 'makinari-rol-qa', label: 'QA' },
  { value: 'makinari-rol-frontend', label: 'Frontend' },
  { value: 'makinari-rol-backend', label: 'Backend' },
  { value: 'makinari-rol-devops', label: 'DevOps' },
  { value: 'makinari-rol-content', label: 'Content' },
  { value: 'makinari-rol-orchestrator', label: 'Orchestrator' },
  { value: 'makinari-rol-investigate', label: 'Investigate' },
  { value: 'makinari-rol-report', label: 'Report' },
  { value: 'makinari-rol-strategy', label: 'Strategy' },
  { value: 'makinari-obj-tarea', label: 'Task' },
  { value: 'general', label: 'General' },
]

export const STEP_ROLE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'assistant', label: 'Assistant' },
  { value: 'qa', label: 'QA' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'devops', label: 'DevOps' },
  { value: 'content', label: 'Content' },
  { value: 'investigate', label: 'Investigate' },
  { value: 'plan', label: 'Plan' },
  { value: 'report', label: 'Report' },
  { value: 'orchestrator', label: 'Orchestrator' },
  { value: 'strategy', label: 'Strategy' },
  { value: 'general', label: 'General' },
]

export const DEFAULT_STEP_SKILL = 'makinari-rol-workflow-step'
export const DEFAULT_STEP_ROLE = 'assistant'
export const DEFAULT_MAX_RETRIES = 2
export const DEFAULT_PLAN_TYPE: WorkflowPlanType = 'objective'

export function roleFromSkill(skill?: string): string {
  if (!skill || skill === DEFAULT_STEP_SKILL || skill === 'makinari-obj-tarea') return DEFAULT_STEP_ROLE
  if (skill === 'general') return 'general'
  const match = skill.match(/^makinari-rol-(.+)$/)
  return match?.[1] || DEFAULT_STEP_ROLE
}

export interface WorkflowMcpAction {
  tool: string
  action?: string
  hint?: string
}

export interface WorkflowValidationRule {
  rule: string
  required?: boolean
  value?: string
}

export function normalizeValidationRules(raw: unknown): WorkflowValidationRule[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (typeof item === 'string') {
      const rule = item.trim()
      return rule ? [{ rule }] : []
    }
    if (!item || typeof item !== 'object') return []
    const rec = item as Record<string, unknown>
    const rule = String(rec.rule ?? rec.name ?? '').trim()
    if (!rule && rec.value == null && typeof rec.required !== 'boolean') return []
    const next: WorkflowValidationRule = { rule }
    if (typeof rec.required === 'boolean') next.required = rec.required
    if (rec.value != null && String(rec.value).trim()) next.value = String(rec.value)
    return [next]
  })
}

export interface WorkflowStepSettings {
  skill?: string
  role?: string
  max_retries?: number
  requires_sandbox?: boolean
  mcp_actions?: WorkflowMcpAction[]
  expected_output?: string
  success_criteria?: string[]
  validation_rules?: WorkflowValidationRule[]
  recovery_plan?: string
}

export type WorkflowStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface McpCatalogTool {
  name: string
  description?: string
  actions?: string[]
}

export const NODE_W = 480
export const NODE_H = 196
export const H_GAP = 80
export const V_GAP = 40

export const WF_FIELD_CLASS =
  "min-w-0 min-h-9 h-9 text-xs bg-background/70 border border-border/60 px-3 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-secondary placeholder:text-muted-foreground/60"

export const WF_TEXTAREA_CLASS =
  "min-w-0 min-h-[72px] w-full text-xs bg-background/70 border-border/60 px-3 py-2.5 rounded-3xl outline-none resize-none focus-visible:ring-1 focus-visible:ring-secondary placeholder:text-muted-foreground/60"
