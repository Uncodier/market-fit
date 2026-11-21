import { MAX_SUPERVISOR_ANCESTORS } from '@/app/agents/list/agent-supervisors'

type HierarchyLink = { id: string; supervisor?: string | null }
export type ReadHierarchyLink = (id: string) => PromiseLike<{ data: HierarchyLink | null; error: unknown }>

/** Validate a proposed path using only same-site, caller-visible parents. The
 * database guard must enforce the same invariant when transactions overlap. */
export async function checkSupervisor(agentId: string, supervisor: string, read: ReadHierarchyLink) {
  const visited = new Set([agentId.toLowerCase()])
  let parent: string | null = supervisor.toLowerCase()
  while (parent !== null) {
    if (visited.has(parent)) return 'cycle'
    if (visited.size > MAX_SUPERVISOR_ANCESTORS) return 'unavailable'
    visited.add(parent)
    const { data, error }: Awaited<ReturnType<ReadHierarchyLink>> = await read(parent)
    if (error) return 'error'
    if (!data || data.id !== parent || data.supervisor === undefined) return 'unavailable'
    parent = data.supervisor
  }
  return 'valid'
}