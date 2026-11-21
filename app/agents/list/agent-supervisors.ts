/** Only persisted agents returned by the same site-scoped read belong in this index. */
export interface SupervisorReference {
  id: string
  supervisor?: string | null
}

// Mirrors the database ancestry walk. A prospective child's parent can have
// at most 127 ancestors above it (128 including the selected parent itself).
export const MAX_SUPERVISOR_ANCESTORS = 128

export function indexSupervisors(rows: readonly SupervisorReference[]) {
  const parents = new Map<string, string | null | undefined>()
  for (const { id, supervisor } of rows) {
    // Overlapping pages can repeat an identity. Conflicting observations are
    // unknown, not evidence for either edge (or for an unassigned supervisor).
    parents.set(id, parents.has(id) && parents.get(id) !== supervisor ? undefined : supervisor)
  }
  return parents
}

/** Iterative, linear-time inspection; a report of a cycle member isn't itself in that cycle. */
export function inspectSupervisorChains(parents: ReadonlyMap<string, string | null | undefined>) {
  const inspected = new Set<string>()
  const rooted = new Set<string>()
  const cyclic = new Set<string>()
  for (const start of parents.keys()) {
    if (inspected.has(start)) continue
    const path = new Set<string>()
    let next: string | null | undefined = start
    while (next != null && parents.has(next) && !inspected.has(next) && !path.has(next)) {
      path.add(next)
      next = parents.get(next)
    }
    const reachesRoot = next === null || (next != null && rooted.has(next))
    let inCycle = false
    for (const id of path) {
      inspected.add(id)
      if (reachesRoot) rooted.add(id)
      if (id === next) inCycle = true
      if (inCycle) cyclic.add(id)
    }
  }
  return { rooted, cyclic }
}

/** Exclude self, descendants and chains that cannot be verified from the supplied rows. */
export function eligibleSupervisorIds(rows: readonly SupervisorReference[], agentId?: string): Set<string> {
  const parents = indexSupervisors(rows)
  if (agentId !== undefined) parents.delete(agentId)
  const { rooted } = inspectSupervisorChains(parents)
  const depths = new Map<string, number>()
  for (const id of rooted) {
    const path: string[] = []
    let next: string | null | undefined = id
    while (next != null && !depths.has(next)) { path.push(next); next = parents.get(next) }
    let depth = next == null ? 0 : depths.get(next)!
    for (let i = path.length - 1; i >= 0; --i) depths.set(path[i], ++depth)
  }
  return new Set([...rooted].filter(id => depths.get(id)! <= MAX_SUPERVISOR_ANCESTORS))
}