import { useCallback, useLayoutEffect, useRef } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { InstanceNode } from '@/app/types/instance-nodes'

import { WF_LOAD_NODE_TYPES } from '@/app/components/workflows/types'

export interface ImprentaData {
  nodes: InstanceNode[]
  contexts: Record<string, unknown>[]
  logs: Record<string, unknown>[]
}

const rootCreationPending = new Set<string>()

async function fetchAllNodes(instanceId: string): Promise<InstanceNode[]> {
  const supabase = createClient()
  const PAGE = 500
  let data: InstanceNode[] = []
  let from = 0

  while (true) {
    const { data: page, error } = await supabase
      .from('instance_nodes')
      .select('*')
      .eq('instance_id', instanceId)
      .not('type', 'in', `(${WF_LOAD_NODE_TYPES.join(',')})`)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!page?.length) break

    data = data.concat(page as InstanceNode[])
    if (page.length < PAGE) break
    from += PAGE
  }

  return data
}

async function fetchContextsForNodes(nodeIds: string[]): Promise<Record<string, unknown>[]> {
  if (nodeIds.length === 0) return []

  const supabase = createClient()
  const CTX_CHUNK = 200
  const allCtx: Record<string, unknown>[] = []

  for (let i = 0; i < nodeIds.length; i += CTX_CHUNK) {
    const slice = nodeIds.slice(i, i + CTX_CHUNK)
    const { data: ctxData } = await supabase
      .from('instance_node_contexts')
      .select('*')
      .in('target_node_id', slice)

    if (ctxData?.length) allCtx.push(...ctxData)
  }

  return allCtx
}

async function ensureRootNode(instanceId: string, siteId: string): Promise<InstanceNode | null> {
  if (rootCreationPending.has(instanceId)) return null

  rootCreationPending.add(instanceId)

  try {
    const supabase = createClient()
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData?.session) return null

    const newNode = {
      instance_id: instanceId,
      site_id: siteId,
      user_id: sessionData.session.user.id,
      parent_node_id: null,
      type: 'prompt',
      status: 'pending',
      prompt: { text: '' },
      settings: {},
      result: {},
    }

    const { data: newDbNode, error: insertError } = await supabase
      .from('instance_nodes')
      .insert(newNode)
      .select('*')
      .single()

    if (insertError) throw insertError
    return newDbNode as InstanceNode
  } finally {
    rootCreationPending.delete(instanceId)
  }
}

async function fetchLogsForInstance(instanceId: string): Promise<Record<string, unknown>[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('instance_logs')
    .select('id, log_type, message, details, tool_name, tool_args, tool_result, command_id, created_at')
    .eq('instance_id', instanceId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error("Error fetching instance_logs for Imprenta:", error)
    return []
  }
  return data || []
}

async function fetchImprentaData([, instanceId, siteId]: readonly [string, string, string]): Promise<ImprentaData> {
  let nodes = await fetchAllNodes(instanceId)

  if (nodes.length === 0) {
    const root = await ensureRootNode(instanceId, siteId)
    if (root) nodes = [root]
  }

  const [contexts, logs] = await Promise.all([
    fetchContextsForNodes(nodes.map((n) => n.id)),
    fetchLogsForInstance(instanceId)
  ])
  return { nodes, contexts, logs }
}

export function useImprentaData(instanceId?: string, siteId?: string) {
  const swrKey = instanceId && siteId ? (['imprenta-data', instanceId, siteId] as const) : null
  const scope = `${siteId ?? ''}:${instanceId ?? ''}`
  const activeScope = useRef(scope)
  const refreshVersion = useRef(0)
  useLayoutEffect(() => {
    activeScope.current = scope
    return () => { refreshVersion.current += 1 }
  }, [scope])

  const { data, isLoading: isSwrLoading, mutate } = useSWR(swrKey, fetchImprentaData, {
    keepPreviousData: false,
    revalidateOnFocus: false,
  })

  const isLoading = Boolean(isSwrLoading && !data && instanceId)

  const refreshImprentaData = useCallback(async (
    options: { includeLogs?: boolean } = {},
  ): Promise<ImprentaData | undefined> => {
    if (!instanceId || !siteId) return undefined
    const version = ++refreshVersion.current
    const isCurrent = () => activeScope.current === scope && refreshVersion.current === version
    const snapshot: Pick<ImprentaData, 'nodes' | 'contexts'> & Partial<Pick<ImprentaData, 'logs'>> = options.includeLogs !== false
      ? await fetchImprentaData(['imprenta-data', instanceId, siteId])
      : await (async () => {
        const nodes = await fetchAllNodes(instanceId)
        const contexts = await fetchContextsForNodes(nodes.map((node) => node.id))
        return { nodes, contexts }
      })()
    // Returning from the OS file picker can start a read before the upload commits.
    // A confirmed upload or a scope change invalidates that older snapshot.
    if (!isCurrent()) return undefined
    let refreshed: ImprentaData | undefined
    await mutate((current) => {
      if (!isCurrent()) return current
      refreshed = {
        ...snapshot,
        logs: snapshot.logs ?? current?.logs ?? [],
      }
      return refreshed
    }, false)
    return isCurrent() ? refreshed : undefined
  }, [instanceId, siteId, scope, mutate])

  const cacheUploadedNode = useCallback(async (node: InstanceNode) => {
    if (activeScope.current !== scope || node.instance_id !== instanceId || node.site_id !== siteId) return
    refreshVersion.current += 1
    await mutate((current) => ({
      nodes: current?.nodes.some((existing) => existing.id === node.id)
        ? current.nodes.map((existing) => existing.id === node.id ? node : existing)
        : [...(current?.nodes || []), node],
      contexts: current?.contexts || [],
      logs: current?.logs || [],
    }), false)
  }, [instanceId, siteId, scope, mutate])

  const updateImprentaCache = useCallback(
    (updater: ImprentaData | ((prev: ImprentaData | undefined) => ImprentaData | undefined)) => {
      mutate(updater, false)
    },
    [mutate]
  )

  return {
    imprentaData: data,
    nodes: data?.nodes || [],
    contexts: data?.contexts || [],
    logs: data?.logs || [],
    isLoading,
    mutateImprenta: mutate,
    refreshImprentaData,
    cacheUploadedNode,
    updateImprentaCache,
  }
}
