import { agentDetailHref, buildAgentList, matchesAgentSearch, type AgentListRow } from "@/app/agents/list/agent-list-model"
import { projectAgentHierarchy, type HierarchyNode } from "@/app/agents/list/agent-hierarchy"
import { eligibleSupervisorIds } from "@/app/agents/list/agent-supervisors"

function row(id: string, name: string, role: string | null, agentOrigin: string | null = null): AgentListRow {
  return { id, name, role, agentOrigin, type: "support", description: "", status: "inactive",
    last_active: null, supervisor: null, conversations: 0, success_rate: 0 }
}

it("projects every stable id once while retaining unprovisioned slots and legacy shortcuts", () => {
  const rows = [row("intentional", "Customer Support", "Customer Support", "independent"),
    row("legacy1", "Helpdesk", "Customer Support"), row("legacy2", "Helpdesk", "Customer Support"),
    row("unrelated-role", "Data Analyst", "Customer Support"), row("untyped", "Content Creator & Copywriter", null)]
  const list = buildAgentList(rows)
  expect(list.filter(a => a.dbData).map(a => a.id).sort()).toEqual(rows.map(r => r.id).sort())
  expect(new Set(list.map(a => a.id)).size).toBe(list.length)
  expect(list.find(a => a.templateId === "7")).toMatchObject({ id: "legacy1", name: "Helpdesk" })
  expect(list.find(a => a.id === "legacy1")?.activities).toContainEqual(expect.objectContaining({ id: "cs4" }))
  expect(list.find(a => a.id === "intentional")?.activities).toEqual([])
  for (const r of rows) expect(agentDetailHref(list.find(a => a.id === r.id)!)).toBe(`/agents/${r.id}`)
  expect(agentDetailHref(list.find(a => a.templateId === "4")!)).toBe("/agents/data_analyst")
  expect(agentDetailHref(list.find(a => a.templateId === "6")!)).toBe("/agents/content_creator")
  expect(list.filter(a => matchesAgentSearch(a, "SUPPORT")).map(a => a.id).sort()).toEqual(["intentional", "legacy1", "legacy2", "unrelated-role"])
})

it("does not treat an independent agent as a default when it is the only agent for that role", () => {
  const list = buildAgentList([row("only", "Customer Support", "Customer Support", "independent")])
  const support = list.filter(a => a.name === "Customer Support")
  expect(support.map(agentDetailHref)).toEqual(["/agents/support", "/agents/only"])
})

function saved(id: string, supervisor: string | null, name = id): AgentListRow {
  return { ...row(id, name, "Customer Support", "independent"), supervisor }
}

function edges(roots: HierarchyNode[]) {
  const links: string[] = []
  const queue = roots.slice()
  for (const node of queue) {
    for (const child of node.children) {
      links.push(`${node.agent.id} -> ${child.agent.id}`)
      queue.push(child)
    }
  }
  return links.sort()
}

it("links distinct saved IDs across roles and template slots, never uses templates as supervisors", () => {
  const rows = [saved("rep", "east", "Helpdesk"), saved("west", null, "Desk"), saved("east", "west", "Desk"),
    saved("peer", "east"), { ...saved("legacy", "rep"), role: "Data Analyst", agentOrigin: null },
    saved("absent", "7"), saved("rep", "east", "Helpdesk")]
  const list = buildAgentList(rows)
  const { roots, entries, templates, duplicateNames } = projectAgentHierarchy(list, "")
  expect(entries.filter(entry => entry.agent.dbData).map(entry => entry.agent.id).sort()).toEqual(["absent", "east", "legacy", "peer", "rep", "west"])
  expect(edges(roots)).toEqual(["east -> peer", "east -> rep", "rep -> legacy", "west -> east"])
  expect(roots.map(node => [node.agent.id, node.line.kind])).toEqual([["west", "unassigned"], ["absent", "missing"]])
  expect(duplicateNames).toEqual(new Set(["Desk"]))
  expect(templates).toContainEqual(expect.objectContaining({ id: "7", lastActive: "" }))
  expect(templates.every(agent => !agent.dbData)).toBe(true)
})

it("shows matches only; keeps children of hidden parents without reconnecting them to visible ancestors", () => {
  const list = buildAgentList([saved("first", null, "Match"), saved("middle", "first", "Other"),
    saved("last", "middle", "MATCH"), saved("child", "last", "Match too"), saved("unrelated", null)])
  const { roots, templates } = projectAgentHierarchy(list, " match ")
  expect(templates).toEqual([])
  expect(roots.map(n => n.agent.id)).toEqual(["first", "last"])
  expect(roots[1].line).toMatchObject({ kind: "filtered", supervisor: { id: "middle" } })
  expect(edges(roots)).toEqual(["last -> child"])
  expect(projectAgentHierarchy(list, "nothing like this").entries).toEqual([])
})

it("suppresses self and intra-cycle edges but retains direct reports, even when search hides a cycle member", () => {
  const list = buildAgentList([saved("leaf", "a"), saved("a", "b", "Match this cycle"), saved("b", "c"),
    saved("c", "a"), saved("self", "self"), saved("next", "self"), saved("broken", "elsewhere"), saved("sub", "broken")])
  const graph = projectAgentHierarchy(list, "")
  expect(graph.roots.map(n => [n.agent.id, n.line.kind])).toEqual([
    ["a", "cycle"], ["b", "cycle"], ["c", "cycle"], ["self", "cycle"], ["broken", "missing"],
  ])
  expect(edges(graph.roots)).toEqual(["a -> leaf", "broken -> sub", "self -> next"])
  expect(projectAgentHierarchy(list, "Match this").roots[0].line.kind).toBe("cycle")
})

it("renders an overlapping ID once without asserting an edge if the observations disagree", () => {
  const list = buildAgentList([saved("root", null), saved("overlap", "root"), saved("overlap", null), saved("overlap", "root")])
  const { roots } = projectAgentHierarchy(list, "")
  expect(roots.map(n => [n.agent.id, n.line.kind])).toEqual([["root", "unassigned"], ["overlap", "missing"]])
  expect(edges(roots)).toEqual([])
})

it("offers only verified candidate chains, excluding self and transitive descendants", () => {
  const rows = [saved("root", null), saved("peer", "root"), saved("editing", "root"), saved("child", "editing"),
    saved("grandchild", "child"), saved("missing", "other-site"), saved("dangling", "missing"),
    saved("x", "y"), saved("y", "x"), saved("cycle-report", "x"), saved("self", "self"),
    saved("duplicate", null), saved("duplicate", "peer")]
  expect(eligibleSupervisorIds(rows, "editing")).toEqual(new Set(["root", "peer"]))
  expect(eligibleSupervisorIds(rows)).toEqual(new Set(["root", "peer", "editing", "child", "grandchild"]))
  expect(eligibleSupervisorIds(rows, "x")).toEqual(eligibleSupervisorIds(rows))
})

it("resolves deep chains without recursive walks or depth cutoffs", () => {
  const length = 10000
  const rows = Array.from({ length }, (_, i) => saved(`node-${i}`, i + 1 === length ? null : `node-${i + 1}`))
  const { roots } = projectAgentHierarchy(buildAgentList(rows), "")
  expect(roots.map(n => n.agent.id)).toEqual([`node-${length - 1}`])
  expect(edges(roots)).toHaveLength(length - 1)
  const eligible = eligibleSupervisorIds(rows)
  expect(eligible.size).toBe(128)
  expect(eligible.has('node-9872')).toBe(true)
  expect(eligible.has('node-9871')).toBe(false)
  expect(eligibleSupervisorIds(rows, "node-9989").size).toBe(10)
})