import { fireEvent, render, screen } from "@testing-library/react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { WorkflowNodeCard } from "@/app/components/workflows/workflow-node-card"

jest.mock("@/app/components/workflows/workflow-trigger-body", () => ({
  WorkflowTriggerBody: () => <div>trigger-body</div>,
}))

jest.mock("@/app/components/workflows/workflow-step-body", () => ({
  WorkflowStepBody: () => <div>step-body</div>,
}))

function node(id: string, type: "wf-trigger" | "wf-step"): InstanceNode {
  return {
    id,
    instance_id: "inst",
    parent_node_id: type === "wf-trigger" ? null : "parent",
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

describe("WorkflowNodeCard add-step port", () => {
  const handlers = {
    onSelect: jest.fn(),
    onMouseDown: jest.fn(),
    onChange: jest.fn(),
    onDelete: jest.fn(),
    onAddStep: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("lets a trigger add a step from the right port", () => {
    render(<WorkflowNodeCard node={node("t1", "wf-trigger")} selected={false} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Add step" }))
    expect(handlers.onAddStep).toHaveBeenCalledTimes(1)
    expect(handlers.onDelete).not.toHaveBeenCalled()
  })

  it("lets a step add another step from the right port", () => {
    render(<WorkflowNodeCard node={node("s1", "wf-step")} selected={false} {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Add step" }))
    expect(handlers.onAddStep).toHaveBeenCalledTimes(1)
  })
})
