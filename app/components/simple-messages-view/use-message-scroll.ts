import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import type { SimpleMessagesViewProps, InstanceLog } from "./types"
const SCROLL_BOTTOM_THRESHOLD_PX = 80

export function useMessageScroll(activeRobotInstance: SimpleMessagesViewProps["activeRobotInstance"], setIsStepIndicatorExpanded: (value: boolean) => void) {
  const scrollToBottomImmediateRef = useRef<(() => void) | null>(null)
  const [bottomPadding, setBottomPadding] = useState(150)
  const bottomContainerRef = useRef<HTMLDivElement>(null)
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  /** When true, new logs follow the bottom (like a terminal). When false, we show "Latest" instead of auto-scrolling. */
  const stickToBottomRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const lastScrollTopRef = useRef(0)

  const updateStickToBottomFromScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight
    const nearBottom = dist <= SCROLL_BOTTOM_THRESHOLD_PX
    stickToBottomRef.current = nearBottom
    setShowJumpToLatest(!nearBottom)
  }, [])

  // Reset follow mode when switching instances (user expects to land on the latest for the new instance)
  useLayoutEffect(() => {
    stickToBottomRef.current = true
    lastScrollTopRef.current = 0
  }, [activeRobotInstance?.id])

  const scrollContainerToBottomImmediate = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
      lastScrollTopRef.current = container.scrollTop
    }
  }, [])

  /** Used after fetching logs: only snap down if the user was already following the tail. */
  const scrollToBottomImmediateIfStuck = useCallback(() => {
    if (stickToBottomRef.current) {
      scrollContainerToBottomImmediate()
    }
  }, [scrollContainerToBottomImmediate])
  useLayoutEffect(() => {
    scrollToBottomImmediateRef.current = scrollToBottomImmediateIfStuck
  }, [scrollToBottomImmediateIfStuck])

  const jumpToLatestLogs = useCallback(() => {
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
    setIsStepIndicatorExpanded(false)
    scrollContainerToBottomImmediate()
  }, [scrollContainerToBottomImmediate, setIsStepIndicatorExpanded])

  // Auto scroll to bottom when sending or other explicit follow actions
  const scrollToBottom = useCallback(() => {
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }, [])

  return { bottomPadding, setBottomPadding, bottomContainerRef, scrollToBottomImmediateRef, messagesEndRef, messagesContainerRef, stickToBottomRef, showJumpToLatest, setShowJumpToLatest, lastScrollTopRef, updateStickToBottomFromScroll, scrollContainerToBottomImmediate, scrollToBottomImmediateIfStuck, jumpToLatestLogs, scrollToBottom }
}

interface PendingHistoryScroll {
  height: number
  firstLogId?: string
  anchor?: { id: string; offset: number }
  settled: boolean
}

function timelineElements(container: HTMLDivElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-timeline-item-id]'))
}

type MessageScrollEffectsOptions = ReturnType<typeof useMessageScroll> & {
  activeRobotInstance: SimpleMessagesViewProps["activeRobotInstance"]
  isLoadingLogs: boolean
  isLoadingPlans: boolean
  isLoadingMore: boolean
  logs: InstanceLog[]
  hasMoreLogs: boolean
  loadMoreLogs: () => Promise<void>
}

export function useMessageScrollEffects({
  setBottomPadding, bottomContainerRef, messagesContainerRef, stickToBottomRef,
  setShowJumpToLatest, lastScrollTopRef, updateStickToBottomFromScroll,
  scrollContainerToBottomImmediate, activeRobotInstance, isLoadingLogs,
  isLoadingMore, logs, hasMoreLogs, loadMoreLogs,
}: MessageScrollEffectsOptions) {
  const instanceId = activeRobotInstance?.id
  const initializedViewRef = useRef<{ instanceId?: string; container: HTMLDivElement } | null>(null)
  const pendingHistoryRef = useRef<PendingHistoryScroll | null>(null)
  const [, setHistoryRevision] = useState(0)

  useLayoutEffect(() => {
    return () => {
      initializedViewRef.current = null
      pendingHistoryRef.current = null
    }
  }, [instanceId])

  // Run before every paint: cached conversations may never enter a loading state,
  // and streamed text, collapsed tools, and plans can change height without new logs.
  useLayoutEffect(() => {
    const container = messagesContainerRef.current
    if (isLoadingLogs || !container) return

    const initialized = initializedViewRef.current
    if (initialized?.instanceId !== instanceId || initialized?.container !== container) {
      initializedViewRef.current = { instanceId, container }
      pendingHistoryRef.current = null
      stickToBottomRef.current = true
      setShowJumpToLatest(false)
    }

    const pending = pendingHistoryRef.current
    if (pending && !isLoadingMore) {
      const prepended = logs[0]?.id !== pending.firstLogId
      if (prepended && !stickToBottomRef.current) {
        // Preserve any scrolling that occurred while the older page was in flight.
        const anchor = pending.anchor
        const element = anchor && timelineElements(container).find(item => item.dataset.timelineItemId === anchor.id)
        const shift = element && anchor
          ? element.getBoundingClientRect().top + container.scrollTop - anchor.offset
          : container.scrollHeight - pending.height
        container.scrollTop += shift
        lastScrollTopRef.current = container.scrollTop
        pending.height = container.scrollHeight
        pending.firstLogId = logs[0]?.id
        if (element && anchor) anchor.offset = element.getBoundingClientRect().top + container.scrollTop
      }
      if (pending.settled) pendingHistoryRef.current = null
    }

    if (stickToBottomRef.current) scrollContainerToBottomImmediate()
  })

  useEffect(() => {
    if (!bottomContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use bounding client rect for more accurate total height
        const rect = (entry.target as HTMLElement).getBoundingClientRect()
        // Add 24px as extra buffer to ensure the last message is just above the input area and floating elements
        setBottomPadding(Math.max(60, rect.height + 24))
      }
    })
    
    const target = bottomContainerRef.current
    observer.observe(target)
    
    return () => observer.disconnect()
  }, [isLoadingLogs, instanceId, bottomContainerRef, setBottomPadding])

  // Images and other async content can grow without a React render.
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) scrollContainerToBottomImmediate()
    })
    observer.observe(container)
    if (container.firstElementChild) observer.observe(container.firstElementChild)
    return () => observer.disconnect()
  }, [instanceId, isLoadingLogs, messagesContainerRef, stickToBottomRef, scrollContainerToBottomImmediate])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const previousTop = lastScrollTopRef.current
    const currentTop = container.scrollTop
    lastScrollTopRef.current = currentTop
    if (currentTop === previousTop) return

    const scrollingUp = currentTop < previousTop
    updateStickToBottomFromScroll()
    if (scrollingUp) {
      stickToBottomRef.current = false
      setShowJumpToLatest(true)
    }
    if (!scrollingUp || currentTop >= 100 || !hasMoreLogs || isLoadingLogs || isLoadingMore || pendingHistoryRef.current) {
      return
    }

    const anchor = timelineElements(container).find(item =>
      item.getBoundingClientRect().bottom >= container.getBoundingClientRect().top
    )
    const pending: PendingHistoryScroll = {
      height: container.scrollHeight, firstLogId: logs[0]?.id, settled: false,
      anchor: anchor ? {
        id: anchor.dataset.timelineItemId!,
        offset: anchor.getBoundingClientRect().top + container.scrollTop,
      } : undefined,
    }
    pendingHistoryRef.current = pending
    void loadMoreLogs().catch(() => {
      // The data hook reports fetch failures; keep the current viewport on retry.
    }).finally(() => {
      if (pendingHistoryRef.current !== pending) return
      pending.settled = true
      setHistoryRevision(revision => revision + 1)
    })
  }, [lastScrollTopRef, updateStickToBottomFromScroll, stickToBottomRef, setShowJumpToLatest, hasMoreLogs, isLoadingLogs, isLoadingMore, loadMoreLogs, logs])

  return { handleScroll }
}
