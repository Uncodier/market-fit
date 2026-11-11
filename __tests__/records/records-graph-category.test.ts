import { buildGraphData } from "@/app/records/components/records-graph-model"

const field = { name: "related", type: "relation", relationTarget: "record", targetCategoryId: "expected" }
const origin = { id: "origin", title: "Origin", category: { template_fields: [field] }, relations: { related: "target" } }

it("does not link a loaded record from the wrong category or use its title as a valid target", () => {
  const graph = buildGraphData([origin, { id: "target", title: "Wrong category title", category_id: "other" }], [], {})
  expect(graph.links).toEqual([])
  // The independent loaded record is still visible, but is not a relation target.
  expect(graph.nodes.find(node => node.id === "target")?.val).toBe(10)
})

it("links a loaded record in the constrained category", () => {
  const graph = buildGraphData([origin, { id: "target", title: "Valid", category_id: "expected" }], [], {})
  expect(graph.links).toEqual([expect.objectContaining({ source: "origin", target: "target" })])
})

it("does not borrow a different category's resolved preview or a raw ID alias", () => {
  const graph = buildGraphData([origin], [], { "record:other:target": "Wrong category", target: "Raw alias" })
  expect(graph.links).toEqual([])
  expect(graph.nodes.map(node => node.label)).toEqual(["Origin"])
})

it("preserves the legacy lead default for an omitted relationTarget", () => {
  const graph = buildGraphData([{ ...origin, category: { template_fields: [{ name: "related", type: "relation" }] } }], [], { "lead:target": "Lead" })
  expect(graph.links).toEqual([expect.objectContaining({ target: "lead:target" })])
  expect(graph.nodes.find(node => node.id === "lead:target")?.label).toBe("Lead")
})

it.each(["person", "unknown"])("does not reinterpret an explicitly unsupported %s target", relationTarget => {
  const graph = buildGraphData([{ ...origin, category: { template_fields: [{ name: "related", type: "relation", relationTarget }] } }], [], { "lead:target": "Lead", [`${relationTarget}:target`]: "Unsupported" })
  expect(graph.links).toEqual([])
  expect(graph.nodes).toHaveLength(1)
})

it("does not borrow another target's label for a missing legacy lead entity", () => {
  const graph = buildGraphData([{ ...origin, category: { template_fields: [{ name: "related", type: "relation" }] } }], [], { "company:target": "Company", target: "Raw alias" })
  expect(graph.links).toEqual([])
  expect(graph.nodes).toHaveLength(1)
})

it("does not link a trashed loaded record", () => {
  const graph = buildGraphData([origin, { id: "target", category_id: "expected", deleted_at: "2026-11-11" }], [], {})
  expect(graph.links).toEqual([])
})