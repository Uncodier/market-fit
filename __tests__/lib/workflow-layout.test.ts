import type { InstanceNode } from "@/app/types/instance-nodes"
import { NODE_H, NODE_W, V_GAP } from "@/app/components/workflows/types"
import {
  isInteractiveTarget,
  placeNewNode,
  placeResultNodes,
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
      ...node("dummy-result-s", "s", { x: 640, y: 80 }),
      type: "wf-result",
    }
    const overall = {
      ...node("dummy-result-overall-s", "s", { x: 640, y: 276 }),
      type: "wf-result",
    }
    const next = unstackOverlaps(
      [step, result, overall],
      {
        s: { x: 80, y: 80 },
        "dummy-result-s": { x: 640, y: 80 },
        "dummy-result-overall-s": { x: 640, y: 276 },
      },
      { s: 200, "dummy-result-s": 420, "dummy-result-overall-s": 360 },
    )
    expect(next["dummy-result-overall-s"].y).toBeGreaterThanOrEqual(80 + 420 + V_GAP)
    expect(next["dummy-result-s"].x).toBe(640)
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
    expect(point.x).toBe(80 + NODE_W + 80)
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

  it("places a dummy result child to the right of the parent without covering it", () => {
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
    expect(next["dummy-result-t"].x).toBe(80 + NODE_W + 80)
    expect(next["dummy-result-t"].y).toBeGreaterThanOrEqual(80)
    expect(next.t).toEqual({ x: 80, y: 80 })
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
    expect(next.a.x).toBe(80 + NODE_W + 80)
    expect(next.b.x).toBe(80 + NODE_W + 80)
    expect(next.b.y).toBeGreaterThan(next.a.y)
  })
})
