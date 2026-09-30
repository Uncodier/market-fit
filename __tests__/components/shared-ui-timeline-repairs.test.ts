import { buildMessageTimeline } from "@/app/components/simple-messages-view/message-timeline"
import type { InstanceLog, InstancePlan } from "@/app/components/simple-messages-view/types"

function plan(id: string, timestamp: string): InstancePlan {
  return { id, title: id, created_at: timestamp, status: "pending", plan_type: "task", progress_percentage: 0, steps_completed: 0, steps_total: 1, priority: 1 }
}

describe("extracted message timeline", () => {
  it("retains only the latest plan, avoids duplicate plan IDs, and sorts logs before a tied plan", () => {
    const timestamp = "2026-01-02T00:00:00.000Z"
    const log: InstanceLog = { id: "user", log_type: "user_action", level: "info", message: "Continue", created_at: timestamp }
    const latest = plan("latest", timestamp)
    const result = buildMessageTimeline([log], [plan("old", "2026-01-01"), latest], [latest], [], () => false)
    expect(result.sortedTimeline.map(item => [item.type, item.data.id])).toEqual([["log", "user"], ["completed_plan", "latest"]])
  })

  it("represents finished active plans without mutating the source plan", () => {
    const source = plan("active", "2026-01-01")
    const result = buildMessageTimeline([], [], [source], [{ id: "step", title: "Done", status: "completed", order: 0, planId: "active" }], () => true)
    expect(result.sortedTimeline[0].data).toMatchObject({ id: "active", status: "completed" })
    expect(source.status).toBe("pending")
  })
})