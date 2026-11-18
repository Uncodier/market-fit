import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { EMPTY_LOGS, fetchImprentaLogs, type ImprentaData } from './imprenta-data-fetchers'

type LogReadState = { scope: object; pending: boolean; error?: unknown }
type ActiveRead = { scope: object; complete: boolean; promise: Promise<ImprentaData['logs']> }

export function useImprentaLogs(instanceId?: string, siteId?: string, loadDisplayLogs = true) {
  const scope = useMemo(() => ({ instanceId, siteId }), [instanceId, siteId])
  const activeScope = useRef<object | null>(scope)
  const version = useRef(0)
  const reads = useRef<ActiveRead[]>([])
  const [readState, setReadState] = useState<LogReadState>()
  useLayoutEffect(() => {
    activeScope.current = scope
    return () => {
      activeScope.current = null
      version.current += 1
      reads.current = []
    }
  }, [scope])

  const { data, error, isLoading, mutate } = useSWR(
    instanceId && siteId ? ['imprenta-logs', instanceId, siteId] as const : null,
    loadDisplayLogs ? ([, id]) => fetchImprentaLogs(id) : null,
    {
      keepPreviousData: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      refreshInterval: 0,
      revalidateOnMount: loadDisplayLogs,
    },
  )

  const refreshLogs = useCallback((complete = false): Promise<ImprentaData['logs']> => {
    if (!instanceId || !siteId || activeScope.current !== scope) {
      return Promise.reject(new Error('The active canvas changed; retry publishing from the current canvas'))
    }
    // Complete reads can also satisfy display refreshes, never the reverse.
    const compatible = reads.current.find(read => read.scope === scope && (read.complete || !complete))
    if (compatible) return compatible.promise
    const requestVersion = ++version.current
    const isActive = () => activeScope.current === scope
    const mayPublish = () => isActive() && version.current === requestVersion
    setReadState({ scope, pending: true })
    // Retire an older SWR read before starting the explicit read, including on failure.
    void mutate(current => current, false)
    const promise = (async () => {
      try {
        const logs = await fetchImprentaLogs(instanceId, complete)
        if (!isActive()) throw new Error('The active canvas changed; retry publishing')
        if (mayPublish()) {
          await mutate(current => mayPublish() ? logs : current, false)
          if (mayPublish()) setReadState({ scope, pending: false })
        }
        if (!isActive()) throw new Error('The active canvas changed; retry publishing')
        // Cache ordering must not cancel another same-scope caller's valid result.
        return logs
      } catch (readError) {
        if (mayPublish()) setReadState({ scope, pending: false, error: readError })
        throw readError
      } finally {
        reads.current = reads.current.filter(read => read !== entry)
      }
    })()
    const entry: ActiveRead = { scope, complete, promise }
    reads.current.push(entry)
    return promise
  }, [instanceId, siteId, scope, mutate])

  // A successful initial display read may be server-limited or stale. It never
  // substitutes for the fresh, complete read required at publish admission.
  const ensureImprentaLogs = useCallback(() => refreshLogs(true), [refreshLogs])
  const displayWasEnabled = useRef(loadDisplayLogs)
  useEffect(() => {
    const newlyRequired = loadDisplayLogs && !displayWasEnabled.current
    displayWasEnabled.current = loadDisplayLogs
    if (newlyRequired) void refreshLogs().catch(() => {})
  }, [loadDisplayLogs, refreshLogs])
  const currentRead = readState?.scope === scope ? readState : undefined
  const logsError = currentRead?.error ?? error
  return {
    logs: data ?? EMPTY_LOGS,
    isLogsReady: Boolean(instanceId && siteId && data && !logsError && !currentRead?.pending),
    isLogsLoading: Boolean(isLoading || currentRead?.pending),
    logsError,
    refreshLogs,
    ensureImprentaLogs,
  }
}
