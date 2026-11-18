import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import type { InstanceNode } from '@/app/types/instance-nodes'
import {
  EMPTY_CONTEXTS, EMPTY_LOGS, EMPTY_NODES, fetchImprentaGraph, imprentaNeedsDisplayLogs,
  type ImprentaData, type ImprentaGraphSnapshot,
} from './imprenta-data-fetchers'
import { useImprentaLogs } from './use-imprenta-logs'

export type { ImprentaData } from './imprenta-data-fetchers'

export function useImprentaData(instanceId?: string, siteId?: string, demandDrivenLogs = false) {
  const swrKey = instanceId && siteId ? (['imprenta-data', instanceId, siteId] as const) : null
  const scope = useMemo(() => ({ instanceId, siteId }), [instanceId, siteId])
  const activeScope = useRef<object | null>(scope)
  const refreshVersion = useRef(0)
  const [refreshFailure, setRefreshFailure] = useState<{ scope: object; error: unknown }>()
  useLayoutEffect(() => {
    activeScope.current = scope
    return () => {
      activeScope.current = null
      refreshVersion.current += 1
    }
  }, [scope])

  const fetchGraph = useCallback(async (key: readonly [string, string, string]) => {
    const version = ++refreshVersion.current
    const snapshot = await fetchImprentaGraph(key)
    // A successful reconnect/revalidation also recovers an explicit read failure.
    // Older reads and upload-invalidated snapshots cannot clear a newer failure.
    if (activeScope.current === scope && refreshVersion.current === version) setRefreshFailure(undefined)
    return snapshot
  }, [scope])

  const { data, error, isLoading: isSwrLoading, mutate } = useSWR<ImprentaGraphSnapshot>(swrKey, fetchGraph, {
    keepPreviousData: false,
    revalidateOnFocus: false,
  })
  const loadDisplayLogs = !demandDrivenLogs || imprentaNeedsDisplayLogs(data?.nodes ?? EMPTY_NODES)
  const { logs, refreshLogs, ...logsState } = useImprentaLogs(instanceId, siteId, loadDisplayLogs)
  const logsRef = useRef(logs)
  useLayoutEffect(() => { logsRef.current = logs }, [logs])
  const graphError = (refreshFailure?.scope === scope ? refreshFailure.error : undefined) ?? error
  const isGraphReady = Boolean(swrKey && data?.graphReady && !graphError)
  const isLoading = Boolean(isSwrLoading && !data && instanceId)

  const refreshImprentaData = useCallback(async (
    options: { includeLogs?: boolean } = {},
  ): Promise<ImprentaData | undefined> => {
    if (!instanceId || !siteId || activeScope.current !== scope) return undefined
    const version = ++refreshVersion.current
    const isCurrent = () => activeScope.current === scope && refreshVersion.current === version
    // Both reads start together; graph cache publication never waits on logs.
    // Log failures remain on logsError, not on the graph reconciliation promise.
    if (options.includeLogs !== false && loadDisplayLogs) void refreshLogs().catch(() => {})
    const graphRead = (async () => {
      try {
        const snapshot = await fetchImprentaGraph(['imprenta-data', instanceId, siteId], options.includeLogs !== false)
        // A confirmed upload or a scope change invalidates older file-picker reads.
        if (!isCurrent()) return undefined
        let refreshed: ImprentaGraphSnapshot | undefined
        await mutate(current => {
          if (!isCurrent()) return current
          refreshed = { ...snapshot, logs: logsRef.current }
          return refreshed
        }, false)
        if (!isCurrent()) return undefined
        setRefreshFailure(undefined)
        return refreshed
      } catch (refreshError) {
        if (isCurrent()) setRefreshFailure({ scope, error: refreshError })
        throw refreshError
      }
    })()
    return graphRead
  }, [instanceId, siteId, scope, mutate, refreshLogs, loadDisplayLogs])

  const cacheUploadedNode = useCallback(async (node: InstanceNode) => {
    if (activeScope.current !== scope || node.instance_id !== instanceId || node.site_id !== siteId) return
    refreshVersion.current += 1
    await mutate(current => {
      if (activeScope.current !== scope) return current
      return {
        nodes: current?.nodes.some(existing => existing.id === node.id)
          ? current.nodes.map(existing => existing.id === node.id ? node : existing)
          : [...(current?.nodes ?? EMPTY_NODES), node],
        contexts: current?.contexts ?? EMPTY_CONTEXTS,
        logs: current?.logs ?? EMPTY_LOGS,
        // An upload alone cannot establish that all required relations were read.
        graphReady: current?.graphReady ?? false,
      }
    }, false)
  }, [instanceId, siteId, scope, mutate])

  const updateImprentaCache = useCallback(
    (updater: ImprentaData | ((prev: ImprentaData | undefined) => ImprentaData | undefined)) => {
      if (activeScope.current !== scope) return
      void mutate(current => {
        if (activeScope.current !== scope) return current
        const next = typeof updater === 'function' ? updater(current) : updater
        return next ? { ...next, graphReady: current?.graphReady ?? false } : next
      }, false)
    },
    [mutate, scope],
  )

  return {
    imprentaData: data,
    nodes: data?.nodes ?? EMPTY_NODES,
    contexts: data?.contexts ?? EMPTY_CONTEXTS,
    logs,
    ...logsState,
    isLoading,
    isGraphReady,
    graphError,
    mutateImprenta: mutate,
    refreshImprentaData,
    cacheUploadedNode,
    updateImprentaCache,
  }
}
