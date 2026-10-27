import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import type { SimpleMessagesViewProps, InstanceLog } from "./types"
const SCROLL_BOTTOM_THRESHOLD_PX = 80
const SCROLL_POSITION_EPSILON_PX = 1

function scrollPosition(container: HTMLDivElement) {
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
  // Safari can report positions outside the scroll range during rubber-banding.
  const top = Math.max(0, Math.min(container.scrollTop, maxTop))
  return { top, maxTop, distance: maxTop - top }
}

export function useMessageScroll(activeRobotInstance: SimpleMessagesViewProps["activeRobotInstance"], setIsStepIndicatorExpanded: (value: boolean) => void) {
  const scrollToBottomImmediateRef = useRef<(() => void) | null>(null)
  const [bottomPadding, setBottomPadding] = useState(150)
  const bottomContainerRef = useRef<HTMLDivElement>(null)
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  /** Follow new logs until the user scrolls up; Latest visibility is measured separately. */
  const stickToBottomRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const lastScrollTopRef = useRef(0)

  const updateStickToBottomFromScroll = useCallback((allowResume = false) => {
    const container = messagesContainerRef.current
    if (!container) return
    const { top, distance } = scrollPosition(container)
    const nearBottom = distance <= SCROLL_BOTTOM_THRESHOLD_PX
    const scrollingUp = top < lastScrollTopRef.current && distance > SCROLL_POSITION_EPSILON_PX
    if (scrollingUp) stickToBottomRef.current = false
    else if (allowResume && top > lastScrollTopRef.current && nearBottom) stickToBottomRef.current = true
    // Visibility describes the viewport, not whether automatic following is enabled.
    // A small upward gesture must suspend following without flashing Latest.
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
      const { maxTop, distance } = scrollPosition(container)
      // Even a no-op assignment can interrupt native momentum scrolling in Safari.
      if (distance > SCROLL_POSITION_EPSILON_PX) container.scrollTop = maxTop
      lastScrollTopRef.current = scrollPosition(container).top
      setShowJumpToLatest(false)
    }
  }, [])

  /** Used after fetching logs: only snap down if the user was already following the tail. */
  const scrollToBottomImmediateIfStuck = useCallback(() => {
    // Layout/resize/fetch callbacks can run before the queued native scroll event.
    // Check the live position before a write erases the user's first upward move.
    updateStickToBottomFromScroll()
    if (stickToBottomRef.current) {
      scrollContainerToBottomImmediate()
    }
  }, [scrollContainerToBottomImmediate, updateStickToBottomFromScroll])
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
    // Smooth scrolling emits intermediate positions that look like leaving the
    // tail and can briefly mount the pinned request above the composer.
    scrollContainerToBottomImmediate()
  }, [scrollContainerToBottomImmediate])

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
  bottomPadding, setBottomPadding, bottomContainerRef, messagesContainerRef, stickToBottomRef,
  setShowJumpToLatest, lastScrollTopRef, updateStickToBottomFromScroll,
  scrollContainerToBottomImmediate, scrollToBottomImmediateIfStuck, activeRobotInstance, isLoadingLogs,
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

    // Reserve the actual overlay height in this commit. Waiting for the first
    // ResizeObserver callback paints the latest turn underneath the composer.
    const composer = bottomContainerRef.current
    if (composer) {
      const padding = Math.max(60, composer.getBoundingClientRect().height + 24)
      if (padding !== bottomPadding) setBottomPadding(padding)
    }

    const initialized = initializedViewRef.current
    if (initialized?.instanceId !== instanceId || initialized?.container !== container) {
      initializedViewRef.current = { instanceId, container }
      pendingHistoryRef.current = null
      stickToBottomRef.current = true
      setShowJumpToLatest(false)
      scrollContainerToBottomImmediate()
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
        lastScrollTopRef.current = scrollPosition(container).top
        pending.height = container.scrollHeight
        pending.firstLogId = logs[0]?.id
        if (element && anchor) anchor.offset = element.getBoundingClientRect().top + container.scrollTop
      }
      if (pending.settled) pendingHistoryRef.current = null
    }

    scrollToBottomImmediateIfStuck()
  })

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    // Stop following before a trackpad/touch gesture is applied by the browser.
    // Passive listeners leave native scrolling (including nested content) alone.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && event.deltaY < 0 && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        stickToBottomRef.current = false
      }
    }
    let touchY: number | undefined
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : undefined
    }
    const onTouchMove = (event: TouchEvent) => {
      const nextY = event.touches.length === 1 ? event.touches[0].clientY : undefined
      if (touchY !== undefined && nextY !== undefined && nextY > touchY) stickToBottomRef.current = false
      touchY = nextY
    }
    container.addEventListener('wheel', onWheel, { passive: true })
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
    }
  }, [instanceId, isLoadingLogs, messagesContainerRef, stickToBottomRef])

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
    const observer = new ResizeObserver(scrollToBottomImmediateIfStuck)
    observer.observe(container)
    if (container.firstElementChild) observer.observe(container.firstElementChild)
    return () => observer.disconnect()
  }, [instanceId, isLoadingLogs, messagesContainerRef, scrollToBottomImmediateIfStuck])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const previousTop = lastScrollTopRef.current
    const { top: currentTop, distance } = scrollPosition(container)
    // Reconcile visibility even for stationary events after viewport/content resizing.
    updateStickToBottomFromScroll(true)
    lastScrollTopRef.current = currentTop
    // Removing a preview/status or shrinking the composer can clamp scrollTop
    // to the bottom. Neither this nor Safari's rebound is reading older logs.
    const scrollingUp = currentTop < previousTop && distance > SCROLL_POSITION_EPSILON_PX
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
  }, [lastScrollTopRef, updateStickToBottomFromScroll, hasMoreLogs, isLoadingLogs, isLoadingMore, loadMoreLogs, logs])

  return { handleScroll }
}
