import type { WorkflowRunPlan } from "@/app/components/workflows/types"
import {
  explicitLogNodeId,
  groupWorkflowResultLogs,
  logsSince,
  shouldShowResultForStatus,
  summaryFromLogs,
  type WorkflowResultLog,
} from "@/app/components/workflows/workflow-result-logs"

function log(
  id: string,
  created_at: string,
  extra: Partial<WorkflowResultLog> = {},
): WorkflowResultLog {
  return {
    id,
    created_at,
    log_type: "agent_action",
    message: extra.message || id,
    ...extra,
  }
}

function plan(steps: WorkflowRunPlan["steps"]): WorkflowRunPlan {
  return {
    id: "plan-1",
    status: "in_progress",
    created_at: "2026-08-24T10:00:00.000Z",
    metadata: { workflow_run: true },
    steps,
  }
}

describe("explicitLogNodeId", () => {
  it("reads details.node_id, then workflow_node_id, then command_id", () => {
    expect(explicitLogNodeId(log("a", "2026-08-24T10:00:01Z", { details: { node_id: "n1" } }))).toBe("n1")
    expect(
      explicitLogNodeId(log("b", "2026-08-24T10:00:01Z", { details: { workflow_node_id: "n2" } })),
    ).toBe("n2")
    expect(explicitLogNodeId(log("c", "2026-08-24T10:00:01Z", { command_id: "n3" }))).toBe("n3")
    expect(explicitLogNodeId(log("d", "2026-08-24T10:00:01Z"))).toBeNull()
  })
})

describe("groupWorkflowResultLogs", () => {
  it("assigns logs to nodes by explicit ids and keeps overall since plan start", () => {
    const grouped = groupWorkflowResultLogs({
      logs: [
        log("old", "2026-08-24T09:00:00Z", { details: { node_id: "step-a" }, message: "too early" }),
        log("a1", "2026-08-24T10:00:05Z", { details: { node_id: "step-a" }, message: "A did work" }),
        log("b1", "2026-08-24T10:01:00Z", { command_id: "step-b", message: "B did work" }),
      ],
      nodeIds: ["step-a", "step-b"],
      plan: plan([
        { status: "completed", metadata: { node_id: "step-a" } },
        { status: "in_progress", metadata: { node_id: "step-b" } },
      ]),
    })
    expect(grouped.byNodeId["step-a"].map((item) => item.id)).toEqual(["a1"])
    expect(grouped.byNodeId["step-b"].map((item) => item.id)).toEqual(["b1"])
    expect(grouped.overall.map((item) => item.id)).toEqual(["a1", "b1"])
  })

  it("falls back to in-progress step when logs have no node id", () => {
    const grouped = groupWorkflowResultLogs({
      logs: [log("x", "2026-08-24T10:00:10Z", { message: "working" })],
      nodeIds: ["step-a", "step-b"],
      plan: plan([
        { status: "completed", metadata: { node_id: "step-a" } },
        { status: "in_progress", metadata: { node_id: "step-b" } },
      ]),
    })
    expect(grouped.byNodeId["step-a"]).toEqual([])
    expect(grouped.byNodeId["step-b"].map((item) => item.id)).toEqual(["x"])
  })

  it("uses time windows when step timestamps exist", () => {
    const grouped = groupWorkflowResultLogs({
      logs: [
        log("early", "2026-08-24T10:00:10Z", { message: "A window" }),
        log("late", "2026-08-24T10:05:10Z", { message: "B window" }),
      ],
      nodeIds: ["step-a", "step-b"],
      plan: plan([
        {
          status: "completed",
          metadata: { node_id: "step-a" },
          created_at: "2026-08-24T10:00:00Z",
          updated_at: "2026-08-24T10:02:00Z",
        },
        {
          status: "in_progress",
          metadata: { node_id: "step-b" },
          created_at: "2026-08-24T10:02:00Z",
        },
      ]),
    })
    expect(grouped.byNodeId["step-a"].map((item) => item.id)).toEqual(["early"])
    expect(grouped.byNodeId["step-b"].map((item) => item.id)).toEqual(["late"])
  })

  it("exposes step_output and a summary from the last agent or tool result", () => {
    const grouped = groupWorkflowResultLogs({
      logs: [
        log("s", "2026-08-24T10:00:01Z", { log_type: "system", message: "started" }),
        log("a", "2026-08-24T10:00:02Z", { log_type: "agent_action", message: "Final answer" }),
      ],
      nodeIds: ["step-a"],
      plan: plan([
        { status: "completed", metadata: { node_id: "step-a" }, step_output: "Saved the report" },
      ]),
    })
    expect(grouped.stepOutputByNodeId["step-a"]).toBe("Saved the report")
    expect(grouped.summary).toBe("Final answer")
  })
})

describe("logsSince", () => {
  it("keeps logs after the plan start with a small pad", () => {
    const kept = logsSince(
      [log("a", "2026-08-24T09:59:56Z"), log("b", "2026-08-24T10:00:01Z")],
      "2026-08-24T10:00:00.000Z",
    )
    expect(kept.map((item) => item.id)).toEqual(["a", "b"])
  })
})

describe("summaryFromLogs", () => {
  it("prefers the latest agent_action or tool_result message", () => {
    expect(
      summaryFromLogs([
        log("1", "2026-08-24T10:00:01Z", { log_type: "system", message: "hi" }),
        log("2", "2026-08-24T10:00:02Z", { log_type: "tool_result", message: "tool done" }),
        log("3", "2026-08-24T10:00:03Z", { log_type: "agent_action", message: "done" }),
      ]),
    ).toBe("done")
  })
})

describe("shouldShowResultForStatus", () => {
  it("shows results once a step is running or finished", () => {
    expect(shouldShowResultForStatus("pending")).toBe(false)
    expect(shouldShowResultForStatus("in_progress")).toBe(true)
    expect(shouldShowResultForStatus("completed")).toBe(true)
    expect(shouldShowResultForStatus("failed")).toBe(true)
  })
})
