"use client"

import { useExternalMessageEvents } from "./use-external-message-events"
import { buildMessageTimeline } from "./message-timeline"
import { useMessageScroll, useMessageScrollEffects } from "./use-message-scroll"

import React, { useState, useRef, useEffect, useCallback } from 'react'

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

// Import types
import { SimpleMessagesViewProps, InstanceLog, SelectedContextIds, ImageParameters, VideoParameters, AudioParameters } from './types'
import { applyVideoParameterChange } from './media-parameter-normalization'

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

import { type SkillSelection } from './components/SkillSelector'

import { usePendingWork } from './hooks/usePendingWork'
import { useRunningWorkflow } from './hooks/useRunningWorkflow'

// Import utilities

const SCROLL_BOTTOM_THRESHOLD_PX = 80

export function useSimpleMessagesView({ className = "", activeRobotInstance, isBrowserVisible = false, onMessageSent, onNewInstanceCreated, hasTopHeaderSpace = true }: SimpleMessagesViewProps) {
  const [skillSelection, setSkillSelection] = useState<SkillSelection>({ skill_mode: 'auto', skill_slugs: [] })
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  useEffect(() => { setSkillSelection({ skill_mode: 'auto', skill_slugs: [] }) }, [currentSite?.id])
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

  const [isEditPendingModalOpen, setIsEditPendingModalOpen] = useState(false)
  const [editPendingId, setEditPendingId] = useState('')
  const [editPendingMessage, setEditPendingMessage] = useState('')

  const [recentUserMessageIds, setRecentUserMessageIds] = useState<Set<string>>(new Set())
  const [lastUserMessage, setLastUserMessage] = useState<string>('')
  
  // Media parameters state
  const [imageParameters, setImageParameters] = useState<ImageParameters>({
    format: 'PNG',
    aspectRatio: '1:1',
    quality: 'hd'
  })
  const [videoParameters, setVideoParameters] = useState<VideoParameters>({
    aspectRatio: '16:9',
    resolution: '720p',
    duration: 6
  })
  const [audioParameters, setAudioParameters] = useState<AudioParameters>({
    format: 'MP3'
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
    setVideoParameters(prev => applyVideoParameterChange(prev, key, value))
  }, [])
  
  const handleAudioParameterChange = useCallback((key: keyof AudioParameters, value: any) => {
    setAudioParameters(prev => ({ ...prev, [key]: value }))
  }, [])
  
  
  const scroll = useMessageScroll(activeRobotInstance, setIsStepIndicatorExpanded)
  const { messagesEndRef, messagesContainerRef, bottomContainerRef, bottomPadding, scrollToBottom, scrollToBottomImmediateIfStuck, scrollToBottomImmediateRef, jumpToLatestLogs, showJumpToLatest } = scroll

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
    skillSelection,
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

  const isInstanceStarting = !!(activeRobotInstance && ['starting','pending','initializing'].includes((activeRobotInstance as any).status))
  const isInstanceRunning = !!(activeRobotInstance && ['running','active'].includes((activeRobotInstance as any).status))
  const isInstancePausedOrUninstantiated = !!(activeRobotInstance && ['paused','pending'].includes((activeRobotInstance as any).status))

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

  useExternalMessageEvents(setMessage, handleSendMessage)

  const { handleScroll } = useMessageScrollEffects({ ...scroll, activeRobotInstance, isLoadingLogs, isLoadingPlans, isLoadingMore, logs, hasMoreLogs, loadMoreLogs })

  // Calculate if chat is empty
  const shouldShowNewMakina = !activeRobotInstance || !activeRobotInstance.id || (activeRobotInstance.status === 'pending' && logs.length === 0)
  const isEmptyNewMakina = shouldShowNewMakina && !hasMessageBeenSent && !lastUserMessage && !isNewMakinaThinking
  
  const { sortedTimeline, processedTimeline, lastProcessGroupId } = buildMessageTimeline(logs, completedPlans, instancePlans, steps, areAllStepsCompleted)

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

  return {
    className, activeRobotInstance, isBrowserVisible, hasTopHeaderSpace, skillSelection,
    setSkillSelection, isDarkMode, message, setMessage, handleMessageChange,
    textareaRef, userProfile, selectedContext, setSelectedContext, selectedActivity,
    setSelectedActivity, isStepIndicatorExpanded, setIsStepIndicatorExpanded, isBacklogIndicatorExpanded, setIsBacklogIndicatorExpanded,
    isEditPendingModalOpen, setIsEditPendingModalOpen, editPendingId, setEditPendingId, editPendingMessage,
    setEditPendingMessage, lastUserMessage, imageParameters, videoParameters, audioParameters,
    handleImageParameterChange, handleVideoParameterChange, handleAudioParameterChange, messagesEndRef, messagesContainerRef,
    bottomContainerRef, bottomPadding, jumpToLatestLogs, showJumpToLatest, isStartingRobot,
    isWaitingForResponse, isNewMakinaThinking, hasMessageBeenSent, handleSendMessage, isLoadingLogs,
    isLoadingMore, collapsedSystemMessages, collapsedToolDetails, expandedToolGroups, toggleSystemMessageCollapse,
    toggleToolDetails, toggleToolGroup, steps, instancePlans, getCurrentStep,
    latestRequirementStatus, requirementBacklog, isEditBacklogModalOpen, editBacklogTitle, setEditBacklogTitle,
    openEditBacklogModal, closeEditBacklogModal, saveBacklogItem, isEditModalOpen, editTitle,
    editDescription, setEditTitle, setEditDescription, openEditModal, closeEditModal,
    saveStep, deleteStep, toggleStepStatus, pausePlan, resumePlan,
    cancelPlan, canEditOrDeleteStep, isEditPlanModalOpen, editPlanTitle, editPlanDescription,
    setEditPlanTitle, setEditPlanDescription, openEditPlanModal, closeEditPlanModal, savePlan,
    assets, deleteAsset, isInstanceStarting, isInstanceRunning, runningUserLog,
    cancelWorkflow, isCancelling, pendingWork, removePending, editPending,
    sendNow, sendingId, handleScroll, shouldShowNewMakina, processedTimeline,
    lastProcessGroupId, isEmpty, allStepsCompleted, showFloatingPlanAppendix, showPinnedRunningBubble,
    showFloatingBacklog,
  }
}
