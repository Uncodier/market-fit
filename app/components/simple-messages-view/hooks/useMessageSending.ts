import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'
import { contextService, type SelectedContextIds } from '@/app/services/context-service'
import { getActivityName, getSystemPromptForActivity } from '../utils'
import { InstanceLog, ImageParameters, VideoParameters, AudioParameters } from '../types'

interface UseMessageSendingProps {
  activeRobotInstance?: any
  selectedActivity: string
  selectedContext: SelectedContextIds
  messageRef: React.MutableRefObject<string>
  onMessageSent?: (hasMessageBeenSent: boolean) => void
  onClearMessage?: () => void
  onScrollToBottom?: () => void
  onNewInstanceCreated?: (instanceId: string, shouldNavigate?: boolean) => void
  startInstancePolling?: (activityName: string, instanceId?: string, shouldAutoNavigate?: boolean) => Promise<void>
  onAddOptimisticMessage?: (message: string) => void
  // Media parameters
  imageParameters?: ImageParameters
  videoParameters?: VideoParameters
  audioParameters?: AudioParameters
}

export const useMessageSending = ({
  activeRobotInstance,
  selectedActivity,
  selectedContext,
  messageRef,
  onMessageSent,
  onClearMessage,
  onScrollToBottom,
  onNewInstanceCreated,
  startInstancePolling,
  onAddOptimisticMessage,
  imageParameters,
  videoParameters,
  audioParameters
}: UseMessageSendingProps) => {
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [isNewMakinaThinking, setIsNewMakinaThinking] = useState(false)
  const [hasMessageBeenSent, setHasMessageBeenSent] = useState(false)
  const [waitingForMessageId, setWaitingForMessageId] = useState<string | null>(null)
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Track the active request ID to handle race conditions
  const activeRequestIdRef = useRef<string | null>(null)
  // Track the instance_id for which we're currently showing loading
  const loadingInstanceIdRef = useRef<string | null>(null)
  const { currentSite } = useSite()
  const { toast } = useToast()

  // Clear thinking state - utility function
  const clearThinkingState = () => {
    const currentInstanceId = activeRobotInstance?.id
    // Only clear if this state belongs to the current instance
    if (loadingInstanceIdRef.current !== null && loadingInstanceIdRef.current !== currentInstanceId) {
      console.log(`🛡️ [useMessageSending] Not clearing thinking state - belongs to different instance (${loadingInstanceIdRef.current} vs ${currentInstanceId})`)
      return
    }
    
    console.log('🛡️ Clearing thinking state')
    setIsWaitingForResponse(false)
    // Unlock input when thinking hides, as the user might want to interact even if the API call is still wrapping up
    setIsSendingMessage(false)
    activeRequestIdRef.current = null // Clear active request so finally block doesn't interfere
    setWaitingForMessageId(null)
    loadingInstanceIdRef.current = null
    
    // Clear any existing timeout
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }
  }

  // New Makina specific thinking state management
  const setNewMakinaThinking = () => {
    // New Makina doesn't have an instance_id yet, so we use null as the identifier
    console.log('🤔 Setting New Makina thinking state (no instance_id yet)')
    loadingInstanceIdRef.current = null // null means "new makina" context
    setIsNewMakinaThinking(true)
  }

  const clearNewMakinaThinking = () => {
    // Only clear if we're in the "new makina" context (loadingInstanceIdRef.current === null)
    // or if we don't have an active instance
    if (loadingInstanceIdRef.current !== null && activeRobotInstance?.id) {
      console.log(`🛡️ [useMessageSending] Not clearing New Makina thinking - we have an active instance (${activeRobotInstance.id})`)
      return
    }
    
    console.log('🛡️ [useMessageSending] Clearing New Makina thinking state')
    console.log('🛡️ [useMessageSending] Current isNewMakinaThinking:', isNewMakinaThinking)
    setIsNewMakinaThinking(false)
    // Unlock input when thinking hides, as the user might want to interact even if the API call is still wrapping up
    setIsSendingMessage(false)
    activeRequestIdRef.current = null
    loadingInstanceIdRef.current = null
    console.log('🛡️ [useMessageSending] New Makina thinking state cleared')
  }

  // Set thinking state with safety timeout
  const setThinkingStateWithTimeout = () => {
    const currentInstanceId = activeRobotInstance?.id
    if (!currentInstanceId) {
      console.warn('⚠️ [useMessageSending] Cannot set thinking state: no active instance')
      return
    }
    
    console.log(`🤔 Setting thinking state with safety timeout for instance: ${currentInstanceId}`)
    loadingInstanceIdRef.current = currentInstanceId
    setIsWaitingForResponse(true)
    
    // Clear any existing timeout
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
    }
    
    // Set safety timeout - clear thinking state after 30 seconds if no response
    thinkingTimeoutRef.current = setTimeout(() => {
      // Only clear if this timeout is still for the current instance
      if (loadingInstanceIdRef.current === currentInstanceId) {
        console.log('⏰ Thinking timeout reached, clearing state as safety measure')
        clearThinkingState()
        loadingInstanceIdRef.current = null
      }
    }, 30000) // 30 seconds - shorter timeout for better UX
  }

  // Handle assistant message (non-robot activities)
  const handleAssistantMessage = async (messageToSend: string) => {
    if (!currentSite?.id) return

    try {
      const contextData = await contextService.getContextData(selectedContext, currentSite.id)
      const contextString = contextData && typeof contextData === 'object' ? JSON.stringify(contextData) : (contextData || "")
      
      const { apiClient } = await import('@/app/services/api-client-service')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      const systemPrompt = getSystemPromptForActivity(selectedActivity, {
        imageParameters,
        videoParameters,
        audioParameters
      })
      
      // Prepare request payload
      const requestPayload: any = {
        message: messageToSend,
        site_id: currentSite.id,
        user_id: user?.id,
        context: contextString,
        system_prompt: systemPrompt
      }
      
      // For assistant messages, we don't need to create instances
      // Only use instance_id if we have an active robot instance
      let instanceId = activeRobotInstance?.id
      
      if (instanceId) {
        requestPayload.instance_id = instanceId
        console.log('🤖 Sending assistant message with existing instance_id:', instanceId)
      } else {
        console.log('🤖 Sending assistant message without instance_id (new_makina context)')
      }
      
      const response = await apiClient.post('/api/robots/instance/assistant', requestPayload)

      if (response.success) {
        console.log('✅ Assistant message sent successfully:', response.data)
      } else {
        console.error('Assistant API error:', response.error)
        toast({
          title: 'Error',
          description: 'Please try again.', 
          variant: 'destructive' 
        })
      }
    } catch (error) {
      console.error('Error sending assistant message:', error)
      toast({
        title: 'Error',
        description: 'Please try again.', 
        variant: 'destructive' 
      })
    }
  }

  // Handle robot message (workflow/startRobot)
  const handleRobotMessage = async (messageToSend: string) => {
    if (!currentSite?.id) return

    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      let response
      
      
      // Debug: Log robot instance status
      console.log('🔍 Robot instance debug:', {
        hasActiveRobotInstance: !!activeRobotInstance,
        instanceId: activeRobotInstance?.id,
        instanceStatus: activeRobotInstance ? (activeRobotInstance as any).status : 'none',
        instanceName: activeRobotInstance?.name,
        selectedActivity: selectedActivity,
        willUsePromptRobot: !!activeRobotInstance?.id,
        willUseStartRobot: !activeRobotInstance?.id
      })
      
      // Add instance_id if we have an active robot instance
      if (activeRobotInstance?.id) {
        console.log('🤖 Sending message to existing robot instance:', activeRobotInstance.id)
        
        // Check if robot is already running - if so, don't show loading
        const isRobotRunning = ['running', 'active'].includes((activeRobotInstance as any).status)
        
        if (!isRobotRunning) {
          // Only set thinking state if robot is not already running
          setThinkingStateWithTimeout()
          onMessageSent?.(true) // Trigger explorer view
        }
        
        // Prepare payload for promptRobot endpoint
        const promptPayload = {
          instance_id: activeRobotInstance.id,
          message: messageToSend,
          step_status: 'in_progress',
          site_id: currentSite.id,
          context: JSON.stringify(selectedContext),
          activity: 'robot'
        }
        
        // Use promptRobot endpoint for existing robots
        response = await apiClient.post('/api/workflow/promptRobot', promptPayload)
      } else {
        console.log('🤖 Starting robot workflow for new instance')
        // Set New Makina thinking state
        setNewMakinaThinking()
        
        // Prepare payload for startRobot endpoint
        const startPayload = {
          site_id: currentSite.id,
          user_id: user?.id,
          activity: 'robot',
          message: messageToSend,
          context: JSON.stringify(selectedContext)
        }
        
        // Use startRobot endpoint for new instances
        response = await apiClient.post('/api/workflow/startRobot', startPayload)
      }

      if (response.success) {
        console.log('✅ Robot workflow started successfully:', response.data)
        
        // Start polling to detect when instance becomes running
        if (activeRobotInstance?.id) {
          // For existing robots, only poll if not already running
          const isRobotRunning = ['running', 'active'].includes((activeRobotInstance as any).status)
          if (!isRobotRunning) {
            console.log('🔄 Starting polling for existing robot instance:', activeRobotInstance.id)
            startInstancePolling?.('robot', activeRobotInstance.id, true) // Allow navigation for existing robots
          } else {
            console.log('✅ Robot already running, no polling needed')
          }
        } else if (response.data?.instance_id) {
          // For new robots, we now have the instance_id immediately
          console.log('🔄 New robot instance created:', response.data.instance_id)
          
          // Clear New Makina thinking state since we now have an instance
          clearNewMakinaThinking()
          
          // Notify parent component about the new instance with no-navigation flag
          onNewInstanceCreated?.(response.data.instance_id, false)
        }
      } else {
        console.error('Robot workflow API error:', response.error)
        // Clear thinking states on error
        clearThinkingState()
        clearNewMakinaThinking()
        toast({
          title: 'Error',
          description: 'Failed to start robot workflow. Please try again.', 
          variant: 'destructive' 
        })
      }
    } catch (error) {
      console.error('Error starting robot workflow:', error)
      // Clear thinking states on error
      clearThinkingState()
      clearNewMakinaThinking()
      toast({
        title: 'Error',
        description: 'Failed to start robot workflow. Please try again.', 
        variant: 'destructive' 
      })
    }
  }

  // Handle sending messages
  const handleSendMessage = async () => {
    // Ensure messageRef.current is a string
    const currentMessage = typeof messageRef.current === 'string' ? messageRef.current : ''
    if (!currentMessage.trim() || !currentSite?.id || isSendingMessage) return

    const messageToSend = currentMessage.trim()

    // Generate request ID to track this specific request
    const requestId = Date.now().toString()
    activeRequestIdRef.current = requestId

    // Prevent duplicate submissions / set UI states
    setIsSendingMessage(true)
    onClearMessage?.()
    
    // Set appropriate thinking state and add optimistic message
    if (!activeRobotInstance) {
      // New Makina context - set New Makina thinking state
      console.log('🤖 New Makina context detected, setting New Makina thinking state')
      setNewMakinaThinking()
      setHasMessageBeenSent(true)
      onMessageSent?.(true)
    } else {
      // Existing instance context - add optimistic user message + thinking state
      console.log('🤖 Adding optimistic user message for existing instance')
      onAddOptimisticMessage?.(messageToSend)
      setThinkingStateWithTimeout()
    }

    try {
      // Route based on activity type only
      if (selectedActivity === 'robot') {
        // Robot activity: use robot workflow
        await handleRobotMessage(messageToSend)
      } else {
        // Non-robot activities: use assistant endpoint
        await handleAssistantMessage(messageToSend)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      // Clear thinking state on error
      if (!activeRobotInstance) {
        clearNewMakinaThinking()
      } else {
        clearThinkingState()
      }
    } finally {
      // Only clear sending state if this is still the active request
      // (It might have been cleared by clearThinkingState, or a new request might have started)
      if (activeRequestIdRef.current === requestId) {
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }
  }

  // Reset message sent state - utility function
  const resetMessageSentState = () => {
    console.log('🔄 Resetting message sent state')
    setHasMessageBeenSent(false)
  }

  // Reset loading states when activeRobotInstance changes to a different instance
  useEffect(() => {
    const currentInstanceId = activeRobotInstance?.id || null
    
    // If we switched to a different instance, clear loading states
    if (loadingInstanceIdRef.current !== null && loadingInstanceIdRef.current !== currentInstanceId) {
      console.log(`🔄 [useMessageSending] Instance changed from ${loadingInstanceIdRef.current} to ${currentInstanceId}, clearing loading states`)
      // Clear states directly instead of calling functions to avoid dependency issues
      setIsWaitingForResponse(false)
      setWaitingForMessageId(null)
      setIsNewMakinaThinking(false)
      setIsSendingMessage(false) // Also clear sending state when switching instances
      loadingInstanceIdRef.current = null
      
      // Clear any existing timeout
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current)
        thinkingTimeoutRef.current = null
      }
    }
    
    // Update the ref to track the current instance
    if (currentInstanceId) {
      loadingInstanceIdRef.current = currentInstanceId
    }
  }, [activeRobotInstance?.id])

  // Reset hasMessageBeenSent when switching to no active instance
  useEffect(() => {
    if (!activeRobotInstance) {
      setHasMessageBeenSent(false)
      // Also clear loading states when there's no active instance
      setIsWaitingForResponse(false)
      setWaitingForMessageId(null)
      setIsNewMakinaThinking(false)
      setIsSendingMessage(false) // Also clear sending state when there's no active instance
      loadingInstanceIdRef.current = null
      
      // Clear any existing timeout
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current)
        thinkingTimeoutRef.current = null
      }
    }
  }, [activeRobotInstance])

  return {
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
  }
}
