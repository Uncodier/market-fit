/** @jest-environment node */
import { LeadSchema, SingleLeadSchema } from "@/app/leads/action-schemas"
import { normalizeControlTask, isTaskStatus, type TaskQueryRow } from "@/app/control-center/task-data"
import { normalizeJourneyTask } from "@/app/leads/tasks/normalize-task"
import type { TaskResponse } from "@/app/leads/tasks/actions"
import { normalizeOrigin } from "@/app/leads/normalize-origin"

describe("workspace data contracts", () => {
  it("accepts absent, null and linked buyer identities in both lead responses", () => {
    const listField = LeadSchema.shape.leads.unwrap().element.shape.buyer_user_id
    const detailField = SingleLeadSchema.shape.lead.unwrap().shape.buyer_user_id
    for (const schema of [listField, detailField]) {
      expect(schema.parse(undefined)).toBeUndefined()
      expect(schema.parse(null)).toBeNull()
      expect(schema.parse("buyer-id")).toBe("buyer-id")
      expect(schema.safeParse(42).success).toBe(false)
    }
  })

  it("normalizes nullable task relations without dropping task or tenant identity", () => {
    const row: TaskQueryRow = {
      id: "task", serial_id: "T-1", title: "Call", description: null,
      status: "pending", stage: null, scheduled_date: "2026-09-30T12:00:00Z",
      lead_id: null, assignee: null, type: null, priority: 1,
      site_id: "site", created_at: "2026-09-29", updated_at: "2026-09-30", leads: null,
    }
    expect(normalizeControlTask(row)).toMatchObject({
      id: "task", site_id: "site", lead_id: undefined, assignee: undefined,
      type: undefined, stage: undefined, leads: undefined,
    })
    expect(normalizeControlTask({ ...row, stage: "decision" }).stage).toBe("decision")
    expect(normalizeControlTask({ ...row, stage: "unknown" }).stage).toBeUndefined()
    expect(isTaskStatus("canceled")).toBe(true)
    expect(isTaskStatus("invalid")).toBe(false)
  })

  it("adapts nullable journey response fields while preserving zero amounts", () => {
    const task: NonNullable<TaskResponse["task"]> = {
      id: "task", serial_id: "T-1", title: "Call", description: null,
      lead_id: null, deal_id: "deal", type: "call", stage: "decision", status: "pending",
      scheduled_date: "2026-09-30", completed_date: null, amount: 0, assignee: null,
      notes: null, priority: 1, address: null, site_id: "site", user_id: "user",
      created_at: "2026-09-29", updated_at: "2026-09-30",
    }
    expect(normalizeJourneyTask(task)).toMatchObject({
      description: "", amount: 0, completed_date: undefined, assignee: undefined,
      notes: undefined, deal_id: "deal", site_id: "site",
    })
  })

  it("preserves lead origin normalization after action extraction", () => {
    expect(normalizeOrigin("lead_generation_workflow")).toBe("Makinari")
    expect(normalizeOrigin("inbound")).toBe("inbound")
    expect(normalizeOrigin(null)).toBeNull()
  })
})