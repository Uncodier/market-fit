"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'
import { useSearchParams, useRouter } from "next/navigation"
import { useRobots } from '@/app/context/RobotsContext'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useUserProfile } from './hooks/useUserProfile'
import { MessagesSkeleton } from "@/app/components/skeletons/messages-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { User, Bot } from "@/app/components/ui/icons"
import { EmptyCard } from "@/app/components/ui/empty-card"

// Import types
import { SimpleMessagesViewProps, InstanceLog, SelectedContextIds, ImageParameters, VideoParameters, AudioParameters } from './types'

// Import hooks
import { useInstanceLogs } from './hooks/useInstanceLogs'
import { useInstancePlans } from './hooks/useInstancePlans'
import { useRobotInstance } from './hooks/useRobotInstance'
import { useMessageSending } from './hooks/useMessageSending'
import { useStepManagement } from './hooks/useStepManagement'

// Import components
import { LoadingIndicator } from './components/LoadingIndicator'
import { MessageInput } from './components/MessageInput'
import { MessageItem } from './components/MessageItem'
import { ToolCallItem } from './components/ToolCallItem'
import { CompletedPlanCard } from './components/CompletedPlanCard'
import { StepIndicator } from './components/StepIndicator'
import { EditStepModal } from './components/EditStepModal'
import { StepCompletedItem } from './components/StepCompletedItem'

// Import utilities
import { getActivityName } from './utils'

export function SimpleMessagesView({ className = "", activeRobotInstance, onMessageSent, onNewInstanceCreated }: SimpleMessagesViewProps) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { refreshRobots } = useRobots()
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState()
  const { user } = useAuthContext()
  const { userProfile } = useUserProfile(user?.id)
  
  // Log activeRobotInstance changes
  useEffect(() => {
    console.log('🔄 [SimpleMessagesView] activeRobotInstance changed:', {
      activeRobotInstance: activeRobotInstance ? { 
        id: activeRobotInstance.id, 
        name: activeRobotInstance.name, 
        status: activeRobotInstance.status 
      } : null,
      hasActiveRobotInstance: !!activeRobotInstance,
      hasActiveRobotInstanceId: !!(activeRobotInstance?.id)
    })
  }, [activeRobotInstance])

  // Reset state when site changes
  useEffect(() => {
    console.log('🔄 [SimpleMessagesView] Site changed, resetting state for site:', currentSite?.id)
    
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
    duration: 30
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
  
  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Auto scroll when logs change or when waiting for response
  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom])

  // Handle message sent - capture the user message and scroll to bottom
  const handleMessageSent = useCallback((sent: boolean) => {
    if (sent && message) {
      setLastUserMessage(message)
      // Scroll to bottom with animation when message is sent
      setTimeout(() => {
        scrollToBottom()
      }, 100)
    }
    onMessageSent?.(sent)
  }, [message, onMessageSent, scrollToBottom])

  // Ref to store the reset function to avoid circular dependency
  const resetMessageSentStateRef = useRef<(() => void) | null>(null)

  // Handle new instance creation - defined before hook initialization
  const handleNewInstanceCreated = useCallback(async (instanceId: string, shouldNavigate: boolean = true) => {
    console.log('🔄 New instance created, refreshing robots:', instanceId, 'shouldNavigate:', shouldNavigate)
    
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
      console.log('🔄 No navigation requested, parent will handle tab conversion')
      
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
    onAddOptimisticMessage: (message: string) => addOptimisticUserMessageRef.current?.(message)
  })

  const {
    logs,
    isLoadingLogs,
    collapsedSystemMessages,
    collapsedToolDetails,
    loadInstanceLogs,
    addOptimisticUserMessage,
    toggleSystemMessageCollapse,
    toggleAllSystemMessages,
    toggleToolDetails,
    toggleAllToolDetails
  } = useInstanceLogs({
    activeRobotInstance,
    waitingForMessageId,
    onScrollToBottom: scrollToBottom,
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
    canEditOrDeleteStep
  } = useStepManagement({
    activeRobotInstance,
    steps,
    instancePlans,
    onSetSteps: () => {}
  })

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

  // Show loading skeleton when loading logs
  if (isLoadingLogs) {
    return <MessagesSkeleton />
  }

  return (
    <div className={`flex flex-col h-full w-full min-w-0 overflow-hidden relative ${className}`}>
      {/* Messages list */}
      <div className={`flex-1 overflow-y-auto overflow-x-hidden px-[30px] py-4 space-y-6 w-full min-w-0 ${!activeRobotInstance ? 'pb-0' : 'pb-[175px]'}`}>
        {(() => {
          // Show New Makina view if no instance, or if instance is uninstantiated AND has no logs
          const shouldShowNewMakina = !activeRobotInstance || !activeRobotInstance.id || (activeRobotInstance.status === 'uninstantiated' && logs.length === 0)
          console.log('🔄 [SimpleMessagesView] Render decision:', {
            shouldShowNewMakina,
            activeRobotInstance: activeRobotInstance ? { id: activeRobotInstance.id, name: activeRobotInstance.name, status: activeRobotInstance.status } : null,
            hasActiveRobotInstance: !!activeRobotInstance,
            hasActiveRobotInstanceId: !!(activeRobotInstance?.id),
            logsLength: logs.length,
            isLoadingLogs,
            isWaitingForResponse,
            isNewMakinaThinking
          })
          
          if (shouldShowNewMakina) {
            console.log('🔄 [SimpleMessagesView] Rendering New Makina view')
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
                      className="text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted w-full overflow-hidden break-words whitespace-pre-wrap rounded-lg p-4 mr-12" 
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
                      {lastUserMessage}
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
            console.log('🔄 [SimpleMessagesView] Rendering Explorer view')
            return (
            <>
            {/* Create unified timeline of logs and completed plans */}
            {(() => {
              // Create timeline items with timestamps
              const timelineItems: Array<{
                type: 'log' | 'completed_plan'
                timestamp: string
                data: any
              }> = []

              // Add logs to timeline
              logs.forEach(log => {
                timelineItems.push({
                  type: 'log',
                  timestamp: log.created_at,
                  data: log
                })
              })

              // Add completed plans to timeline
              completedPlans.forEach(plan => {
                const timestamp = plan.completed_at || plan.updated_at || plan.created_at
                timelineItems.push({
                  type: 'completed_plan',
                  timestamp: timestamp,
                  data: plan
                })
              })

              // Sort by timestamp
              const sortedTimeline = timelineItems.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              )

              if (sortedTimeline.length === 0) {
                console.log('🔄 [SimpleMessagesView] No timeline items, showing empty state')
                return (
                  <div className="flex items-center justify-center h-full w-full absolute inset-0">
                    <EmptyCard
                      icon={<Bot className="h-12 w-12 text-muted-foreground/60" />}
                      title="No activity yet"
                      description="Robot activity and logs will appear here once the robot starts working."
                      variant="fancy"
                      showShadow={false}
                      className="max-w-md"
                    />
                  </div>
                )
              }
              
              console.log('🔄 [SimpleMessagesView] Rendering timeline with', sortedTimeline.length, 'items')

              
              return sortedTimeline.map((item, index) => {
                if (item.type === 'log') {
                  const log = item.data
                  // Check if this is a tool call or tool result
                  const isToolCall = log.log_type === 'tool_call' || log.log_type === 'tool_result'
                  const hasToolName = log.tool_name || log.toolName
                  
                  // Show structured_output as regular messages instead of tool calls
                  const isStructuredOutput = (log.tool_name || log.toolName)?.toLowerCase() === 'structured_output'
                  
                  // Check if this is a step_completed event
                  const isStepCompleted = isStructuredOutput && log.message?.includes('event=step_completed')
                  
                  if (isStepCompleted) {
                    return (
                      <StepCompletedItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                      />
                    )
                  } else if ((isToolCall || hasToolName) && !isStructuredOutput) {
                    return (
                      <ToolCallItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                        collapsedToolDetails={collapsedToolDetails}
                        onToggleToolDetails={toggleToolDetails}
                      />
                    )
                  } else {
                    // Show all messages including structured_output
                    return (
                      <MessageItem
                        key={log.id}
                        log={log}
                        isDarkMode={isDarkMode}
                        collapsedSystemMessages={collapsedSystemMessages}
                        onToggleSystemMessageCollapse={toggleSystemMessageCollapse}
                      />
                    )
                  }
                } else if (item.type === 'completed_plan') {
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
        <div className="pb-48"></div>
        
        {/* Invisible element for auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Step Indicator - Expandable */}
      {steps.length > 0 && (
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
        />
      )}

      {/* Message input area - centered when no instance or uninstantiated without messages, bottom when active or message sent */}
      <div className={`${(!activeRobotInstance || (activeRobotInstance?.status === 'uninstantiated' && logs.length === 0)) && !hasMessageBeenSent ? 'absolute inset-x-0 top-1/2 -translate-y-1/2 transform' : 'absolute bottom-4 left-0 right-0'} flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-[20] w-full`}>
        <MessageInput
          message={message}
          selectedActivity={selectedActivity}
          selectedContext={selectedContext}
          onMessageChange={setMessage}
          onActivityChange={setSelectedActivity}
          onContextChange={setSelectedContext}
          onSubmit={handleSendMessage}
          disabled={isSendingMessage || isStartingRobot}
          placeholder={activeRobotInstance ? (isSendingMessage ? "Sending message..." : "Ask anything...") : (isStartingRobot ? "Starting robot..." : "Ask anything...")}
          textareaRef={messageInputTextareaRef}
          imageParameters={imageParameters}
          videoParameters={videoParameters}
          audioParameters={audioParameters}
          onImageParameterChange={handleImageParameterChange}
          onVideoParameterChange={handleVideoParameterChange}
          onAudioParameterChange={handleAudioParameterChange}
        />
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
