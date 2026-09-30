import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import type { SimpleMessagesViewProps, InstanceLog } from "./types"
const SCROLL_BOTTOM_THRESHOLD_PX = 80

export function useMessageScroll(activeRobotInstance: SimpleMessagesViewProps["activeRobotInstance"], setIsStepIndicatorExpanded: (value: boolean) => void) {
  const shouldForceScrollRef = useRef(false)
  const scrollToBottomImmediateRef = useRef<(() => void) | null>(null)
  const [bottomPadding, setBottomPadding] = useState(150)
  const bottomContainerRef = useRef<HTMLDivElement>(null)
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  /** When true, new logs follow the bottom (like a terminal). When false, we show "Latest" instead of auto-scrolling. */
  const stickToBottomRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const wasLoadingLogsRef = useRef(false)
  const wasLoadingPlansRef = useRef(false)

  const updateStickToBottomFromScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const dist = container.scrollHeight - container.scrollTop - container.clientHeight
    const nearBottom = dist <= SCROLL_BOTTOM_THRESHOLD_PX
    stickToBottomRef.current = nearBottom
    setShowJumpToLatest(!nearBottom)
  }, [])

  // Reset follow mode when switching instances (user expects to land on the latest for the new instance)
  useEffect(() => {
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
  }, [activeRobotInstance?.id])

  const scrollContainerToBottomImmediateRef = useRef<(() => void) | null>(null)

  const scrollContainerToBottomImmediate = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])
  scrollContainerToBottomImmediateRef.current = scrollContainerToBottomImmediate

  /** Used after fetching logs: only snap down if the user was already following the tail. */
  const scrollToBottomImmediateIfStuck = useCallback(() => {
    if (stickToBottomRef.current) {
      scrollContainerToBottomImmediate()
      requestAnimationFrame(() => updateStickToBottomFromScroll())
    }
  }, [scrollContainerToBottomImmediate, updateStickToBottomFromScroll])
  scrollToBottomImmediateRef.current = scrollToBottomImmediateIfStuck

  const jumpToLatestLogs = useCallback(() => {
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
    setIsStepIndicatorExpanded(false)
    scrollContainerToBottomImmediate()
    requestAnimationFrame(() => {
      scrollContainerToBottomImmediate()
      updateStickToBottomFromScroll()
    })
  }, [scrollContainerToBottomImmediate, updateStickToBottomFromScroll])

  // Auto scroll to bottom when sending or other explicit follow actions
  const scrollToBottom = useCallback(() => {
    stickToBottomRef.current = true
    setShowJumpToLatest(false)
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }, [])

return { bottomPadding, setBottomPadding, bottomContainerRef, shouldForceScrollRef, scrollToBottomImmediateRef, messagesEndRef, messagesContainerRef, stickToBottomRef, showJumpToLatest, setShowJumpToLatest, wasLoadingLogsRef, wasLoadingPlansRef, updateStickToBottomFromScroll, scrollContainerToBottomImmediateRef, scrollContainerToBottomImmediate, scrollToBottomImmediateIfStuck, jumpToLatestLogs, scrollToBottom }
}

export function useMessageScrollEffects({ bottomPadding, setBottomPadding, bottomContainerRef, shouldForceScrollRef, scrollToBottomImmediateRef, messagesEndRef, messagesContainerRef, stickToBottomRef, showJumpToLatest, setShowJumpToLatest, wasLoadingLogsRef, wasLoadingPlansRef, updateStickToBottomFromScroll, scrollContainerToBottomImmediateRef, scrollContainerToBottomImmediate, scrollToBottomImmediateIfStuck, jumpToLatestLogs, scrollToBottom, activeRobotInstance, isLoadingLogs, isLoadingPlans, logs, hasMoreLogs, loadMoreLogs }: ReturnType<typeof useMessageScroll> & { activeRobotInstance: SimpleMessagesViewProps["activeRobotInstance"]; isLoadingLogs: boolean; isLoadingPlans: boolean; logs: InstanceLog[]; hasMoreLogs: boolean; loadMoreLogs: () => Promise<void> }) {
  useEffect(() => {
    if (!bottomContainerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use bounding client rect for more accurate total height
        const rect = (entry.target as HTMLElement).getBoundingClientRect()
        // If we are currently at the bottom, mark that we should force scroll after the padding updates
        if (stickToBottomRef.current) {
          shouldForceScrollRef.current = true
        }
        // Add 24px as extra buffer to ensure the last message is just above the input area and floating elements
        setBottomPadding(Math.max(60, rect.height + 24))
      }
    })
    
    const target = bottomContainerRef.current
    observer.observe(target)
    
    return () => observer.disconnect()
  }, [isLoadingLogs])

  useEffect(() => {
    // Re-scroll to bottom if the padding pushed content up and we were stuck to bottom before the change
    if (messagesContainerRef.current && (stickToBottomRef.current || shouldForceScrollRef.current)) {
      shouldForceScrollRef.current = false
      scrollContainerToBottomImmediateRef.current?.()
    }
  }, [bottomPadding])

  // When following the tail, keep pinned as new logs arrive (realtime). If the user scrolled up, do not move their view.
  useEffect(() => {
    const hasConversations = logs.length > 0
    const isInstanceRunning = activeRobotInstance && ['running', 'active'].includes(activeRobotInstance.status)

    if (!stickToBottomRef.current) return

    if (hasConversations || isInstanceRunning) {
      const timeoutId = setTimeout(() => {
        scrollContainerToBottomImmediate()
        updateStickToBottomFromScroll()
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [logs.length, activeRobotInstance?.id, activeRobotInstance?.status, scrollContainerToBottomImmediate, updateStickToBottomFromScroll])

  // After useInstanceLogs, we can define the scroll handler that uses hasMoreLogs
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    updateStickToBottomFromScroll()
    
    // Load more logs if near top
    const container = e.currentTarget
    if (container.scrollTop < 100 && hasMoreLogs) {
      const oldScrollHeight = container.scrollHeight
      const oldScrollTop = container.scrollTop

      loadMoreLogs().then(() => {
        // After prepending logs, adjust scrollTop so the view doesn't jump
        setTimeout(() => {
          if (messagesContainerRef.current) {
            const newScrollHeight = messagesContainerRef.current.scrollHeight
            const heightDiff = newScrollHeight - oldScrollHeight
            if (heightDiff > 0) {
              messagesContainerRef.current.scrollTop = oldScrollTop + heightDiff
            }
          }
        }, 50)
      })
    }
  }, [updateStickToBottomFromScroll, hasMoreLogs, loadMoreLogs])
  // After logs finish loading, snap to the bottom by default (container did not exist during skeleton).
  useLayoutEffect(() => {
    const finishedLoading = wasLoadingLogsRef.current && !isLoadingLogs
    wasLoadingLogsRef.current = isLoadingLogs

    if (!finishedLoading) return

    stickToBottomRef.current = true
    setShowJumpToLatest(false)

    const snapToTail = () => {
      scrollContainerToBottomImmediate()
      updateStickToBottomFromScroll()
    }

    snapToTail()
    const raf = requestAnimationFrame(snapToTail)
    const t0 = window.setTimeout(snapToTail, 0)
    const t1 = window.setTimeout(snapToTail, 120)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [isLoadingLogs, scrollContainerToBottomImmediate, updateStickToBottomFromScroll])

  // Plans load after logs; if the user is still following the tail, keep them pinned once the timeline height settles.
  useLayoutEffect(() => {
    const finishedPlans = wasLoadingPlansRef.current && !isLoadingPlans
    wasLoadingPlansRef.current = isLoadingPlans

    if (!finishedPlans || !stickToBottomRef.current) return

    const snapToTail = () => {
      scrollContainerToBottomImmediate()
      updateStickToBottomFromScroll()
    }
    snapToTail()
    const raf = requestAnimationFrame(snapToTail)
    return () => cancelAnimationFrame(raf)
  }, [isLoadingPlans, scrollContainerToBottomImmediate, updateStickToBottomFromScroll])

return { handleScroll }
}
