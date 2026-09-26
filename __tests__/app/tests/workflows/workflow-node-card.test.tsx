import { fireEvent, render, screen } from "@testing-library/react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { WorkflowNodeCard } from "@/app/components/workflows/workflow-node-card"
import { NODE_W } from "@/app/components/workflows/types"

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
    onStartConnection: jest.fn(),
    onInputConnection: jest.fn(),
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

  it("uses separate output and add-step controls", () => {
    const { container } = render(<WorkflowNodeCard node={node("t1", "wf-trigger")} selected={false} {...handlers} />)
    const output = screen.getByRole("button", { name: "Start connection" })
    const addStep = screen.getByRole("button", { name: "Add step" })
    expect(output).toHaveClass("h-6", "w-6")
    expect(addStep).toHaveClass("h-6", "w-6", "top-14")
    expect(output.parentElement).toHaveClass("top-1/2", "-translate-y-3", "h-20")
    expect(container.firstElementChild).toHaveStyle({ width: `${NODE_W}px` })
    expect((container.firstElementChild as HTMLElement).style.minHeight).toBe("")
    fireEvent.click(output)
    expect(handlers.onStartConnection).toHaveBeenCalledTimes(1)
    expect(handlers.onAddStep).not.toHaveBeenCalled()
    fireEvent.click(addStep)
    expect(handlers.onAddStep).toHaveBeenCalledTimes(1)
  })

  it("offers the step input for connecting or disconnecting without dragging the card", () => {
    const view = render(<WorkflowNodeCard node={node("s1", "wf-step")} selected={false} {...handlers} />)
    const input = screen.getByRole("button", { name: "Disconnect step" })
    expect(input).toHaveClass("h-6", "w-6", "top-1/2")
    fireEvent.mouseDown(input)
    fireEvent.click(input)
    expect(handlers.onMouseDown).not.toHaveBeenCalled()
    expect(handlers.onInputConnection).toHaveBeenCalledTimes(1)

    view.rerender(<WorkflowNodeCard node={node("s1", "wf-step")} selected={false} connectionSourceId="t1" {...handlers} />)
    fireEvent.click(screen.getByRole("button", { name: "Connect step here" }))
    expect(handlers.onInputConnection).toHaveBeenCalledTimes(2)
  })
})
