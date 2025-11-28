"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTheme } from "@/app/context/ThemeContext"
import { useSite } from '@/app/context/SiteContext'
import { useLayout } from '@/app/context/LayoutContext'
import { useToast } from '@/app/components/ui/use-toast'
import { useSearchParams, useRouter } from "next/navigation"
import { useRobots } from '@/app/context/RobotsContext'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useUserProfile } from './hooks/useUserProfile'
import { MessagesSkeleton } from "@/app/components/skeletons/messages-skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { User } from "@/app/components/ui/icons"

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
import { MessageInput } from './components/MessageInput'
import { MessageItem } from './components/MessageItem'
import { ToolCallItem } from './components/ToolCallItem'
import { CompletedPlanCard } from './components/CompletedPlanCard'
import { StepIndicator } from './components/StepIndicator'
import { EditStepModal } from './components/EditStepModal'
import { StepCompletedItem } from './components/StepCompletedItem'

// Import utilities
import { getActivityName } from './utils'

export function SimpleMessagesView({ className = "", activeRobotInstance, isBrowserVisible = false, onMessageSent, onNewInstanceCreated }: SimpleMessagesViewProps) {
  const { isDarkMode } = useTheme()
  const { currentSite } = useSite()
  const { isLayoutCollapsed } = useLayout()
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
  
  // Auto scroll to bottom when new logs arrive
  const scrollToBottom = useCallback(() => {
    // Try multiple methods to ensure scroll works correctly
    const container = messagesContainerRef.current
    const endElement = messagesEndRef.current
    
    if (container && endElement) {
      // Use scrollIntoView with smooth behavior for animation
      // block: 'end' ensures we scroll to the absolute bottom
      const scrollToEnd = () => {
        if (container && endElement) {
          // First, ensure we're at the bottom position
          endElement.scrollIntoView({ behavior: 'smooth', block: 'end', inline: 'nearest' })
          
          // Double-check with direct scrollTop assignment after a short delay
          // This ensures we reach the absolute bottom even if scrollIntoView doesn't account for padding
          setTimeout(() => {
            if (container) {
              const maxScroll = container.scrollHeight - container.clientHeight
              // Only adjust if we're significantly off (more than 20px)
              if (Math.abs(container.scrollTop - maxScroll) > 20) {
                // Use smooth scroll by animating to the target
                const targetScroll = maxScroll
                const startScroll = container.scrollTop
                const distance = targetScroll - startScroll
                const duration = 300 // ms
                let startTime: number | null = null
                
                const animateScroll = (currentTime: number) => {
                  if (!startTime) startTime = currentTime
                  const elapsed = currentTime - startTime
                  const progress = Math.min(elapsed / duration, 1)
                  
                  // Ease-out function for smooth animation
                  const easeOut = 1 - Math.pow(1 - progress, 3)
                  container.scrollTop = startScroll + (distance * easeOut)
                  
                  if (progress < 1) {
                    requestAnimationFrame(animateScroll)
                  } else {
                    // Final precise position
                    container.scrollTop = targetScroll
                  }
                }
                
                requestAnimationFrame(animateScroll)
              }
            }
          }, 100)
        }
      }
      
      // Try immediately
      scrollToEnd()
      
      // Try again after delays to account for layout shifts and image loading
      setTimeout(scrollToEnd, 100)
      setTimeout(scrollToEnd, 300)
      setTimeout(scrollToEnd, 600)
    } else if (endElement) {
      // Fallback to scrollIntoView if container ref is not available
      endElement.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [])


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

  // Scroll to bottom when logs change or activeRobotInstance changes
  // Scroll when there are conversations/logs OR when instance is running
  useEffect(() => {
    const hasConversations = logs.length > 0
    const isInstanceRunning = activeRobotInstance && ['running', 'active'].includes(activeRobotInstance.status)
    
    if (hasConversations || isInstanceRunning) {
      // Use multiple timeouts to ensure scroll happens after content is rendered
      const timeout1 = setTimeout(() => scrollToBottom(), 50)
      const timeout2 = setTimeout(() => scrollToBottom(), 200)
      const timeout3 = setTimeout(() => scrollToBottom(), 500)
      const timeout4 = setTimeout(() => scrollToBottom(), 1000)
      
      return () => {
        clearTimeout(timeout1)
        clearTimeout(timeout2)
        clearTimeout(timeout3)
        clearTimeout(timeout4)
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
    canEditOrDeleteStep
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
    console.log('🔄 Auto-expand effect triggered:', {
      assetsLength: assets.length,
      isStepIndicatorExpanded,
      shouldExpand: assets.length > 0 && !isStepIndicatorExpanded
    })
    if (assets.length > 0 && !isStepIndicatorExpanded) {
      console.log('🔄 Auto-expanding StepIndicator')
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
  
  completedPlans.forEach(plan => {
    const timestamp = plan.completed_at || plan.updated_at || plan.created_at
    timelineItems.push({
      type: 'completed_plan',
      timestamp: timestamp,
      data: plan
    })
  })
  
  const sortedTimeline = timelineItems.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  
  // Check if instance is running
  const isInstanceRunning = activeRobotInstance && ['running', 'active'].includes(activeRobotInstance.status)
  
  // Explorer is empty only if there's no timeline AND no running instance
  const isEmptyExplorer = !shouldShowNewMakina && sortedTimeline.length === 0 && !isInstanceRunning
  const isEmpty = isEmptyNewMakina || isEmptyExplorer

  return (
    <div className={`flex flex-col w-full min-w-0 h-full relative ${className}`}>
      {/* Messages list */}
      <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto overflow-x-hidden py-6 w-full min-w-0 transition-colors duration-300 ease-in-out pt-[91px] pb-44`}>
        <div className={isBrowserVisible ? "max-w-[calc(100%-80px)] mx-auto min-w-0" : "max-w-[calc(100%-240px)] mx-auto min-w-0"}>
        <div className="space-y-6">
        {(() => {
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
              if (sortedTimeline.length === 0) {
                console.log('🔄 [SimpleMessagesView] No timeline items')
                return null
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
                        isBrowserVisible={isBrowserVisible}
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
                        isBrowserVisible={isBrowserVisible}
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
        </div>
      </div>

      {/* Floating Step Indicator - Expandable */}
      {(() => {
        const shouldShow = steps.length > 0 || assets.length > 0
        console.log('StepIndicator should show:', shouldShow, 'steps:', steps.length, 'assets:', assets.length)
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

      {/* Message input area - fixed positioning like ChatInput */}
      <div 
        className={`fixed flex-none chat-input-container transition-all duration-300 ease-in-out bg-background/95 z-10`}
        style={{ 
          bottom: isEmpty ? '50%' : '20px',
          transform: isEmpty ? 'translateY(50%)' : 'none',
          left: `calc(${isLayoutCollapsed ? '64px' : '256px'} + 120px)`,
          right: '0px',
          width: `calc(100vw - ${isLayoutCollapsed ? '64px' : '256px'} - 240px)`
        }}
      >
        <MessageInput
          message={message}
          selectedActivity={selectedActivity}
          selectedContext={selectedContext}
          onMessageChange={setMessage}
          handleMessageChange={handleMessageChange}
          onActivityChange={setSelectedActivity}
          onContextChange={setSelectedContext}
          onSubmit={handleSendMessage}
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
