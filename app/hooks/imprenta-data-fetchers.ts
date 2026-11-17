import { createClient } from '@/lib/supabase/client'
import type { InstanceNode } from '@/app/types/instance-nodes'
import { WF_LOAD_NODE_TYPES } from '@/app/components/workflows/types'

export interface ImprentaData {
  nodes: InstanceNode[]
  contexts: Record<string, unknown>[]
  logs: Record<string, unknown>[]
}

export type ImprentaGraphSnapshot = ImprentaData & { graphReady?: boolean }
export const EMPTY_NODES: InstanceNode[] = []
export const EMPTY_CONTEXTS: Record<string, unknown>[] = []
export const EMPTY_LOGS: Record<string, unknown>[] = []
const PAGE_SIZE = 500
const rootCreationPending = new Set<string>()

async function fetchAllNodes(instanceId: string): Promise<InstanceNode[]> {
  const supabase = createClient()
  const nodes: InstanceNode[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('instance_nodes')
      .select('*')
      .eq('instance_id', instanceId)
      .not('type', 'in', `(${WF_LOAD_NODE_TYPES.join(',')})`)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data) throw new Error('Node data is unavailable')
    nodes.push(...data as InstanceNode[])
    if (data.length < PAGE_SIZE) return nodes
  }
}

export async function fetchContextsForNodes(nodeIds: string[]): Promise<ImprentaData['contexts']> {
  const supabase = createClient()
  const contexts: ImprentaData['contexts'] = []
  const chunkSize = 200
  for (let i = 0; i < nodeIds.length; i += chunkSize) {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('instance_node_contexts')
        .select('*')
        .in('target_node_id', nodeIds.slice(i, i + chunkSize))
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      if (!data) throw new Error('Graph connections are unavailable')
      contexts.push(...data)
      if (data.length < PAGE_SIZE) break
    }
  }
  return contexts
}

async function ensureRootNode(instanceId: string, siteId: string): Promise<InstanceNode | null> {
  if (rootCreationPending.has(instanceId)) return null
  rootCreationPending.add(instanceId)
  try {
    const supabase = createClient()
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) return null
    const { data, error } = await supabase
      .from('instance_nodes')
      .insert({
        instance_id: instanceId, site_id: siteId, user_id: sessionData.session.user.id,
        parent_node_id: null, type: 'prompt', status: 'pending',
        prompt: { text: '' }, settings: {}, result: {},
      })
      .select('*')
      .single()
    if (error) throw error
    return data as InstanceNode
  } finally {
    rootCreationPending.delete(instanceId)
  }
}

export async function fetchImprentaGraph(
  [, instanceId, siteId]: readonly [string, string, string],
  createRoot = true,
): Promise<ImprentaGraphSnapshot> {
  let nodes = await fetchAllNodes(instanceId)
  if (createRoot && nodes.length === 0) {
    const root = await ensureRootNode(instanceId, siteId)
    if (root) nodes = [root]
  }
  const contexts = await fetchContextsForNodes(nodes.map(node => node.id))
  // Logs in this snapshot are compatibility data, not evidence of log readiness.
  return { nodes, contexts, logs: EMPTY_LOGS, graphReady: true }
}

export async function fetchImprentaLogs(instanceId: string, complete = false): Promise<ImprentaData['logs']> {
  const supabase = createClient()
  const logs: ImprentaData['logs'] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const query = supabase
      .from('instance_logs')
      .select('id, log_type, message, details, tool_name, tool_args, tool_result, command_id, created_at')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    // Preserve the initial display read. Only explicit publish reads page through history.
    const { data, error } = await (complete ? query.range(from, from + PAGE_SIZE - 1) : query)
    if (error) throw error
    if (!data) throw new Error('Instance logs are unavailable')
    logs.push(...data)
    if (!complete || data.length < PAGE_SIZE) return logs
  }
}
