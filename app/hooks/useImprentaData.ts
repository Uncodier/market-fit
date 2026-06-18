import { useCallback } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { InstanceNode } from '@/app/types/instance-nodes'

export interface ImprentaData {
  nodes: InstanceNode[]
  contexts: any[]
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

async function fetchContextsForNodes(nodeIds: string[]): Promise<any[]> {
  if (nodeIds.length === 0) return []

  const supabase = createClient()
  const CTX_CHUNK = 200
  const allCtx: any[] = []

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

async function fetchImprentaData([_, instanceId, siteId]: [string, string, string]): Promise<ImprentaData> {
  let nodes = await fetchAllNodes(instanceId)

  if (nodes.length === 0) {
    const root = await ensureRootNode(instanceId, siteId)
    if (root) nodes = [root]
  }

  const contexts = await fetchContextsForNodes(nodes.map((n) => n.id))
  return { nodes, contexts }
}

export function useImprentaData(instanceId?: string, siteId?: string) {
  const swrKey = instanceId && siteId ? (['imprenta-data', instanceId, siteId] as const) : null

  const { data, isLoading: isSwrLoading, mutate } = useSWR(swrKey, fetchImprentaData, {
    keepPreviousData: false,
    revalidateOnFocus: false,
  })

  const isLoading = Boolean(isSwrLoading && !data && instanceId)

  const refreshImprentaData = useCallback(async () => {
    await mutate()
  }, [mutate])

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
    isLoading,
    mutateImprenta: mutate,
    refreshImprentaData,
    updateImprentaCache,
  }
}
