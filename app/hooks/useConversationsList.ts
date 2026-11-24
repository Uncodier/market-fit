import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import useSWR, { useSWRConfig } from 'swr'
import type { ConversationListItem } from '@/app/types/chat'
import { getConversationPage, type ConversationFilter, type ConversationPage } from '@/app/services/getConversations.client'
import { conversationReadError } from '@/app/services/conversations/conversation-read-error'
import { isTerminalRequestError } from '@/lib/swr/retry-policy'
import { isDemoSiteId } from '@/lib/demo-utils'

interface ListOptions {
  siteId: string
  userId?: string
  combinedFilter: ConversationFilter
  debouncedSearchQuery: string
  previewOnly?: boolean
}

type ListKey = readonly ['conversations', string, ConversationFilter, string, string]
type ReadError = ReturnType<typeof conversationReadError>
type ListSnapshot = ConversationPage & { pageError?: ReadError; denial?: ReadError }
const EMPTY: ConversationListItem[] = []

function readPage(key: ListKey, page: number, signal?: AbortSignal) {
  const [, siteId, filter, searchQuery, actorId] = key
  return getConversationPage({
    siteId, page, searchQuery, currentUserId: actorId || undefined, signal,
    assigneeFilter: filter === 'assigned' ? 'assigned' : 'all',
    initiatedByFilter: filter === 'inbound' ? 'visitor' : filter === 'outbound' ? 'agent' : filter === 'replied' ? 'replied' : 'all',
    tasksOnly: filter === 'tasks', qualifiedLeadsOnly: filter === 'qualified',
  })
}

export function useConversationsList({ siteId, userId, combinedFilter, debouncedSearchQuery, previewOnly = false }: ListOptions) {
  const key = useMemo<ListKey | null>(() => siteId && (userId || isDemoSiteId(siteId))
    ? ['conversations', siteId, combinedFilter, debouncedSearchQuery, userId || '']
    : null, [siteId, userId, combinedFilter, debouncedSearchQuery])
  const { mutate: mutateKey } = useSWRConfig()
  const pageOwner = useMemo(() => ({ key, previewOnly }), [key, previewOnly])
  const currentKey = useRef(key)
  const pendingPage = useRef<AbortController | null>(null)
  const firstRead = useRef<{ key: ListKey; controller: AbortController; request: Promise<ListSnapshot> } | null>(null)
  const [pagingOwner, setPagingOwner] = useState<typeof pageOwner | null>(null)

  // Each transition gets a new owner, even A -> B -> A. In particular, never use
  // SWR's bound mutate after awaiting a page: it targets the *latest* key.
  useLayoutEffect(() => {
    currentKey.current = key
    return () => {
      currentKey.current = null
      pendingPage.current?.abort()
      pendingPage.current = null
      // Strict Mode immediately reattaches this same key. Let it keep the
      // shared mount read, but abort a genuinely retired first page as well.
      const active = firstRead.current
      queueMicrotask(() => {
        if (currentKey.current === key) return
        active?.controller.abort()
        if (firstRead.current === active) firstRead.current = null
      })
    }
  }, [key])

  const fetchFirst = useCallback((requestedKey: ListKey) => {
    pendingPage.current?.abort()
    pendingPage.current = null
    setPagingOwner(null)
    // Explicit invalidations can bypass SWR's time-based deduplication.
    if (firstRead.current?.key === requestedKey) return firstRead.current.request
    const controller = new AbortController()
    const request = readPage(requestedKey, 1, controller.signal).catch(cause => {
      const failure = conversationReadError(cause)
      if (!isTerminalRequestError(failure)) throw failure
      // Throwing alone leaves stale rows in SWR. Quarantine the entry itself:
      // a subsequent transient failure must never make denied rows visible again.
      return { items: [], page: 0, hasMore: false, denial: failure }
    }).finally(() => {
      if (firstRead.current?.controller === controller) firstRead.current = null
    })
    firstRead.current = { key: requestedKey, controller, request }
    return request
  }, [])

  const { data, error, isValidating } = useSWR<ListSnapshot, ReadError>(key, fetchFirst, {
    keepPreviousData: false,
    shouldRetryOnError: false,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshInterval: 0,
  })
  const pageError = data?.pageError
  const terminalError = isTerminalRequestError(error) ? error : error ? undefined : data?.denial
  const snapshot = key && !terminalError && !data?.denial ? data : undefined
  const readError = key ? terminalError || error : undefined
  const interactive = !previewOnly && !!key && !readError
  // Check admission inside saved callbacks as well as when rendering buttons.
  const allowed = useRef({ interactive, snapshot, isValidating, terminalError })
  useLayoutEffect(() => { allowed.current = { interactive, snapshot, isValidating, terminalError } })
  useLayoutEffect(() => {
    if (!interactive) {
      pendingPage.current?.abort()
      pendingPage.current = null
    }
  }, [interactive])

  const refreshConversations = useCallback(async () => {
    if (!key || key !== currentKey.current || allowed.current.terminalError) return
    if (firstRead.current?.key === key) {
      await firstRead.current.request.catch(() => undefined) // SWR owns the error state.
      return
    }
    await mutateKey(key)
  }, [key, mutateKey])

  const updateConversations = useCallback((updater: (prev: ConversationListItem[]) => ConversationListItem[]) => {
    if (!key || currentKey.current !== key || !allowed.current.interactive || !allowed.current.snapshot || firstRead.current) return
    void mutateKey<ListSnapshot>(key, previous => previous && ({ ...previous, items: updater(previous.items) }), false)
  }, [key, mutateKey])

  const loadMore = useCallback(async () => {
    const { interactive: ready, isValidating: refreshing, snapshot: base } = allowed.current
    if (!key || currentKey.current !== key || !ready || refreshing || firstRead.current || !base?.hasMore || pendingPage.current) return
    const controller = new AbortController()
    pendingPage.current = controller
    setPagingOwner(pageOwner)
    const owned = () => currentKey.current === key && pendingPage.current === controller && !controller.signal.aborted
    try {
      const next = await readPage(key, base.page + 1, controller.signal)
      if (!owned()) return
      await mutateKey<ListSnapshot>(key, previous => {
        if (!previous || previous.page !== base.page) return previous
        const seen = new Set(previous.items.map(item => item.id))
        const items = [...previous.items]
        for (const row of next.items) {
          if (!seen.has(row.id)) items.push(row)
          seen.add(row.id)
        }
        return { ...next, items }
      }, false)
    } catch (cause) {
      if (!owned()) return
      const pageError = conversationReadError(cause)
      await mutateKey<ListSnapshot>(key, previous => {
        if (!previous || previous.page !== base.page) return previous
        return isTerminalRequestError(pageError)
          ? { items: [], page: 0, hasMore: false, denial: pageError }
          : { ...previous, pageError }
      }, false)
    } finally {
      if (owned()) {
        pendingPage.current = null
        setPagingOwner(null)
      }
    }
  }, [key, pageOwner, mutateKey])

  return {
    conversations: snapshot?.items ?? EMPTY,
    isLoading: !snapshot && !readError,
    isValidating,
    isLoadingMore: interactive && pagingOwner === pageOwner,
    hasMore: interactive && !!snapshot?.hasMore && !isValidating,
    hasEmptyResult: !!snapshot && !readError && snapshot.items.length === 0,
    isInitialLoad: !snapshot,
    currentPage: snapshot?.page ?? 0,
    readError, pageError: terminalError ? undefined : pageError, terminalError,
    updateConversations, refreshConversations, loadMore,
  }
}