import { matchesAgentSearch, type ListedAgent } from "./agent-list-model"
import { indexSupervisors, inspectSupervisorChains } from "./agent-supervisors"

type ReportingLine =
  | { kind: "unassigned" | "missing" | "cycle" | "template" }
  | { kind: "reportsTo" | "filtered"; supervisor: ListedAgent }

interface HierarchyEntry {
  agent: ListedAgent
  line: ReportingLine
  /** Display a stable identifier when the visible name isn't unique. */
  duplicateName: boolean
}

export interface HierarchyNode extends HierarchyEntry {
  children: HierarchyNode[]
}

/** Search changes visibility, never the underlying relationship or its validation. */
export function projectAgentHierarchy(agents: readonly ListedAgent[], query: string) {
  const saved = agents.filter(agent => agent.dbData)
  const byId = new Map(saved.map(agent => [agent.id, agent]))
  const names = new Set<string>()
  const duplicateNames = new Set<string>()
  for (const agent of byId.values()) {
    if (names.has(agent.name)) duplicateNames.add(agent.name)
    names.add(agent.name)
  }
  const { cyclic } = inspectSupervisorChains(indexSupervisors(saved))
  const visible = agents.filter(agent => matchesAgentSearch(agent, query))
  const visibleIds = new Set(visible.filter(agent => agent.dbData).map(agent => agent.id))

  function reportingLine(agent: ListedAgent): ReportingLine {
    if (!agent.dbData) return { kind: "template" }
    if (agent.supervisor === null) return { kind: "unassigned" }
    if (cyclic.has(agent.id)) return { kind: "cycle" }
    const supervisor = agent.supervisor !== undefined && byId.get(agent.supervisor)
    if (!supervisor) return { kind: "missing" }
    return { kind: visibleIds.has(supervisor.id) ? "reportsTo" : "filtered", supervisor }
  }

  const entries: HierarchyEntry[] = visible.map(agent => ({
    agent, line: reportingLine(agent), duplicateName: !!agent.dbData && duplicateNames.has(agent.name),
  }))
  const nodes = new Map<string, HierarchyNode>()
  const templates: ListedAgent[] = []
  for (const entry of entries) {
    if (entry.line.kind === "template") templates.push(entry.agent)
    else nodes.set(entry.agent.id, { ...entry, children: [] })
  }
  const roots: HierarchyNode[] = []
  for (const node of nodes.values()) {
    if (node.line.kind === "reportsTo") nodes.get(node.line.supervisor.id)!.children.push(node)
    else roots.push(node)
  }
  return { entries, roots, templates, duplicateNames }
}

type Translate = (key: string, params?: Record<string, string | number>) => string

export function reportingLabel(line: ReportingLine, duplicateNames: ReadonlySet<string>, t: Translate) {
  switch (line.kind) {
    case "unassigned": return t("agents.hierarchy.noSupervisor")
    case "missing": return t("agents.hierarchy.missingSupervisor")
    case "cycle": return t("agents.hierarchy.cycle")
    case "template": return t("agents.hierarchy.setupTemplate")
    default: {
      const { name, id } = line.supervisor
      const label = duplicateNames.has(name) ? `${name} (${id})` : name
      return line.kind === "filtered"
        ? t("agents.hierarchy.filteredSupervisor", { name: label })
        : t("agents.hierarchy.reportsTo", { name: label })
    }
  }
}