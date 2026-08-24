import type { InstanceNode } from "@/app/types/instance-nodes"
import {
  WF_OVERALL_RESULT_ID_PREFIX,
  WF_RESULT_ID_PREFIX,
} from "@/app/components/workflows/types"
import { buildWorkflowResultNodes, leafGraphNodes } from "@/app/components/workflows/use-workflow-result-nodes"
import type { NodeRunStatusMap } from "@/app/components/workflows/use-workflow-run-status"

function node(id: string, type: "wf-trigger" | "wf-step", parent: string | null): InstanceNode {
  return {
    id,
    instance_id: "inst",
    parent_node_id: parent,
    original_node_id: null,
    parent_instance_log_id: null,
    type,
    status: "pending",
    result: {},
    settings: {},
    prompt: { text: "" },
    site_id: "site",
    user_id: "user",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("buildWorkflowResultNodes", () => {
  it("adds a step result and an overall result on the leaf", () => {
    const trigger = node("t", "wf-trigger", null)
    const step = node("s", "wf-step", "t")
    const statusByNode: NodeRunStatusMap = { s: "in_progress" }
    const next = buildWorkflowResultNodes([trigger, step], statusByNode)
    const ids = next.map((item) => item.id)
    expect(ids).toContain(`${WF_RESULT_ID_PREFIX}s`)
    expect(ids).toContain(`${WF_OVERALL_RESULT_ID_PREFIX}s`)
    expect(ids).not.toContain(`${WF_RESULT_ID_PREFIX}t`)
    expect(next.find((item) => item.id === `${WF_OVERALL_RESULT_ID_PREFIX}s`)?.parent_node_id).toBe("s")
  })
})

describe("leafGraphNodes", () => {
  it("returns nodes that have no graph children", () => {
    const trigger = node("t", "wf-trigger", null)
    const step = node("s", "wf-step", "t")
    expect(leafGraphNodes([trigger, step]).map((item) => item.id)).toEqual(["s"])
  })
})
