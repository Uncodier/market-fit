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
  it("renders a full-screen SVG with overflow visible", () => {
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
      />
    )

    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute("class")).toContain("w-full")
    expect(svg!.getAttribute("class")).toContain("imprenta-world-svg")
    expect(svg!.getAttribute("class")).toContain("h-full")
    expect(svg!.style.overflow).toBe("visible")
    expect(container.querySelector("path")).not.toBeNull()
  })
})

describe("ImprentaTempConnectionLine", () => {
  it("renders a full-screen SVG with overflow visible", () => {
    const { container } = render(
      <ImprentaTempConnectionLine fromX={480} fromY={150} toX={720} toY={200} />
    )
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute("class")).toContain("w-full")
    expect(svg!.getAttribute("class")).toContain("imprenta-world-svg")
    expect(svg!.getAttribute("class")).toContain("h-full")
    expect(svg!.style.overflow).toBe("visible")
    expect(container.querySelector("path")?.getAttribute("d")).toContain("M 480 150")
  })
})
