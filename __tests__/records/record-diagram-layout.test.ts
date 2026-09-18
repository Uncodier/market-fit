import {
  RECORD_NODE_HORIZONTAL_GAP,
  RECORD_NODE_VERTICAL_GAP,
  computeRecordDiagramBounds,
  getRecordDiagramNodeSize,
  getRecordDiagramNodeTextHeight,
  getRecordNodePortPoint,
  isDiagramInteractiveTarget,
  layoutRecordDiagram,
  layoutSelectedRecordDiagram,
  placeRecordDiagramNode,
  sortRecordDiagram,
} from "@/app/records/[id]/components/record-diagram/record-diagram-layout"
import type { RecordDiagramNode } from "@/app/records/lib/record-diagram"

function node(id: string, title: string, x = 0, y = 0): RecordDiagramNode {
  return {
    id,
    kind: "note",
    title,
    content: "",
    metadata: {},
    position: { x, y },
  }
}

describe("record diagram layout", () => {
  const root = node("00000000-0000-4000-8000-000000000001", "Root", 80, 80)
  const first = node("00000000-0000-4000-8000-000000000002", "First")
  const second = node("00000000-0000-4000-8000-000000000003", "Second")

  it("sizes nodes to their content while preserving shape proportions", () => {
    const short = getRecordDiagramNodeSize(root)
    const long = getRecordDiagramNodeSize({
      ...root,
      content: "A detailed paragraph ".repeat(80),
    })
    const title = getRecordDiagramNodeSize({ ...root, kind: "title", title: "Section" })
    const decision = getRecordDiagramNodeSize({ ...root, kind: "decision" })

    expect(short.height).toBe(112)
    expect(getRecordDiagramNodeTextHeight(root)).toBe(20)
    expect(long.height).toBeGreaterThan(short.height)
    expect(title.height).toBe(64)
    expect(decision.width / decision.height).toBeGreaterThanOrEqual(1.5)
  })

  it("places a new child to the right and stacks siblings", () => {
    const rootSize = getRecordDiagramNodeSize(root)
    expect(placeRecordDiagramNode([root], root)).toEqual({
      x: 80 + rootSize.width + RECORD_NODE_HORIZONTAL_GAP,
      y: 80,
    })
    const existingChild = {
      ...first,
      position: {
        x: 80 + rootSize.width + RECORD_NODE_HORIZONTAL_GAP,
        y: 80,
      },
    }
    expect(placeRecordDiagramNode([root, existingChild], root).y).toBe(
      80 + getRecordDiagramNodeSize(existingChild).height + RECORD_NODE_VERTICAL_GAP
    )
  })

  it("sorts directed children to the right and stacks peers", () => {
    const sorted = sortRecordDiagram([second, root, first], [
      {
        id: "00000000-0000-4000-8000-000000000010",
        source: root.id,
        target: first.id,
        type: "supports",
        metadata: {},
      },
      {
        id: "00000000-0000-4000-8000-000000000011",
        source: root.id,
        target: second.id,
        type: "supports",
        metadata: {},
      },
    ])
    const byId = new Map(sorted.map((item) => [item.id, item]))
    expect(byId.get(first.id)!.position.x).toBeGreaterThan(byId.get(root.id)!.position.x)
    expect(byId.get(second.id)!.position.y).toBeGreaterThan(byId.get(first.id)!.position.y)
  })

  it("arranges nodes as a column, row, or grid", () => {
    const nodes = [root, first, second]
    const column = layoutRecordDiagram(nodes, [], "columns")
    const row = layoutRecordDiagram(nodes, [], "rows")
    const grid = layoutRecordDiagram(nodes, [], "grid")

    expect(new Set(column.map((item) => item.position.x))).toEqual(new Set([80]))
    expect(new Set(row.map((item) => item.position.y))).toEqual(new Set([80]))
    expect(new Set(grid.map((item) => item.position.x)).size).toBe(2)
    expect(new Set(grid.map((item) => item.position.y)).size).toBe(2)
  })

  it("arranges only selected nodes and preserves their group origin", () => {
    const unselected = node("00000000-0000-4000-8000-000000000004", "Untouched", 1400, 900)
    const arranged = layoutSelectedRecordDiagram(
      [root, first, second, unselected],
      [],
      new Set([root.id, first.id, second.id]),
      "columns",
    )
    const selected = arranged.filter((item) => item.id !== unselected.id)

    expect(new Set(selected.map((item) => item.position.x))).toEqual(new Set([0]))
    expect(arranged.find((item) => item.id === unselected.id)?.position).toEqual({ x: 1400, y: 900 })
  })

  it("expands canvas bounds around distant nodes", () => {
    const bounds = computeRecordDiagramBounds([node(root.id, "Far", 1600, 900)])
    const size = getRecordDiagramNodeSize(node(root.id, "Far", 1600, 900))
    expect(bounds.width).toBeGreaterThan(1600 + size.width)
    expect(bounds.height).toBeGreaterThan(900 + size.height)
  })

  it("resolves all four connector positions", () => {
    const size = getRecordDiagramNodeSize(root)
    expect(getRecordNodePortPoint(root, "top")).toEqual({
      x: 80 + size.width / 2,
      y: 80,
    })
    expect(getRecordNodePortPoint(root, "right")).toEqual({
      x: 80 + size.width,
      y: 80 + size.height / 2,
    })
    expect(getRecordNodePortPoint(root, "bottom")).toEqual({
      x: 80 + size.width / 2,
      y: 80 + size.height,
    })
    expect(getRecordNodePortPoint(root, "left")).toEqual({
      x: 80,
      y: 80 + size.height / 2,
    })
  })

  it("does not begin dragging from interactive controls", () => {
    document.body.innerHTML = '<div><textarea id="content"></textarea><div id="card"></div></div>'
    expect(isDiagramInteractiveTarget(document.getElementById("content"))).toBe(true)
    expect(isDiagramInteractiveTarget(document.getElementById("card"))).toBe(false)
  })
})
