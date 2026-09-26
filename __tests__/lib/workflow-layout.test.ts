import type { InstanceNode } from "@/app/types/instance-nodes"
import { H_GAP, NODE_H, NODE_W, V_GAP } from "@/app/components/workflows/types"
import {
  isInteractiveTarget,
  placeNewNode,
  placeResultNodes,
  spaceWorkflowColumns,
  sortWorkflowLayout,
  unstackOverlaps,
  type WFPoint,
} from "@/app/components/workflows/use-workflow-layout"

function node(id: string, parent: string | null, pos: WFPoint): InstanceNode {
  return {
    id,
    instance_id: "inst",
    parent_node_id: parent,
    original_node_id: null,
    parent_instance_log_id: null,
    type: parent ? "wf-step" : "wf-trigger",
    status: "pending",
    result: {},
    settings: { ui_position: pos },
    prompt: { text: "" },
    site_id: "site",
    user_id: "user",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("unstackOverlaps", () => {
  it("uses a wide node size to fit all five trigger types in one row", () => {
    expect(NODE_W).toBe(640)
    expect(NODE_H).toBe(196)
    expect(H_GAP).toBeGreaterThanOrEqual(160)
    expect(V_GAP).toBeGreaterThanOrEqual(80)
  })

  it("moves a stacked child below the trigger instead of leaving it on top", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const step = node("s", "t", { x: 80, y: 100 })
    const heights = { t: 200, s: 180 }
    const next = unstackOverlaps([trigger, step], { t: { x: 80, y: 80 }, s: { x: 80, y: 100 } }, heights)
    expect(next.s.y).toBeGreaterThanOrEqual(80 + 200 + V_GAP)
    expect(next.s.x).toBe(80)
  })

  it("pushes a later result card below a taller sibling after heights grow", () => {
    const step = node("s", "t", { x: 80, y: 80 })
    const result = {
      ...node("dummy-result-s", "s", { x: 80 + NODE_W + H_GAP, y: 80 }),
      type: "wf-result",
    }
    const overall = {
      ...node("dummy-result-overall-s", "s", { x: 80 + NODE_W + H_GAP, y: 276 }),
      type: "wf-result",
    }
    const next = unstackOverlaps(
      [step, result, overall],
      {
        s: { x: 80, y: 80 },
        "dummy-result-s": { x: 80 + NODE_W + H_GAP, y: 80 },
        "dummy-result-overall-s": { x: 80 + NODE_W + H_GAP, y: 276 },
      },
      { s: 200, "dummy-result-s": 420, "dummy-result-overall-s": 360 },
    )
    expect(next["dummy-result-overall-s"].y).toBeGreaterThanOrEqual(80 + 420 + V_GAP)
    expect(next["dummy-result-s"].x).toBe(80 + NODE_W + H_GAP)
  })
})

describe("placeNewNode", () => {
  it("places a step to the right of the parent without overlapping", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const point = placeNewNode({
      type: "wf-step",
      parent: trigger,
      nodes: [trigger],
      positions: { t: { x: 80, y: 80 } },
      heights: { t: 200 },
    })
    expect(point.x).toBe(80 + NODE_W + H_GAP)
    expect(point.y).toBe(80)
  })

  it("stacks a new trigger below the last root", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const point = placeNewNode({
      type: "wf-trigger",
      parent: null,
      nodes: [trigger],
      positions: { t: { x: 80, y: 80 } },
      heights: { t: 200 },
    })
    expect(point).toEqual({ x: 80, y: 80 + 200 + V_GAP })
  })

  it("uses the default height when a measured height is missing", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const point = placeNewNode({
      type: "wf-trigger",
      parent: null,
      nodes: [trigger],
      positions: { t: { x: 80, y: 80 } },
      heights: {},
    })
    expect(point.y).toBe(80 + NODE_H + V_GAP)
  })

  it("pins a result directly below its parent", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const dummy = {
      ...node("dummy-result-t", "t", { x: 0, y: 0 }),
      type: "wf-result",
    }
    const next = placeResultNodes(
      [trigger],
      [dummy],
      { t: { x: 80, y: 80 } },
      { t: 200 },
    )
    expect(next["dummy-result-t"]).toEqual({ x: 80, y: 80 + 200 + V_GAP })
    expect(next.t).toEqual({ x: 80, y: 80 })
  })

  it("keeps multiple results below the same parent apart when positions change", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const first = { ...node("dummy-result-t", "t", { x: 80, y: 300 }), type: "wf-result" }
    const second = { ...node("dummy-result-overall-t", "t", { x: 80, y: 500 }), type: "wf-result" }
    const next = placeResultNodes(
      [trigger], [first, second],
      { t: { x: 240, y: 120 }, [first.id]: { x: 80, y: 300 }, [second.id]: { x: 80, y: 500 } },
      { t: 260, [first.id]: 300 },
    )
    expect(next[first.id]).toEqual({ x: 240, y: 120 + 260 + V_GAP })
    expect(next[second.id]).toEqual({ x: 240, y: next[first.id].y + 300 + V_GAP })
  })
})

describe("spaceWorkflowColumns", () => {
  it("opens up a compact saved chain while preserving manually spaced nodes", () => {
    const trigger = node("t", null, { x: 80, y: 80 })
    const child = node("c", "t", { x: 680, y: 80 })
    const grandchild = node("g", "c", { x: 1280, y: 80 })
    const distant = node("d", "t", { x: 1800, y: 900 })
    const positions = { t: { x: 80, y: 80 }, c: { x: 680, y: 80 }, g: { x: 1280, y: 80 }, d: { x: 1800, y: 900 } }
    const spaced = spaceWorkflowColumns([grandchild, distant, child, trigger], positions)
    expect(spaced.c).toEqual({ x: 80 + NODE_W + H_GAP, y: 80 })
    expect(spaced.g.x).toBe(spaced.c.x + NODE_W + H_GAP)
    expect(spaced.d).toEqual(positions.d)
    expect(positions.c.x).toBe(680)
  })

  it("does not move branches deliberately stacked below or left of their parent", () => {
    const trigger = node("t", null, { x: 400, y: 80 })
    const stacked = node("s", "t", { x: 400, y: 700 })
    const positions = { t: { x: 400, y: 80 }, s: { x: 400, y: 700 } }
    expect(spaceWorkflowColumns([trigger, stacked], positions).s).toEqual(positions.s)
  })
})

describe("isInteractiveTarget", () => {
  it("treats native selects and listboxes as interactive so drag does not start", () => {
    document.body.innerHTML = `<select id="kind"><option>Manual</option></select>`
    expect(isInteractiveTarget(document.getElementById("kind"))).toBe(true)
    document.body.innerHTML = `<div role="listbox" id="box"><div role="option">A</div></div>`
    expect(isInteractiveTarget(document.querySelector('[role="option"]'))).toBe(true)
    document.body.innerHTML = `<input id="name" />`
    expect(isInteractiveTarget(document.getElementById("name"))).toBe(true)
    document.body.innerHTML = `<div id="chrome">Node</div>`
    expect(isInteractiveTarget(document.getElementById("chrome"))).toBe(false)
  })
})

describe("sortWorkflowLayout", () => {
  it("puts children to the right of their parent and stacks siblings", () => {
    const trigger = node("t", null, { x: 10, y: 10 })
    const first = node("a", "t", { x: 10, y: 10 })
    const second = { ...node("b", "t", { x: 10, y: 10 }), created_at: "2026-01-01T00:00:01Z" }
    const next = sortWorkflowLayout([trigger, first, second], { t: 200, a: 180, b: 180 })
    expect(next.t).toEqual({ x: 80, y: 80 })
    expect(next.a.x).toBe(80 + NODE_W + H_GAP)
    expect(next.b.x).toBe(80 + NODE_W + H_GAP)
    expect(next.b.y).toBeGreaterThanOrEqual(next.a.y + 180 + V_GAP)
  })
})
