import { createClient } from '@/lib/supabase/client'
import { contextService, type SelectedContextIds } from '@/app/services/context-service'
import { getSystemPromptForActivity } from '../utils'
import { ImageParameters, VideoParameters, AudioParameters } from '../types'
import {
  persistUserActionLog,
  markRobotInstanceErrorIfUnanswered,
  postWithRetry,
  createRequestId,
} from './send-message-reliability'

type ToastFn = (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void

export async function sendAssistantMessage(params: {
  messageToSend: string
  siteId: string
  selectedActivity: string
  selectedContext: SelectedContextIds
  activeRobotInstance?: { id?: string } | null
  imageParameters?: ImageParameters
  videoParameters?: VideoParameters
  audioParameters?: AudioParameters
  toast: ToastFn
}): Promise<void> {
  const {
    messageToSend,
    siteId,
    selectedActivity,
    selectedContext,
    activeRobotInstance,
    imageParameters,
    videoParameters,
    audioParameters,
    toast,
  } = params

  try {
    const contextData = await contextService.getContextData(selectedContext, siteId)

    let mediaType = 'text'
    let currentParams: any = {}

    if (selectedActivity === 'generate-image') {
      mediaType = 'image'
      currentParams = { ...imageParameters }
    } else if (selectedActivity === 'generate-video') {
      mediaType = 'video'
      currentParams = { ...videoParameters }
    } else if (selectedActivity === 'generate-audio') {
      mediaType = 'audio'
      currentParams = { ...audioParameters }
    }

    const expectedResults = currentParams.expectedResults || 1

    let contextObj: any = {}
    if (contextData) {
      if (typeof contextData === 'object' && !Array.isArray(contextData)) {
        contextObj = { ...contextData }
      } else {
        contextObj.raw_context = contextData
      }
    }

    contextObj.mediaType = mediaType
    contextObj.output_type = mediaType
    contextObj.parameters = { ...currentParams }

    if (contextObj.parameters.expectedResults !== undefined) {
      delete contextObj.parameters.expectedResults
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const requestId = createRequestId()
    const requestPayload: any = {
      message: messageToSend,
      site_id: siteId,
      user_id: user?.id,
      context: JSON.stringify(contextObj),
      system_prompt: getSystemPromptForActivity(selectedActivity, {
        imageParameters,
        videoParameters,
        audioParameters,
      }),
      expected_results_amount: expectedResults,
      request_id: requestId,
      client_persisted: true,
    }

    const instanceId = activeRobotInstance?.id
    if (instanceId) {
      requestPayload.instance_id = instanceId
      await persistUserActionLog({
        instanceId,
        siteId,
        userId: user?.id,
        message: messageToSend,
        requestId,
      })
    }

    const response = await postWithRetry('/api/robots/instance/assistant', requestPayload, {
      instanceId,
      message: messageToSend,
    })

    if (response.success) return

    if (instanceId) {
      await markRobotInstanceErrorIfUnanswered({
        instanceId,
        siteId,
        userId: user?.id,
        errorMessage: response.error?.message || 'Assistant request failed',
        message: messageToSend,
      })
    }
    toast({ title: 'Error', description: 'Please try again.', variant: 'destructive' })
  } catch (error) {
    console.error('Error sending assistant message:', error)
    const instanceId = activeRobotInstance?.id
    if (instanceId) {
      await markRobotInstanceErrorIfUnanswered({
        instanceId,
        siteId,
        errorMessage: error instanceof Error ? error.message : 'Assistant request failed',
        message: messageToSend,
      })
    }
    toast({ title: 'Error', description: 'Please try again.', variant: 'destructive' })
  }
}

export async function sendRobotMessage(params: {
  messageToSend: string
  siteId: string
  selectedContext: SelectedContextIds
  activeRobotInstance?: { id?: string; status?: string } | null
  toast: ToastFn
  setThinkingStateWithTimeout: () => void
  setNewMakinaThinking: () => void
  clearThinkingState: () => void
  clearNewMakinaThinking: () => void
  onMessageSent?: (hasMessageBeenSent: boolean) => void
  onNewInstanceCreated?: (instanceId: string, shouldNavigate?: boolean) => void
  startInstancePolling?: (activityName: string, instanceId?: string, shouldAutoNavigate?: boolean) => Promise<void>
}): Promise<void> {
  const {
    messageToSend,
    siteId,
    selectedContext,
    activeRobotInstance,
    toast,
    setThinkingStateWithTimeout,
    setNewMakinaThinking,
    clearThinkingState,
    clearNewMakinaThinking,
    onMessageSent,
    onNewInstanceCreated,
    startInstancePolling,
  } = params

  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let response

    if (activeRobotInstance?.id) {
      const isRobotRunning = ['running', 'active'].includes(activeRobotInstance.status || '')
      if (!isRobotRunning) {
        setThinkingStateWithTimeout()
        onMessageSent?.(true)
      }

      const requestId = createRequestId()
      const promptPayload = {
        instance_id: activeRobotInstance.id,
        message: messageToSend,
        step_status: 'in_progress',
        site_id: siteId,
        context: JSON.stringify(selectedContext),
        activity: 'robot',
        request_id: requestId,
        client_persisted: true,
      }

      await persistUserActionLog({
        instanceId: activeRobotInstance.id,
        siteId,
        userId: user?.id,
        message: messageToSend,
        requestId,
      })

      response = await postWithRetry('/api/workflow/promptRobot', promptPayload, {
        instanceId: activeRobotInstance.id,
        message: messageToSend,
      })
    } else {
      setNewMakinaThinking()
      response = await postWithRetry('/api/workflow/startRobot', {
        site_id: siteId,
        user_id: user?.id,
        activity: 'robot',
        message: messageToSend,
        context: JSON.stringify(selectedContext),
        request_id: createRequestId(),
      })
    }

    if (response.success) {
      if (activeRobotInstance?.id) {
        const isRobotRunning = ['running', 'active'].includes(activeRobotInstance.status || '')
        if (!isRobotRunning) {
          startInstancePolling?.('robot', activeRobotInstance.id, true)
        }
      } else if (response.data?.instance_id) {
        clearNewMakinaThinking()
        onNewInstanceCreated?.(response.data.instance_id, false)
        startInstancePolling?.('robot', response.data.instance_id, false)
      }
      return
    }

    if (activeRobotInstance?.id) {
      await markRobotInstanceErrorIfUnanswered({
        instanceId: activeRobotInstance.id,
        siteId,
        userId: user?.id,
        errorMessage: response.error?.message || 'Failed to start robot workflow',
        message: messageToSend,
      })
    }
    clearThinkingState()
    clearNewMakinaThinking()
    toast({
      title: 'Error',
      description: 'Failed to start robot workflow. Please try again.',
      variant: 'destructive',
    })
  } catch (error) {
    console.error('Error starting robot workflow:', error)
    if (activeRobotInstance?.id) {
      await markRobotInstanceErrorIfUnanswered({
        instanceId: activeRobotInstance.id,
        siteId,
        errorMessage: error instanceof Error ? error.message : 'Failed to start robot workflow',
        message: messageToSend,
      })
    }
    clearThinkingState()
    clearNewMakinaThinking()
    toast({
      title: 'Error',
      description: 'Failed to start robot workflow. Please try again.',
      variant: 'destructive',
    })
  }
}
