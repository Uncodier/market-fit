"use client"

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { cn } from "@/lib/utils"
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from '@/app/context/SiteContext'
import { useLayout } from '@/app/context/LayoutContext'
import { useIsMobile } from '@/app/hooks/use-mobile-view'
import { useToast } from '@/app/components/ui/use-toast'
import { useSearchParams, useRouter } from "next/navigation"
import { useRobots } from '@/app/context/RobotsContext'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useUserProfile } from './hooks/useUserProfile'
import { MessagesSkeleton } from "@/app/components/skeletons/messages-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { User, ChevronDown } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from './utils/markdownComponents'

// Import types
import { SimpleMessagesViewProps, InstanceLog, SelectedContextIds, ImageParameters, VideoParameters, AudioParameters, MessageAttachment } from './types'

// Import hooks
import { useInstanceLogs } from './hooks/useInstanceLogs'
import { useInstancePlans } from './hooks/useInstancePlans'
import { useRequirementStatus } from './hooks/useRequirementStatus'
import { useRobotInstance } from './hooks/useRobotInstance'
import { useMessageSending } from './hooks/useMessageSending'
import { useStepManagement } from './hooks/useStepManagement'
import { useBacklogManagement } from './hooks/useBacklogManagement'
import { useInstanceAssets } from './hooks/useInstanceAssets'

// Import components
import { LoadingIndicator } from './components/LoadingIndicator'
import { EmptyStateOrbs } from './components/EmptyStateOrbs'
import { MessageInput } from './components/MessageInput'
import { MessageItem } from './components/MessageItem'
import { ProcessGroupItem } from './components/ProcessGroupItem'
import { CompletedPlanCard } from './components/CompletedPlanCard'
import { RequirementStatusCard } from './components/RequirementStatusCard'
import { StepIndicator } from './components/StepIndicator'
import { BacklogIndicator } from './components/BacklogIndicator'
import { EditStepModal } from './components/EditStepModal'
import { EditPlanModal } from './components/EditPlanModal'
import { EditBacklogModal } from './components/EditBacklogModal'
import { EditPendingWorkModal } from './components/EditPendingWorkModal'
import { StepCompletedItem } from './components/StepCompletedItem'
import { ArtifactShownItem } from './components/ArtifactShownItem'
import { EmptyStatePrompts } from './components/EmptyStatePrompts'
import { UserWorkflowMeta } from './components/UserWorkflowMeta'
import { CommandQueueBar } from './components/CommandQueueBar'
import { usePendingWork } from './hooks/usePendingWork'
import { useRunningWorkflow } from './hooks/useRunningWorkflow'

// Import utilities
import { groupTimelineProcess, isProcessGroupLive } from './group-timeline-process'

const SCROLL_BOTTOM_THRESHOLD_PX = 80

export function SimpleMessagesView({ className = "", activeRobotInstance, isBrowserVisible = false, onMessageSent, onNewInstanceCreated, hasTopHeaderSpace = true }: SimpleMessagesViewProps) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refreshRobots } = useRobots()
  
  // Use active instance ID for cache key, or 'new' if no instance
  const chatCacheKey = activeRobotInstance?.id ? `chat-${activeRobotInstance.id}` : 'chat-new'
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState("", chatCacheKey)
  
  const { user } = useAuthContext()
  const { userProfile } = useUserProfile(user?.id)
  

  // Reset state when site changes, but carefully preserve cache behavior
  // Note: We deliberately do NOT call clearMessage() here anymore to avoid 
  // wiping the localStorage cache during initial mount or harmless re-renders.
  useEffect(() => {
    // Only reset context/UI states when site ID actually changes
    if (currentSite?.id) {
      // Reset selected context when site changes
      setSelectedContext({
        leads: [],
        contents: [],
        requirements: [],
        tasks: [],
        campaigns: [],
        quotations: [],
        deals: [],
        records: []
      })
      
      // Reset activity selection
      setSelectedActivity('ask')
      
      // Reset step indicator
      setIsStepIndicatorExpanded(false)
      
      // Clear recent user message IDs
      setRecentUserMessageIds(new Set())
      setLastUserMessage('')
      
      // We don't call clearMessage() here anymore to preserve cache
    }
  }, [currentSite?.id])
  
  // Create a RefObject for MessageInput compatibility
  const messageInputTextareaRef = useRef<HTMLTextAreaElement>(null) as React.RefObject<HTMLTextAreaElement>
  
  // State for UI
  const [selectedContext, setSelectedContext] = useState<SelectedContextIds>({
    leads: [],
    contents: [],
    requirements: [],
    tasks: [],
    campaigns: [],
    quotations: [],
    deals: [],
    records: []
  })
  const [selectedActivity, setSelectedActivity] = useState<string>('ask')
  const [isStepIndicatorExpanded, setIsStepIndicatorExpanded] = useState(false)
  const [isBacklogIndicatorExpanded, setIsBacklogIndicatorExpanded] = useState(false)
  const [bottomPadding, setBottomPadding] = useState(180)
  const bottomContainerRef = useRef<HTMLDivElement>(null)

  const [isEditPendingModalOpen, setIsEditPendingModalOpen] = useState(false)
  const [editPendingId, setEditPendingId] = useState('')
  const [editPendingMessage, setEditPendingMessage] = useState('')

  const shouldForceScrollRef = useRef(false)

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
        // Add 80px as extra buffer to ensure the last message is well above the input area
        setBottomPadding(Math.max(180, rect.height + 80))
      }
    })
    observer.observe(bottomContainerRef.current)
    
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Re-scroll to bottom if the padding pushed content up and we were stuck to bottom before the change
    if (messagesContainerRef.current && (stickToBottomRef.current || shouldForceScrollRef.current)) {
      shouldForceScrollRef.current = false
      scrollContainerToBottomImmediateRef.current?.()
    }
  }, [bottomPadding])
  const scrollToBottomImmediateRef = useRef<(() => void) | null>(null)

  const [recentUserMessageIds, setRecentUserMessageIds] = useState<Set<string>>(new Set())
  const [lastUserMessage, setLastUserMessage] = useState<string>('')
  
  // Media parameters state
  const [imageParameters, setImageParameters] = useState<ImageParameters>({
    format: 'PNG',
    aspectRatio: '1:1',
    quality: 85 // High quality by default
  })
  const [videoParameters, setVideoParameters] = useState<VideoParameters>({
    aspectRatio: '16:9',
    resolution: '1080p',
    duration: 6
  })
  const [audioParameters, setAudioParameters] = useState<AudioParameters>({
    format: 'MP3',
    sampleRate: '44.1kHz',
    channels: 'stereo',
    duration: 15
  })
  
  
  // Memoize the setRecentUserMessageIds function to prevent infinite loops
  const handleSetRecentUserMessageIds = useCallback((ids: Set<string>) => {
    setRecentUserMessageIds(ids)
  }, [])
  
  // Media parameter change handlers
  const handleImageParameterChange = useCallback((key: keyof ImageParameters, value: any) => {
    setImageParameters(prev => ({ ...prev, [key]: value }))
  }, [])
  
  const handleVideoParameterChange = useCallback((key: keyof VideoParameters, value: any) => {
    setVideoParameters(prev => ({ ...prev, [key]: value }))
  }, [])
  
  const handleAudioParameterChange = useCallback((key: keyof AudioParameters, value: any) => {
    setAudioParameters(prev => ({ ...prev, [key]: value }))
  }, [])
  
  
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


  // Handle message sent - capture from the live ref before the composer is cleared
  const handleMessageSent = useCallback((sent: boolean) => {
    if (sent) {
      const typed = messageRef.current
      if (typed) setLastUserMessage(typed)
      window.setTimeout(() => scrollToBottom(), 80)
    }
    onMessageSent?.(sent)
  }, [onMessageSent, scrollToBottom])

  // Ref to store the reset function to avoid circular dependency
  const resetMessageSentStateRef = useRef<(() => void) | null>(null)

  // Handle new instance creation - defined before hook initialization
  const handleNewInstanceCreated = useCallback(async (instanceId: string, shouldNavigate: boolean = true) => {
    
    // Clear the temporary user message since we now have a real instance
    setLastUserMessage('')
    
    // Refresh the robots list to pick up the new instance
    await refreshRobots()
    
    if (shouldNavigate) {
      // Navigate to the new instance (original behavior)
      const params = new URLSearchParams(searchParams.toString())
      params.set('instance', instanceId)
      router.push(`/robots?${params.toString()}`)
      
      // Reset message sent state AFTER navigation to avoid visual refresh
      // Use setTimeout to ensure this happens after the navigation is complete
      setTimeout(() => {
        if (resetMessageSentStateRef.current) {
          resetMessageSentStateRef.current()
        }
      }, 100)
    } else {
      // New behavior: just refresh robots, let parent component handle tab conversion
      
      // Notify parent component to convert the tab immediately
      onNewInstanceCreated?.(instanceId)
      
      // Reset message sent state immediately since we're not navigating
      setTimeout(() => {
        if (resetMessageSentStateRef.current) {
          resetMessageSentStateRef.current()
        }
      }, 100)
    }
  }, [refreshRobots, searchParams, router])

  // Create ref for clearNewMakinaThinking function
  const clearNewMakinaThinkingRef = useRef<(() => void) | null>(null)
  
  // Create ref for addOptimisticUserMessage function
  const addOptimisticUserMessageRef = useRef<((
    message: string,
    extraDetails?: Record<string, unknown>
  ) => void) | null>(null)
  const instanceLogsRef = useRef<InstanceLog[]>([])
  const reloadPendingWorkRef = useRef<() => void>(() => {})

  const {
    isStartingRobot,
    setIsStartingRobot,
    queuedMessageRef,
    startTimeoutRef,
    startInstancePolling
  } = useRobotInstance({
    onClearNewMakinaThinking: () => clearNewMakinaThinkingRef.current?.(),
    onScrollToBottom: scrollToBottom
  })

  const {
    isSendingMessage,
    setIsSendingMessage,
    isWaitingForResponse,
    isNewMakinaThinking,
    hasMessageBeenSent,
    waitingForMessageId,
    handleSendMessage,
    handleAssistantMessage,
    clearThinkingState,
    setNewMakinaThinking,
    clearNewMakinaThinking,
    setThinkingStateWithTimeout,
    resetMessageSentState
  } = useMessageSending({
    activeRobotInstance,
    selectedActivity,
    selectedContext,
    messageRef,
    logsRef: instanceLogsRef,
    onMessageSent: handleMessageSent,
    onClearMessage: clearMessage,
    onScrollToBottom: scrollToBottom,
    onNewInstanceCreated: handleNewInstanceCreated,
    startInstancePolling,
    onAddOptimisticMessage: (message: string, extraDetails?: Record<string, unknown>) => addOptimisticUserMessageRef.current?.(message, extraDetails || {
      status: 'running',
      request_type: selectedActivity,
      context: selectedContext,
    }),
    onPendingEnqueued: () => reloadPendingWorkRef.current(),
    imageParameters,
    videoParameters,
    audioParameters
  })

  const {
    logs,
    isLoadingLogs,
    isLoadingMore,
    hasMoreLogs,
    collapsedSystemMessages,
    collapsedToolDetails,
    expandedToolGroups,
    loadInstanceLogs,
    loadMoreLogs,
    addOptimisticUserMessage,
    patchLogDetails,
    toggleSystemMessageCollapse,
    toggleAllSystemMessages,
    toggleToolDetails,
    toggleToolGroup,
    toggleAllToolDetails
  } = useInstanceLogs({
    activeRobotInstance,
    waitingForMessageId,
    onScrollToBottom: scrollToBottom,
    onScrollToBottomImmediate: scrollToBottomImmediateIfStuck,
    onResponseReceived: clearThinkingState,
    currentSiteId: currentSite?.id
  })

  instanceLogsRef.current = logs

  // Update the ref with the real function
  useEffect(() => {
    clearNewMakinaThinkingRef.current = clearNewMakinaThinking
  }, [clearNewMakinaThinking])

  // Store addOptimisticUserMessage in ref so it can be accessed from useMessageSending
  useEffect(() => {
    addOptimisticUserMessageRef.current = addOptimisticUserMessage
  }, [addOptimisticUserMessage])

  // Store resetMessageSentState in ref so it can be accessed from handleNewInstanceCreated
  useEffect(() => {
    resetMessageSentStateRef.current = resetMessageSentState
  }, [resetMessageSentState])

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

  const {
    steps,
    instancePlans,
    completedPlans,
    isLoadingPlans,
    loadInstancePlans,
    getCurrentStep,
    areAllStepsCompleted,
    createUnifiedTimeline
  } = useInstancePlans({
    activeRobotInstance
  })

  const {
    requirementStatuses,
    loadStatuses: loadRequirementStatuses
  } = useRequirementStatus(activeRobotInstance)

  const latestRequirementStatus = requirementStatuses.length > 0 ? requirementStatuses[requirementStatuses.length - 1] : null
  const rawRequirements = latestRequirementStatus?.requirements
  const sourceBacklog = (activeRobotInstance as any)?.requirement_backlog ||
    (Array.isArray(rawRequirements) ? rawRequirements[0]?.backlog : rawRequirements?.backlog)

  const {
    requirementBacklog,
    isEditBacklogModalOpen,
    editBacklogTitle,
    setEditBacklogTitle,
    openEditBacklogModal,
    closeEditBacklogModal,
    saveBacklogItem,
  } = useBacklogManagement({
    activeRobotInstance,
    requirementIdFromStatus:
      latestRequirementStatus?.requirement_id ||
      (Array.isArray(rawRequirements) ? rawRequirements[0]?.id : rawRequirements?.id),
    sourceBacklog,
  })

  const {
    isEditModalOpen,
    editingStep,
    editTitle,
    editDescription,
    setEditTitle,
    setEditDescription,
    openEditModal,
    closeEditModal,
    saveStep,
    deleteStep,
    toggleStepStatus,
    pausePlan,
    resumePlan,
    cancelPlan,
    canEditOrDeleteStep,
    addStep,
    isEditPlanModalOpen,
    editPlanTitle,
    editPlanDescription,
    setEditPlanTitle,
    setEditPlanDescription,
    openEditPlanModal,
    closeEditPlanModal,
    savePlan
  } = useStepManagement({
    activeRobotInstance,
    steps,
    instancePlans,
    onSetSteps: () => {}
  })

  const {
    assets,
    isLoading: isLoadingAssets,
    deleteAsset
  } = useInstanceAssets({
    instanceId: activeRobotInstance?.id
  })

  const { runningUserLog, cancelWorkflow, isCancelling } = useRunningWorkflow({
    logs,
    instanceId: activeRobotInstance?.id,
    patchLogDetails,
    toast,
  })

  const { pendingWork, removePending, editPending, sendNow, sendingId, reloadPendingWork } = usePendingWork(activeRobotInstance?.id)
  reloadPendingWorkRef.current = reloadPendingWork

  // Timeline is now created inline in the render to ensure proper chronological order

  // Sync selectedActivity to URL params for explorer view control
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (selectedActivity === 'robot' && params.get('activity') !== 'robot') {
      params.set('activity', 'robot')
      router.replace(`/robots?${params.toString()}`, { scroll: false })
    } else if (selectedActivity !== 'robot' && params.get('activity') === 'robot') {
      params.delete('activity')
      router.replace(`/robots?${params.toString()}`, { scroll: false })
    }
  }, [selectedActivity, router])

  // Use refs for message handlers to avoid stale closures in event listeners
  const setMessageRef = useRef(setMessage);
  const handleSendMessageRef = useRef(handleSendMessage);
  
  useEffect(() => {
    setMessageRef.current = setMessage;
    handleSendMessageRef.current = handleSendMessage;
  }, [setMessage, handleSendMessage]);

  // Custom event listener for external components to send messages
  useEffect(() => {
    const handleRobotSendMessage = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      if (customEvent.detail && customEvent.detail.text) {
        setMessageRef.current(customEvent.detail.text);
        setTimeout(() => {
          handleSendMessageRef.current();
        }, 100);
      }
    };
    
    const handleRobotSendQueryFromUrl = (event: Event) => {
      const customEvent = event as CustomEvent<{ query: string }>;
      if (customEvent.detail && customEvent.detail.query) {
        // Change the query into the standard format if it's the specific format from the prompt, 
        // to avoid infinite loops and give the input component time to mount
        const queryText = customEvent.detail.query;
        
        // Use a slight delay to ensure UI is ready
        setTimeout(() => {
          setMessageRef.current(queryText);
          
          // Small delay before firing submit so React can update the textarea
          setTimeout(() => {
            handleSendMessageRef.current();
          }, 300);
        }, 300);
      }
    };
    
    window.addEventListener('robot:send-message', handleRobotSendMessage);
    window.addEventListener('robot:send-query-from-url', handleRobotSendQueryFromUrl);
    
    return () => {
      window.removeEventListener('robot:send-message', handleRobotSendMessage);
      window.removeEventListener('robot:send-query-from-url', handleRobotSendQueryFromUrl);
    };
  }, []); // Empty deps since we use refs for the callbacks

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

  // Show loading skeleton when loading logs
  if (isLoadingLogs) {
    return (
      <MessagesSkeleton 
        showComposerSkeleton={false} 
        hasTopHeaderSpace={hasTopHeaderSpace} 
        className={cn("flex flex-col w-full min-w-0 h-full min-h-0", className, !className?.includes('absolute') && "relative")}
        isBrowserVisible={isBrowserVisible}
      />
    )
  }

  // Calculate if chat is empty
  const shouldShowNewMakina = !activeRobotInstance || !activeRobotInstance.id || (activeRobotInstance.status === 'pending' && logs.length === 0)
  const isEmptyNewMakina = shouldShowNewMakina && !hasMessageBeenSent && !lastUserMessage && !isNewMakinaThinking
  
  // Calculate timeline for Explorer view
  const timelineItems: Array<{
    type: 'log' | 'completed_plan' | 'requirement_status'
    timestamp: string
    data: any
  }> = []

  // Add only the most recent requirement status (same behavior as last plan)
  if (requirementStatuses && requirementStatuses.length > 0) {
    const latestStatus = requirementStatuses.reduce((latest, current) => {
      const latestTime = new Date(latest.created_at).getTime()
      const currentTime = new Date(current.created_at).getTime()
      return currentTime > latestTime ? current : latest
    }, requirementStatuses[0])

    // Find the most recent source_code, preview_url, and repo_url
    let latestSourceCode = null;
    let latestPreviewUrl = null;
    let latestRepoUrl = null;

    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (!latestSourceCode && status.source_code) latestSourceCode = status.source_code;
      if (!latestPreviewUrl && status.preview_url) latestPreviewUrl = status.preview_url;
      if (!latestRepoUrl && status.repo_url) latestRepoUrl = status.repo_url;
    }

    timelineItems.push({
      type: 'requirement_status',
      timestamp: latestStatus.created_at,
      data: {
        ...latestStatus,
        source_code: latestSourceCode,
        preview_url: latestPreviewUrl,
        repo_url: latestRepoUrl
      }
    })
  }
  
  logs.forEach(log => {
    timelineItems.push({
      type: 'log',
      timestamp: log.created_at,
      data: log
    })
  })
  
  // Collect all candidate plans (historical + active) with their display timestamp,
  // then only keep the most recent one (same behavior as requirement_status).
  const candidatePlans: Array<{ timestamp: string; data: any }> = []
  const addedPlanIds = new Set<string>()

  // 1. Real historical plans (completed, failed, cancelled)
  completedPlans.forEach(plan => {
    if (addedPlanIds.has(plan.id)) return
    addedPlanIds.add(plan.id)

    const timestamp = plan.completed_at || plan.updated_at || plan.created_at
    candidatePlans.push({ timestamp, data: plan })
  })

  // 2. Active plans (pending, in_progress, etc.)
  instancePlans.forEach(plan => {
    if (addedPlanIds.has(plan.id)) return
    addedPlanIds.add(plan.id)

    const isAllStepsCompleted = areAllStepsCompleted() && steps.some(s => s.planId === plan.id || !s.planId)

    if (isAllStepsCompleted) {
      const timestamp = plan.updated_at || plan.created_at || new Date().toISOString()
      candidatePlans.push({
        timestamp,
        data: {
          ...plan,
          status: 'completed',
          steps: steps.filter(s => s.planId === plan.id || !s.planId)
        }
      })
    } else {
      candidatePlans.push({ timestamp: plan.created_at, data: plan })
    }
  })

  if (candidatePlans.length > 0) {
    const latestPlan = candidatePlans.reduce((latest, current) => {
      const latestTime = new Date(latest.timestamp).getTime()
      const currentTime = new Date(current.timestamp).getTime()
      return currentTime > latestTime ? current : latest
    }, candidatePlans[0])

    timelineItems.push({
      type: 'completed_plan',
      timestamp: latestPlan.timestamp,
      data: latestPlan.data
    })
  }
  
  const sortedTimeline = timelineItems.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    
    if (timeA === timeB) {
      // Tie-breaker: logs come before plans at the same timestamp
      if (a.type === 'log' && b.type === 'completed_plan') return -1
      if (a.type === 'completed_plan' && b.type === 'log') return 1
    }
    
    return timeA - timeB
  })

  const processedTimeline = groupTimelineProcess(sortedTimeline)
  const lastProcessGroupId = [...processedTimeline]
    .reverse()
    .find((item) => item.type === 'process_group')
    ?.data?.groupId

  // Explorer is empty only if there's no timeline (instance running or not doesn't matter for the chat state)
  const isEmptyExplorer = !shouldShowNewMakina && sortedTimeline.length === 0
  const isEmpty = isEmptyNewMakina || isEmptyExplorer

  const allStepsCompleted = areAllStepsCompleted()
  const showFloatingPlanAppendix =
    assets.length > 0 || (steps.length > 0 && !allStepsCompleted)
  const showPinnedRunningBubble = Boolean(runningUserLog && showJumpToLatest)
    
  let backlogHasItems = false;
  if (requirementBacklog) {
    if (typeof requirementBacklog === 'string') backlogHasItems = requirementBacklog.length > 10;
    else backlogHasItems = !!requirementBacklog.items && requirementBacklog.items.length > 0;
  }
  const showFloatingBacklog = backlogHasItems;

  return (
    <div className={cn("flex flex-col w-full min-w-0 h-full min-h-0", className, !className?.includes('absolute') && "relative")}>
      {/* Floating background orbs - removed per user request */}

      {/* Messages list */}
      <div
        ref={messagesContainerRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto overflow-x-hidden w-full min-w-0 transition-colors duration-300 ease-in-out",
        )}
        style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        onScroll={handleScroll}
      >
        <div 
          className="w-full max-w-4xl mx-auto px-4 min-w-0 transition-[padding-bottom] duration-300 ease-in-out"
          style={{ paddingBottom: isEmpty ? 0 : `${bottomPadding}px` }}
        >
          {/* Spacer for sticky header and topbar blur effect */}
          <div className={cn("h-[135px] shrink-0", !hasTopHeaderSpace && "hidden lg:block")} aria-hidden="true" />
          <div className="space-y-6 pt-6 pb-6">
          
          {/* Loading indicator when fetching older logs */}
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <LoadingIndicator isVisible={true} isDarkMode={isDarkMode} />
            </div>
          )}
          
        {(() => {
          if (shouldShowNewMakina) {
            return (
          // New Makina context - show user messages and thinking state
          <>
            {/* Show user message if one was sent */}
            {hasMessageBeenSent && lastUserMessage && (
              <div className="flex flex-col w-full min-w-0 items-end group">
                <div className="flex items-center mb-1 gap-2 justify-end">
                  <span className="text-xs text-muted-foreground">
                    {new Date().toLocaleTimeString()}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {userProfile?.name || 'User'}
                  </span>
                  <div className="relative">
                    <Avatar className="h-7 w-7 border border-primary/20">
                      {userProfile?.avatar_url && (
                        <AvatarImage 
                          src={userProfile.avatar_url} 
                          alt={userProfile.name || 'User'} 
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {userProfile?.name 
                          ? userProfile.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
                          : <User className="h-4 w-4" />
                        }
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                
                <div className="w-full min-w-0 overflow-hidden flex justify-end pr-8">
                  <div className="min-w-0 overflow-hidden">
                    <div 
                      className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words rounded-lg p-4 mr-12" 
                      style={{ 
                        backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
                        border: 'none', 
                        boxShadow: 'none', 
                        outline: 'none',
                        filter: 'none',
                        wordWrap: 'break-word', 
                        overflowWrap: 'break-word', 
                        wordBreak: 'break-word'
                      }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {lastUserMessage}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show thinking indicator using existing LoadingIndicator component */}
            <LoadingIndicator isVisible={isNewMakinaThinking} isDarkMode={isDarkMode} />
          </>
            )
          } else {
            return (
            <>
            {/* Create unified timeline of logs and completed plans */}
            {(() => {
              if (processedTimeline.length === 0) {
                return null
              }
              

              return processedTimeline.map((item, index) => {
                let dateHeader = null;
                const currentDate = new Date(item.timestamp);
                const currentDateStr = currentDate.toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                });
                
                const prevDateStr = index > 0 
                  ? new Date(processedTimeline[index - 1].timestamp).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : null;

                if (prevDateStr !== currentDateStr) {
                  dateHeader = (
                    <div key={`date-${currentDateStr}-${index}`} className="flex justify-center my-6">
                      <span className="text-xs font-medium text-muted-foreground/60 bg-muted/50 px-3 py-1 rounded-full uppercase tracking-wider">
                        {currentDateStr}
                      </span>
                    </div>
                  );
                }

                let content = null;

                if (item.type === 'process_group') {
                  const group = item.data
                  content = (
                    <ProcessGroupItem
                      key={group.groupId}
                      group={group}
                      isDarkMode={isDarkMode}
                      isExpanded={expandedToolGroups.has(group.groupId)}
                      isLive={group.groupId === lastProcessGroupId && isProcessGroupLive(group)}
                      onToggleExpand={toggleToolGroup}
                      collapsedToolDetails={collapsedToolDetails}
                      onToggleToolDetails={toggleToolDetails}
                      isBrowserVisible={isBrowserVisible}
                      onEditPlan={openEditPlanModal}
                    />
                  )
                } else if (item.type === 'log') {
                  const log = item.data
                  const toolNameLower = (log.tool_name || log.toolName)?.toLowerCase()
                  const isStructuredOutput = toolNameLower === 'structured_output'
                  const isShowArtifact = toolNameLower === 'show_artifact'
                  const isStepCompleted = isStructuredOutput && log.message?.includes('event=step_completed')
                  
                  if (isStepCompleted) {
                    content = (
                      <StepCompletedItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                      />
                    )
                  } else if (isShowArtifact) {
                    if (log.log_type === 'tool_result') {
                      return null // Ignore tool_result since we already render the tool_call
                    }
                    content = (
                      <ArtifactShownItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                        isBrowserVisible={isBrowserVisible}
                      />
                    )
                  } else {
                    content = (
                      <MessageItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                        collapsedSystemMessages={collapsedSystemMessages}
                        onToggleSystemMessageCollapse={toggleSystemMessageCollapse}
                        isBrowserVisible={isBrowserVisible}
                        onCancelWorkflow={cancelWorkflow}
                        isCancellingWorkflow={isCancelling}
                      />
                    )
                  }
                } else if (item.type === 'completed_plan') {
                  content = (
                    <CompletedPlanCard 
                      key={`plan-${item.data.id}`}
                      plan={item.data}
                      onEditPlan={openEditPlanModal}
                    />
                  )
                } else if (item.type === 'requirement_status') {
                  content = (
                    <RequirementStatusCard 
                      key={`req-status-${item.data.id}`}
                      status={item.data}
                    />
                  )
                }

                if (!content) return null;

                return (
                  <React.Fragment key={`timeline-item-${index}`}>
                    {dateHeader}
                    {content}
                  </React.Fragment>
                );
              })
            })()}
            
            {/* Loading indicator when waiting for response */}
            <LoadingIndicator 
              isVisible={isWaitingForResponse || isNewMakinaThinking}
              isDarkMode={isDarkMode}
            />
          </>
            )
          }
        })()}
        
        {/* Extra padding to avoid floating step indicator overlap */}
        <div className="pb-2"></div>
        
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
        </div>
        </div>
      </div>

      {/* Message input - centered when empty, fixed at bottom when has content - animates between states */}
      <div 
        className={cn(
          "absolute right-0 left-0 bottom-0 z-20 pointer-events-none flex flex-col items-center transition-all duration-500 ease-in-out chat-input-container !bg-transparent",
          // Inset top by TopBar (64px) + StickyHeader (min 71px) so empty-state input + prompts center in the visible pane, not under fixed headers
          isEmpty ? "top-[calc(var(--topbar-height,64px)+71px)] justify-center pb-[10vh]" : "top-auto justify-end pb-[15px]"
        )}
        style={{
          width: '100%',
          maxWidth: '100%'
        }}
      >
        {/* Background that only appears when not empty, at the bottom */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background/90 to-transparent transition-all duration-500 pointer-events-none",
            isEmpty ? "opacity-0 h-32" : "opacity-100",
            (isStepIndicatorExpanded || isBacklogIndicatorExpanded) ? "h-64" : "h-32"
          )}
        />
        <div 
          ref={bottomContainerRef}
          className={cn(
            "w-full max-w-[800px] px-4 pointer-events-auto relative z-10 !bg-transparent !p-0 mx-auto transition-all duration-300",
            isEmpty ? "flex flex-col gap-3 -mt-12" : "flex flex-col w-full gap-2"
          )}
        >
        {showJumpToLatest && !isEmpty && (
          <div className="flex w-full shrink-0 justify-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shadow-md gap-1.5 rounded-full border border-border/80 bg-background/95 backdrop-blur-sm"
              onClick={jumpToLatestLogs}
              aria-label="Jump to latest log"
            >
              <ChevronDown size={16} className="opacity-80" aria-hidden />
              Latest
            </Button>
          </div>
        )}
        {/* Floating Backlog Indicator - Expandable */}
        {showFloatingBacklog && (
          <div className="w-full relative pointer-events-auto">
            <BacklogIndicator
              backlog={requirementBacklog}
              expanded={isBacklogIndicatorExpanded}
              onToggleExpanded={() => setIsBacklogIndicatorExpanded(!isBacklogIndicatorExpanded)}
              onEditItem={openEditBacklogModal}
            />
          </div>
        )}
        {/* Floating Step Indicator - Expandable */}
        {showFloatingPlanAppendix && (
          <div className="w-full relative pointer-events-auto">
            <StepIndicator
              steps={steps}
              instancePlans={instancePlans}
              currentStep={getCurrentStep()}
              allCompleted={allStepsCompleted}
              expanded={isStepIndicatorExpanded}
              onToggleExpanded={() => setIsStepIndicatorExpanded(!isStepIndicatorExpanded)}
              onTogglePause={(planId: string) => {
                pausePlan(planId)
              }}
              onToggleResume={(planId: string) => {
                resumePlan(planId)
              }}
              onCancelPlan={(planId: string) => {
                cancelPlan(planId)
              }}
              onEditPlan={openEditPlanModal}
              onEditStep={openEditModal}
              onDeleteStep={deleteStep}
              onToggleStepStatus={toggleStepStatus}
              canEditOrDeleteStep={canEditOrDeleteStep}
              assets={assets}
              onDeleteAsset={deleteAsset}
              isBrowserVisible={isBrowserVisible}
            />
          </div>
        )}
        <CommandQueueBar
          items={pendingWork}
          onRemove={removePending}
          onEdit={(item) => {
            setEditPendingId(item.id)
            setEditPendingMessage(item.message)
            setIsEditPendingModalOpen(true)
          }}
          onSendNow={sendNow}
          sendingId={sendingId}
        />
        {showPinnedRunningBubble && runningUserLog && (
          <div className="w-full relative pointer-events-auto">
            <div className="mx-auto max-w-[800px] rounded-2xl border border-border/80 bg-background/95 px-4 py-3 shadow-sm">
              <p className="text-sm text-foreground line-clamp-2 break-words">{runningUserLog.message}</p>
              <UserWorkflowMeta
                log={runningUserLog}
                onCancel={cancelWorkflow}
                isCancelling={isCancelling}
              />
            </div>
          </div>
        )}
        {/* Prompt suggestion carousel - shown only when chat is empty, fades out when content appears */}
        {isEmpty && (
          <div className="w-full animate-in fade-in duration-500 delay-300 mx-auto max-w-[800px] overflow-hidden">
            <EmptyStatePrompts
              onSelectPrompt={(prompt) => {
                setMessage(prompt)
                setTimeout(() => textareaRef.current?.focus(), 0)
              }}
            />
          </div>
        )}
        <MessageInput
          message={message}
          selectedActivity={selectedActivity}
          selectedContext={selectedContext}
          onMessageChange={setMessage}
          handleMessageChange={handleMessageChange}
          onActivityChange={setSelectedActivity}
          onContextChange={setSelectedContext}
          onSubmit={handleSendMessage}
          disabled={isStartingRobot}
          placeholder={activeRobotInstance ? (runningUserLog ? "Queued until the current command finishes..." : "How can I help you today?") : (isStartingRobot ? "Starting agent..." : "How can I help you today?")}
          textareaRef={textareaRef}
          imageParameters={imageParameters}
          videoParameters={videoParameters}
          audioParameters={audioParameters}
          onImageParameterChange={handleImageParameterChange}
          onVideoParameterChange={handleVideoParameterChange}
          onAudioParameterChange={handleAudioParameterChange}
          activeRobotInstance={activeRobotInstance}
          isBrowserVisible={isBrowserVisible}
        />
        </div>
      </div>

      {/* Edit Step Modal */}
      <EditStepModal
        open={isEditModalOpen}
        title={editTitle}
        description={editDescription}
        onTitleChange={setEditTitle}
        onDescriptionChange={setEditDescription}
        onSave={saveStep}
        onClose={closeEditModal}
      />

      {/* Edit Plan Modal */}
      <EditPlanModal
        open={isEditPlanModalOpen}
        title={editPlanTitle}
        description={editPlanDescription}
        onTitleChange={setEditPlanTitle}
        onDescriptionChange={setEditPlanDescription}
        onSave={savePlan}
        onClose={closeEditPlanModal}
      />

      {/* Edit Backlog Item Modal */}
      <EditBacklogModal
        open={isEditBacklogModalOpen}
        title={editBacklogTitle}
        onTitleChange={setEditBacklogTitle}
        onSave={saveBacklogItem}
        onClose={closeEditBacklogModal}
      />

      {/* Edit Pending Work Modal */}
      <EditPendingWorkModal
        open={isEditPendingModalOpen}
        message={editPendingMessage}
        onMessageChange={setEditPendingMessage}
        onSave={() => {
          editPending(editPendingId, editPendingMessage)
          setIsEditPendingModalOpen(false)
        }}
        onClose={() => setIsEditPendingModalOpen(false)}
      />
    </div>
  )
}
