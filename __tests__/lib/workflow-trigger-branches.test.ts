import type { InstanceNode } from "@/app/types/instance-nodes"
import { triggerHasExecutableStep, triggerHasUnsupportedChannelStep } from "@/app/components/workflows/workflow-trigger-branches"

function node(id: string, type: string, parent_node_id: string | null = null): InstanceNode {
  return { id, type, parent_node_id } as InstanceNode
}

describe("triggerHasExecutableStep", () => {
  it("requires a step in the selected trigger branch", () => {
    const nodes = [node("trigger-a", "wf-trigger"), node("trigger-b", "wf-trigger"), node("step", "wf-step", "trigger-b")]
    expect(triggerHasExecutableStep(nodes, "trigger-a")).toBe(false)
    expect(triggerHasExecutableStep(nodes, "trigger-b")).toBe(true)
  })

  it("accepts nested steps and stops when parent pointers cycle", () => {
    const nodes = [node("trigger", "wf-trigger"), node("first", "wf-step", "trigger"), node("second", "wf-step", "first")]
    expect(triggerHasExecutableStep(nodes, "trigger")).toBe(true)
    expect(triggerHasExecutableStep([node("first", "wf-step", "second"), node("second", "wf-step", "first")], "trigger")).toBe(false)
  })

  it("rejects sandbox and browser steps only within the selected trigger branch", () => {
    const nodes = [
      node("trigger-a", "wf-trigger"), node("trigger-b", "wf-trigger"),
      { ...node("unsafe", "wf-step", "trigger-b"), settings: { step: { requires_sandbox: true } } },
      node("safe", "wf-step", "trigger-a"),
    ]
    expect(triggerHasUnsupportedChannelStep(nodes, "trigger-a")).toBe(false)
    expect(triggerHasUnsupportedChannelStep(nodes, "trigger-b")).toBe(true)
    nodes[2].settings = { step: { requires_browser: true } }
    expect(triggerHasUnsupportedChannelStep(nodes, "trigger-b")).toBe(true)
  })
})