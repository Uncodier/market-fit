import type { InstanceNode } from "@/app/types/instance-nodes"
import { canSetWorkflowParent } from "@/app/components/workflows/workflow-relations"

const node = (id: string, type: string, parent_node_id: string | null, instance_id = "instance-1") => ({
  id, type, parent_node_id, instance_id, site_id: "site-1",
}) as InstanceNode

describe("workflow relations", () => {
  const nodes = [
    node("trigger", "wf-trigger", null),
    node("step", "wf-step", "trigger"),
    node("child", "wf-step", "step"),
    node("other", "wf-step", null),
  ]

  it("connects and detaches steps within the workflow", () => {
    expect(canSetWorkflowParent(nodes, "other", "trigger")).toBe(true)
    expect(canSetWorkflowParent(nodes, "child", "other")).toBe(true)
    expect(canSetWorkflowParent(nodes, "step", null)).toBe(true)
  })

  it("rejects cycles, triggers as targets, and nodes from other instances or sites", () => {
    expect(canSetWorkflowParent(nodes, "step", "step")).toBe(false)
    expect(canSetWorkflowParent(nodes, "step", "child")).toBe(false)
    expect(canSetWorkflowParent(nodes, "trigger", "step")).toBe(false)
    expect(canSetWorkflowParent(nodes, "missing", "trigger")).toBe(false)
    expect(canSetWorkflowParent(nodes, "step", "missing")).toBe(false)
    expect(canSetWorkflowParent([...nodes, node("foreign", "wf-trigger", null, "instance-2")], "step", "foreign")).toBe(false)
    expect(canSetWorkflowParent([...nodes, { ...node("site-other", "wf-step", null), site_id: "site-2" }], "step", "site-other")).toBe(false)
    expect(canSetWorkflowParent([...nodes, node("legacy", "wf-condition", null)], "step", "legacy")).toBe(false)
  })
})