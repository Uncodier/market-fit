import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { ConversationListItem } from '@/app/types/chat'
import { getConversations } from '@/app/services/getConversations.client'
import { coerceDate } from '@/app/utils/coerce-date'

type CombinedFilter = 'all' | 'outbound' | 'inbound' | 'replied' | 'tasks' | 'assigned' | 'qualified'

interface UseConversationsListOptions {
  siteId: string
  userId?: string
  combinedFilter: CombinedFilter
  debouncedSearchQuery: string
}

function getFilterParams(combinedFilter: CombinedFilter, userId?: string) {
  const channelFilter = 'all' as const
  const assigneeFilter = combinedFilter === 'assigned' ? 'assigned' as const : 'all' as const
  const initiatedByFilter =
    combinedFilter === 'inbound' ? 'visitor' as const :
    combinedFilter === 'outbound' ? 'agent' as const :
    combinedFilter === 'replied' ? 'replied' as const :
    'all' as const
  const tasksOnly = combinedFilter === 'tasks'
  const qualifiedLeadsOnly = combinedFilter === 'qualified'

  return { channelFilter, assigneeFilter, initiatedByFilter, tasksOnly, qualifiedLeadsOnly, userId }
}

function normalizeConversation(item: ConversationListItem): ConversationListItem {
  return {
    ...item,
    timestamp: coerceDate(item.timestamp),
  }
}

function normalizeConversations(items: ConversationListItem[]): ConversationListItem[] {
  return items.map(normalizeConversation)
}

export function useConversationsList({
  siteId,
  userId,
  combinedFilter,
  debouncedSearchQuery,
}: UseConversationsListOptions) {
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [hasEmptyResult, setHasEmptyResult] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const swrKey = siteId
    ? ['conversations', siteId, combinedFilter, debouncedSearchQuery, userId || '']
    : null

  const fetchFirstPage = useCallback(async () => {
    const params = getFilterParams(combinedFilter, userId)
    const result = await getConversations(
      siteId,
      1,
      20,
      params.channelFilter,
      params.assigneeFilter,
      params.userId,
      debouncedSearchQuery || undefined,
      params.initiatedByFilter,
      params.tasksOnly,
      params.qualifiedLeadsOnly
    )
    return normalizeConversations(result)
  }, [siteId, combinedFilter, debouncedSearchQuery, userId])

  const { data: conversationsData, isLoading: isSwrLoading, mutate } = useSWR(
    swrKey,
    fetchFirstPage
  )

  const conversations = useMemo(
    () => normalizeConversations(conversationsData || []),
    [conversationsData]
  )

  useEffect(() => {
    setCurrentPage(1)
    setHasMore(true)
    setIsInitialLoad(true)
  }, [siteId, combinedFilter, debouncedSearchQuery])

  useEffect(() => {
    if (conversationsData === undefined) return
    setHasMore(conversationsData.length === 20)
    setHasEmptyResult(conversationsData.length === 0)
    setIsInitialLoad(false)
  }, [conversationsData])

  const isLoading = isSwrLoading && conversationsData === undefined

  const updateConversations = useCallback(
    (updater: ConversationListItem[] | ((prev: ConversationListItem[]) => ConversationListItem[])) => {
      mutate(
        (current = []) => {
          const next = typeof updater === 'function' ? updater(current) : updater
          return normalizeConversations(next)
        },
        false
      )
    },
    [mutate]
  )

  const refreshConversations = useCallback(async () => {
    setCurrentPage(1)
    setHasMore(true)
    await mutate()
  }, [mutate])

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !siteId) return

    setIsLoadingMore(true)
    const nextPage = currentPage + 1

    try {
      const params = getFilterParams(combinedFilter, userId)
      const result = await getConversations(
        siteId,
        nextPage,
        20,
        params.channelFilter,
        params.assigneeFilter,
        params.userId,
        debouncedSearchQuery || undefined,
        params.initiatedByFilter,
        params.tasksOnly,
        params.qualifiedLeadsOnly
      )

      if (result.length > 0) {
        mutate((current = []) => {
          const existingIds = new Set(current.map((conv) => conv.id))
          const newConversations = normalizeConversations(
            result.filter((conv) => !existingIds.has(conv.id))
          )
          return [...current, ...newConversations]
        }, false)
        setCurrentPage(nextPage)
        setHasMore(result.length === 20)
        setHasEmptyResult(false)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('Error loading more conversations:', error)
      setHasMore(false)
    } finally {
      setIsLoadingMore(false)
    }
  }, [
    isLoadingMore,
    hasMore,
    siteId,
    currentPage,
    combinedFilter,
    userId,
    debouncedSearchQuery,
    mutate,
  ])

  const refreshRef = useRef(refreshConversations)
  refreshRef.current = refreshConversations

  return {
    conversations,
    isLoading,
    isLoadingMore,
    hasMore,
    hasEmptyResult,
    isInitialLoad,
    currentPage,
    updateConversations,
    refreshConversations,
    loadMore,
    refreshRef,
  }
}
