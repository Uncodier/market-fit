import { fireEvent, render, screen } from "@testing-library/react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { WorkflowEdges } from "@/app/components/workflows/workflow-edges"
import { H_GAP, NODE_W } from "@/app/components/workflows/types"

const trigger = { id: "trigger", type: "wf-trigger", parent_node_id: null } as InstanceNode
const step = { id: "step", type: "wf-step", parent_node_id: "trigger" } as InstanceNode
const positions = { trigger: { x: 80, y: 80 }, step: { x: 80 + NODE_W + H_GAP, y: 80 } }

describe("WorkflowEdges", () => {
  it("renders persisted parent relations in world coordinates", () => {
    const { container } = render(<WorkflowEdges nodes={[trigger, step]} positions={positions} heights={{ trigger: 196, step: 196 }} />)
    const svg = container.querySelector("svg.chrome-only-svg")
    expect(svg?.getAttribute("viewBox")).toBeTruthy()
    expect(svg?.querySelectorAll("path")).toHaveLength(1)
    expect(svg?.querySelector("path")?.getAttribute("d")).toContain(`M ${80 + NODE_W} 178`)
  })

  it("shows a connection preview even when there are no persisted edges", () => {
    const { container } = render(
      <WorkflowEdges nodes={[trigger]} positions={positions} heights={{}} preview={{ fromNode: "trigger", to: { x: 900, y: 280 } }} />,
    )
    const svg = container.querySelector("svg.chrome-only-svg")
    expect(svg?.querySelector("path")?.getAttribute("stroke-dasharray")).toBe("8 6")
    expect(svg?.querySelector("path")?.getAttribute("d")).toContain("900 280")
  })

  it("stops rendering a relation after the step is disconnected", () => {
    const { container } = render(<WorkflowEdges nodes={[trigger, { ...step, parent_node_id: null }]} positions={positions} heights={{}} />)
    expect(container.querySelector("svg")).toBeNull()
  })

  it("keeps non-editable result links visible without a workflow context editor", () => {
    const result = { ...step, id: "result", type: "wf-result" }
    const { container } = render(<WorkflowEdges nodes={[trigger, result]}
      positions={{ ...positions, result: positions.step }} heights={{}} onSelectRelation={jest.fn()} />)
    expect(container.querySelector("svg.chrome-only-svg path")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Edit relation context/ })).not.toBeInTheDocument()
  })

  it("shows on success for legacy relations and anchors the editor at the click", () => {
    const onSelectRelation = jest.fn()
    render(<WorkflowEdges nodes={[trigger, step]} positions={positions} heights={{}} onSelectRelation={onSelectRelation} />)
    fireEvent.click(screen.getByRole("button", { name: "Edit relation context: on success" }), { clientX: 310, clientY: 240 })
    expect(onSelectRelation).toHaveBeenCalledWith("step", { x: 310, y: 240 })
  })

  it("renders persisted labels and selects a relation by clicking its line", () => {
    const onSelectRelation = jest.fn()
    render(<WorkflowEdges nodes={[trigger, { ...step, settings: { relation_context: "on error" } }]}
      positions={positions} heights={{}} onSelectRelation={onSelectRelation} selectedRelationId="step" />)
    expect(screen.getByRole("button", { name: "Edit relation context: on error" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getAllByTestId("workflow-relation-hit-step")[0], { clientX: 410, clientY: 260 })
    expect(onSelectRelation).toHaveBeenCalledWith("step", { x: 410, y: 260 })
  })
})