import { createRef } from "react"
import { render } from "@testing-library/react"
import { ImprentaContextEdges } from "@/app/components/agents/imprenta-context-edges"
import { ImprentaTempConnectionLine } from "@/app/components/agents/imprenta-world-svg"
import { createImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import type { InstanceNode } from "@/app/types/instance-nodes"

function node(id: string, overrides: Partial<InstanceNode> = {}): InstanceNode {
  return {
    id,
    instance_id: "inst",
    parent_node_id: null,
    original_node_id: null,
    parent_instance_log_id: null,
    type: "prompt",
    status: "completed",
    result: {},
    settings: {},
    prompt: {},
    site_id: "site",
    user_id: "user",
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  }
}

describe("ImprentaContextEdges", () => {
  it("gives the SVG a non-zero layout box so Chrome can paint the stroke", () => {
    const nodes = [node("a"), node("b")]
    const nodesRef = createRef<InstanceNode[]>()
    nodesRef.current = nodes
    const heightsRef = createRef<Record<string, number>>()
    heightsRef.current = { a: 300, b: 300 }

    const { container } = render(
      <ImprentaContextEdges
        contexts={[
          {
            id: "ctx-1",
            context_node_id: "a",
            target_node_id: "b",
            type: "reference",
          },
        ]}
        nodesRef={nodesRef}
        positions={{ a: { x: 0, y: 0 }, b: { x: 600, y: 40 } }}
        nodeHeightsRef={heightsRef}
        selectedContextId={null}
        setSelectedContextId={() => {}}
        hoverStore={createImprentaHoverStore()}
        visibleNodeIds={null}
      />
    )

    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    const width = Number(svg.getAttribute("width"))
    const height = Number(svg.getAttribute("height"))
    expect(width).toBeGreaterThan(1)
    expect(height).toBeGreaterThan(1)
    expect(svg.getAttribute("viewBox")).toBeTruthy()
    expect(container.querySelector("path")).not.toBeNull()
  })
})

describe("ImprentaTempConnectionLine", () => {
  it("sizes the in-progress connection SVG to the drag geometry", () => {
    const { container } = render(
      <ImprentaTempConnectionLine fromX={480} fromY={150} toX={720} toY={200} />
    )
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(Number(svg.getAttribute("width"))).toBeGreaterThan(1)
    expect(Number(svg.getAttribute("height"))).toBeGreaterThan(1)
    expect(container.querySelector("path")?.getAttribute("d")).toContain("M 480 150")
  })
})
