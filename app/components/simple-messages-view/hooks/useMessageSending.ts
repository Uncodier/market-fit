import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'
import { contextService, type SelectedContextIds } from '@/app/services/context-service'
import { getActivityName, getSystemPromptForActivity } from '../utils'
import { InstanceLog } from '../types'

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
  onAddOptimisticMessage
}: UseMessageSendingProps) => {
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [isNewMakinaThinking, setIsNewMakinaThinking] = useState(false)
  const [hasMessageBeenSent, setHasMessageBeenSent] = useState(false)
  const [waitingForMessageId, setWaitingForMessageId] = useState<string | null>(null)
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { currentSite } = useSite()
  const { toast } = useToast()

  // Clear thinking state - utility function
  const clearThinkingState = () => {
    console.log('🛡️ Clearing thinking state')
    setIsWaitingForResponse(false)
    setWaitingForMessageId(null)
    
    // Clear any existing timeout
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }
  }

  // New Makina specific thinking state management
  const setNewMakinaThinking = () => {
    console.log('🤔 Setting New Makina thinking state')
    setIsNewMakinaThinking(true)
  }

  const clearNewMakinaThinking = () => {
    console.log('🛡️ [useMessageSending] Clearing New Makina thinking state')
    console.log('🛡️ [useMessageSending] Current isNewMakinaThinking:', isNewMakinaThinking)
    setIsNewMakinaThinking(false)
    console.log('🛡️ [useMessageSending] New Makina thinking state cleared')
  }

  // Set thinking state with safety timeout
  const setThinkingStateWithTimeout = () => {
    console.log('🤔 Setting thinking state with safety timeout')
    setIsWaitingForResponse(true)
    
    // Clear any existing timeout
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
    }
    
    // Set safety timeout - clear thinking state after 30 seconds if no response
    thinkingTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Thinking timeout reached, clearing state as safety measure')
      clearThinkingState()
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
      
      const systemPrompt = getSystemPromptForActivity(selectedActivity)
      
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
      // Always clear sending state
      setIsSendingMessage(false)
    }
  }

  // Reset message sent state - utility function
  const resetMessageSentState = () => {
    console.log('🔄 Resetting message sent state')
    setHasMessageBeenSent(false)
  }

  // Reset hasMessageBeenSent when switching to no active instance
  useEffect(() => {
    if (!activeRobotInstance) {
      setHasMessageBeenSent(false)
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
