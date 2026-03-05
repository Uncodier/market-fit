"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
import { User } from "@/app/components/ui/icons"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { markdownComponents } from './utils/markdownComponents'

// Import types
import { SimpleMessagesViewProps, InstanceLog, SelectedContextIds, ImageParameters, VideoParameters, AudioParameters, MessageAttachment } from './types'

// Import hooks
import { useInstanceLogs } from './hooks/useInstanceLogs'
import { useInstancePlans } from './hooks/useInstancePlans'
import { useRobotInstance } from './hooks/useRobotInstance'
import { useMessageSending } from './hooks/useMessageSending'
import { useStepManagement } from './hooks/useStepManagement'
import { useInstanceAssets } from './hooks/useInstanceAssets'

// Import components
import { LoadingIndicator } from './components/LoadingIndicator'
import { EmptyStateOrbs } from './components/EmptyStateOrbs'
import { MessageInput } from './components/MessageInput'
import { MessageItem } from './components/MessageItem'
import { ToolCallItem } from './components/ToolCallItem'
import { ToolCallGroupItem } from './components/ToolCallGroupItem'
import { CompletedPlanCard } from './components/CompletedPlanCard'
import { StepIndicator } from './components/StepIndicator'
import { EditStepModal } from './components/EditStepModal'
import { StepCompletedItem } from './components/StepCompletedItem'
import { EmptyStatePrompts } from './components/EmptyStatePrompts'

// Import utilities
import { getActivityName, getToolName, groupTimelineToolCalls } from './utils'

export function SimpleMessagesView({ className = "", activeRobotInstance, isBrowserVisible = false, onMessageSent, onNewInstanceCreated }: SimpleMessagesViewProps) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refreshRobots } = useRobots()
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState()
  const { user } = useAuthContext()
  const { userProfile } = useUserProfile(user?.id)
  

  // Reset state when site changes
  useEffect(() => {
    
    // Reset selected context when site changes
    setSelectedContext({
      leads: [],
      contents: [],
      requirements: [],
      tasks: [],
      campaigns: []
    })
    
    // Reset activity selection
    setSelectedActivity('ask')
    
    // Reset step indicator
    setIsStepIndicatorExpanded(false)
    
    // Clear recent user message IDs
    setRecentUserMessageIds(new Set())
    setLastUserMessage('')
    
    // Clear message input
    clearMessage()
    
  }, [currentSite?.id, clearMessage])
  
  // Create a RefObject for MessageInput compatibility
  const messageInputTextareaRef = useRef<HTMLTextAreaElement>(null) as React.RefObject<HTMLTextAreaElement>
  
  // State for UI
  const [selectedContext, setSelectedContext] = useState<SelectedContextIds>({
    leads: [],
    contents: [],
    requirements: [],
    tasks: [],
    campaigns: []
  })
  const [selectedActivity, setSelectedActivity] = useState<string>('ask')
  const [isStepIndicatorExpanded, setIsStepIndicatorExpanded] = useState(false)
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
    channels: 'stereo'
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
  
  // Immediate scroll to bottom without animation (for initial load)
  const scrollToBottomImmediate = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }, [])


  // Handle message sent - capture the user message and scroll to bottom
  const handleMessageSent = useCallback((sent: boolean) => {
    if (sent && message) {
      setLastUserMessage(message)
      // Small delay to let the optimistic message render before scrolling
      const t = setTimeout(() => scrollToBottom(), 80)
      return () => clearTimeout(t)
    }
    onMessageSent?.(sent)
  }, [message, onMessageSent, scrollToBottom])

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
  const addOptimisticUserMessageRef = useRef<((message: string) => void) | null>(null)

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
    onMessageSent: handleMessageSent,
    onClearMessage: clearMessage,
    onScrollToBottom: scrollToBottom,
    onNewInstanceCreated: handleNewInstanceCreated,
    startInstancePolling,
    onAddOptimisticMessage: (message: string) => addOptimisticUserMessageRef.current?.(message),
    imageParameters,
    videoParameters,
    audioParameters
  })

  const {
    logs,
    isLoadingLogs,
    collapsedSystemMessages,
    collapsedToolDetails,
    expandedToolGroups,
    loadInstanceLogs,
    addOptimisticUserMessage,
    toggleSystemMessageCollapse,
    toggleAllSystemMessages,
    toggleToolDetails,
    toggleToolGroup,
    toggleAllToolDetails
  } = useInstanceLogs({
    activeRobotInstance,
    waitingForMessageId,
    onScrollToBottom: scrollToBottom,
    onScrollToBottomImmediate: scrollToBottomImmediate,
    onResponseReceived: clearThinkingState,
    currentSiteId: currentSite?.id
  })
  

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

  // Scroll to bottom when logs change or activeRobotInstance changes
  useEffect(() => {
    const hasConversations = logs.length > 0
    const isInstanceRunning = activeRobotInstance && ['running', 'active'].includes(activeRobotInstance.status)

    if (hasConversations || isInstanceRunning) {
      // Double rAF: first frame commits the DOM, second frame has correct layout dimensions
      let id1: number
      const id0 = requestAnimationFrame(() => {
        id1 = requestAnimationFrame(() => scrollToBottom())
      })
      return () => {
        cancelAnimationFrame(id0)
        cancelAnimationFrame(id1)
      }
    }
  }, [logs.length, activeRobotInstance?.id, activeRobotInstance?.status, scrollToBottom])

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
    canEditOrDeleteStep,
    addStep
  } = useStepManagement({
    activeRobotInstance,
    steps,
    instancePlans,
    onSetSteps: () => {}
  })

  // Instance assets management
  const {
    assets,
    isLoading: isLoadingAssets,
    deleteAsset
  } = useInstanceAssets({
    instanceId: activeRobotInstance?.id
  })

  // Auto-expand step indicator when assets are uploaded for the first time
  useEffect(() => {
    if (assets.length > 0 && !isStepIndicatorExpanded) {
      setIsStepIndicatorExpanded(true)
    }
  }, [assets.length]) // Removed isStepIndicatorExpanded from dependencies to allow manual collapse

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

  // Smart submit handler to intercept messages when a plan is active
  const handleSmartSubmit = useCallback(async () => {
    // Check if there is an active plan (in_progress or paused)
    // We prioritize in_progress, then paused
    const activePlan = instancePlans.find(p => p.status === 'in_progress') || 
                      instancePlans.find(p => p.status === 'paused')
    
    // Only intercept if there's an active plan AND we are in 'ask' mode (default chat)
    // If user is in 'robot' mode or other specific modes, let them proceed normally
    // Also ensure message is not empty
    if (activePlan && message.trim() && selectedActivity === 'ask') {
      
      // Add the message as a step
      await addStep(activePlan.id, message)
      
      // Clear the message input
      clearMessage()
      
      // Scroll to bottom to show the change
      scrollToBottom()
    } else {
      // Normal behavior
      handleSendMessage()
    }
  }, [instancePlans, message, selectedActivity, addStep, clearMessage, scrollToBottom, handleSendMessage])

  // Show loading skeleton when loading logs
  if (isLoadingLogs) {
    return <MessagesSkeleton />
  }

  // Calculate if chat is empty
  const shouldShowNewMakina = !activeRobotInstance || !activeRobotInstance.id || (activeRobotInstance.status === 'uninstantiated' && logs.length === 0)
  const isEmptyNewMakina = shouldShowNewMakina && !hasMessageBeenSent && !lastUserMessage && !isNewMakinaThinking
  
  // Calculate timeline for Explorer view
  const timelineItems: Array<{
    type: 'log' | 'completed_plan'
    timestamp: string
    data: any
  }> = []
  
  logs.forEach(log => {
    timelineItems.push({
      type: 'log',
      timestamp: log.created_at,
      data: log
    })
  })
  
  // Track which plans we've already added to avoid duplicates
  const addedPlanIds = new Set<string>()
  
  // 1. Add real historical plans (completed, failed, cancelled)
  completedPlans.forEach(plan => {
    if (addedPlanIds.has(plan.id)) return
    addedPlanIds.add(plan.id)
    
    const timestamp = plan.completed_at || plan.updated_at || plan.created_at
    timelineItems.push({
      type: 'completed_plan',
      timestamp: timestamp,
      data: plan
    })
  })

  // 2. Add active plans (pending, in_progress, etc.)
  // This ensures they show up in the timeline even before they are completed
  instancePlans.forEach(plan => {
    if (addedPlanIds.has(plan.id)) return
    addedPlanIds.add(plan.id)
    
    const isAllStepsCompleted = areAllStepsCompleted() && steps.some(s => s.planId === plan.id || !s.planId)
    
    // If it's visually completed but still in instancePlans, treat it as completed for the timeline
    if (isAllStepsCompleted) {
      // For visually completed, use updated_at or now
      const timestamp = plan.updated_at || plan.created_at || new Date().toISOString()
      
      timelineItems.push({
        type: 'completed_plan',
        timestamp: timestamp,
        data: {
          ...plan,
          status: 'completed',
          steps: steps.filter(s => s.planId === plan.id || !s.planId)
        }
      })
    } else {
      // Otherwise, show it at its creation time so it appears where it started
      const timestamp = plan.created_at
      timelineItems.push({
        type: 'completed_plan',
        timestamp: timestamp,
        data: plan
      })
    }
  })
  
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

  const isToolCallLog = (log: any) => {
    const isToolCall = log.log_type === 'tool_call' || log.log_type === 'tool_result'
    const hasToolName = log.tool_name || log.toolName
    const isStructuredOutput = (log.tool_name || log.toolName)?.toLowerCase() === 'structured_output'
    return (isToolCall || hasToolName) && !isStructuredOutput
  }

  const processedTimeline = groupTimelineToolCalls(
    sortedTimeline,
    (log: any) => log.tool_name || log.toolName,
    isToolCallLog
  )
  
  // Check if instance is running
  const isInstanceRunning = activeRobotInstance && ['running', 'active'].includes(activeRobotInstance.status)
  
  // Explorer is empty only if there's no timeline AND no running instance
  const isEmptyExplorer = !shouldShowNewMakina && sortedTimeline.length === 0 && !isInstanceRunning
  const isEmpty = isEmptyNewMakina || isEmptyExplorer

  return (
    <div className={`flex flex-col w-full min-w-0 h-full min-h-0 relative ${className}`}>
      {/* Floating background orbs - shown when chat is empty */}
      {isEmpty && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/8 rounded-full font-inter blur-2xl animate-float-slow"></div>
          <div className="absolute top-1/3 left-1/3 w-56 h-56 bg-indigo-500/10 rounded-full font-inter blur-2xl animate-float-medium" style={{ animationDelay: '7s' }}></div>
          <div className="absolute bottom-1/3 right-1/3 w-60 h-60 bg-purple-500/9 rounded-full font-inter blur-2xl animate-float-reverse" style={{ animationDelay: '9s' }}></div>
          <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 w-48 h-48 bg-violet-500/15 rounded-full font-inter blur-xl animate-float-slow"></div>
          <div className="absolute bottom-1/3 right-1/2 transform translate-x-1/2 w-44 h-44 bg-indigo-500/12 rounded-full font-inter blur-xl animate-float-medium" style={{ animationDelay: '3s' }}></div>
          <div className="absolute top-24 left-32 w-36 h-36 bg-pink-500/15 rounded-full font-inter blur-xl animate-float-fast" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-24 right-40 w-32 h-32 bg-emerald-500/12 rounded-full font-inter blur-xl animate-float-reverse" style={{ animationDelay: '4s' }}></div>
          <div className="absolute top-1/2 left-24 w-28 h-28 bg-cyan-500/10 rounded-full font-inter blur-xl animate-float-slow" style={{ animationDelay: '6s' }}></div>
          <div className="absolute bottom-1/4 right-28 w-30 h-30 bg-purple-500/15 rounded-full font-inter blur-xl animate-float-medium" style={{ animationDelay: '8s' }}></div>
          <div className="absolute top-1/4 right-1/3 w-40 h-40 bg-rose-500/10 rounded-full font-inter blur-xl animate-float-fast" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-1/2 left-1/4 w-38 h-38 bg-teal-500/12 rounded-full font-inter blur-xl animate-float-reverse" style={{ animationDelay: '5s' }}></div>
        </div>
      )}
      {/* Messages list */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-6 w-full min-w-0 transition-colors duration-300 ease-in-out pb-[220px]"
      >
        <div className="w-full max-w-4xl mx-auto px-4 min-w-0">
        <div className="space-y-6">
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
            <LoadingIndicator isVisible={isNewMakinaThinking} />
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
                if (item.type === 'tool_group') {
                  const group = item.data
                  return (
                    <ToolCallGroupItem
                      key={group.groupId}
                      group={group}
                      isDarkMode={isDarkMode}
                      isExpanded={expandedToolGroups.has(group.groupId)}
                      onToggleExpand={toggleToolGroup}
                      collapsedToolDetails={collapsedToolDetails}
                      onToggleToolDetails={toggleToolDetails}
                      isBrowserVisible={isBrowserVisible}
                    />
                  )
                }
                if (item.type === 'log') {
                  const log = item.data
                  const isStructuredOutput = (log.tool_name || log.toolName)?.toLowerCase() === 'structured_output'
                  const isStepCompleted = isStructuredOutput && log.message?.includes('event=step_completed')
                  
                  if (isStepCompleted) {
                    return (
                      <StepCompletedItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                      />
                    )
                  }
                  return (
                    <MessageItem
                      key={log.id}
                      log={log}
                      isDarkMode={isDarkMode}
                      collapsedSystemMessages={collapsedSystemMessages}
                      onToggleSystemMessageCollapse={toggleSystemMessageCollapse}
                      isBrowserVisible={isBrowserVisible}
                    />
                  )
                }
                if (item.type === 'completed_plan') {
                  return (
                    <CompletedPlanCard 
                      key={`plan-${item.data.id}`}
                      plan={item.data}
                    />
                  )
                }
                return null
              })
            })()}
            
            {/* Loading indicator when waiting for response */}
            <LoadingIndicator 
              isVisible={isWaitingForResponse || isNewMakinaThinking}
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
          "fixed right-0 bottom-0 z-20 pointer-events-none flex flex-col items-center transition-all duration-500 ease-in-out chat-input-container !bg-transparent",
          isEmpty ? "top-[135px] justify-center" : "justify-end pb-[15px]"
        )}
        style={{ 
          left: isMobile ? 0 : isLayoutCollapsed ? 64 : 256,
        }}
      >
        {/* Background that only appears when not empty, at the bottom */}
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent transition-opacity duration-500 pointer-events-none",
            isEmpty ? "opacity-0" : "opacity-100"
          )}
        />
        <div 
          className="w-full max-w-[800px] px-4 pointer-events-auto relative z-10 !bg-transparent !p-0"
        >
        {/* Floating Step Indicator - Expandable */}
        {(() => {
          const isAllCompleted = areAllStepsCompleted()
          // Show widget when there are assets (always) or when there are steps not yet all completed
          const shouldShow = assets.length > 0 || (steps.length > 0 && !isAllCompleted)
          return shouldShow
        })() && (
          <StepIndicator
            steps={steps}
            instancePlans={instancePlans}
            currentStep={getCurrentStep()}
            allCompleted={areAllStepsCompleted()}
            expanded={isStepIndicatorExpanded}
            onToggleExpanded={() => setIsStepIndicatorExpanded(!isStepIndicatorExpanded)}
            onTogglePause={(planId: string) => {
              pausePlan(planId)
            }}
            onToggleResume={(planId: string) => {
              resumePlan(planId)
            }}
            onEditStep={openEditModal}
            onDeleteStep={deleteStep}
            onToggleStepStatus={toggleStepStatus}
            canEditOrDeleteStep={canEditOrDeleteStep}
            assets={assets}
            onDeleteAsset={deleteAsset}
            isBrowserVisible={isBrowserVisible}
          />
        )}
        {/* Prompt suggestion carousel - shown only when chat is empty, fades out when content appears */}
        {isEmpty && (
          <div className="mb-2 mx-auto w-full animate-in fade-in duration-300" style={{ maxWidth: '800px' }}>
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
          onSubmit={handleSmartSubmit}
          disabled={isSendingMessage || isStartingRobot}
          placeholder={activeRobotInstance ? (isSendingMessage ? "Sending message..." : "Ask anything...") : (isStartingRobot ? "Starting robot..." : "Ask anything...")}
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
    </div>
  )
}
