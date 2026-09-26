import { createClient } from '@/lib/supabase/client'
import { contextService, type SelectedContextIds } from '@/app/services/context-service'
import { getSystemPromptForActivity } from '../utils'
import { ImageParameters, VideoParameters, AudioParameters } from '../types'
import { type SkillSelection } from '../components/SkillSelector'
import { withTimeout } from '@/app/services/request-timeout'
import { assistantAdmissionNotification, getAssistantAdmissionFailure } from './assistant-admission-error'
import {
  persistUserActionLog,
  markRobotInstanceErrorIfUnanswered,
  postWithRetry,
  createRequestId,
} from './send-message-reliability'

type ToastFn = (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void

// Error telemetry must never delay the error shown to the person sending.
function recordSendFailure(params: Parameters<typeof markRobotInstanceErrorIfUnanswered>[0]) {
  void Promise.resolve().then(() => markRobotInstanceErrorIfUnanswered(params)).catch(() => {
    console.warn('Could not record the failed send.')
  })
}

export async function sendAssistantMessage(params: {
  messageToSend: string
  siteId: string
  selectedActivity: string
  selectedContext: SelectedContextIds
  skillSelection: SkillSelection
  activeRobotInstance?: { id?: string } | null
  imageParameters?: ImageParameters
  videoParameters?: VideoParameters
  audioParameters?: AudioParameters
  toast: ToastFn
}): Promise<boolean> {
  const {
    messageToSend,
    siteId,
    selectedActivity,
    selectedContext,
    skillSelection,
    activeRobotInstance,
    imageParameters,
    videoParameters,
    audioParameters,
    toast,
  } = params

  const requestId = createRequestId()
  try {
    const contextData = await withTimeout(
      contextService.getContextData(selectedContext, siteId), 15_000,
      'Loading the selected context timed out. Please try again.',
    )

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
    contextObj.selected_context = selectedContext

    if (contextObj.parameters.expectedResults !== undefined) {
      delete contextObj.parameters.expectedResults
    }

    const requestPayload: any = {
      message: messageToSend,
      site_id: siteId,
      context: JSON.stringify(contextObj),
      system_prompt: getSystemPromptForActivity(selectedActivity, {
        imageParameters,
        videoParameters,
        audioParameters,
      }),
      expected_results_amount: expectedResults,
      request_id: requestId,
      // The authenticated API owns durable user logs, including persistence failures.
      client_persisted: false,
      activity: selectedActivity,
      skill_mode: skillSelection.skill_mode,
      skill_slugs: skillSelection.skill_slugs,
    }

    const instanceId = activeRobotInstance?.id
    if (instanceId) {
      requestPayload.instance_id = instanceId
    }

    const response = await postWithRetry('/api/robots/instance/assistant', requestPayload, {
      instanceId,
      message: messageToSend,
      requestId,
    })

    if (response.success) return true

    const admissionFailure = getAssistantAdmissionFailure(response)
    if (admissionFailure) {
      toast(assistantAdmissionNotification(admissionFailure))
      return false
    }

    toast({ title: 'Error', description: response.error?.message || 'The assistant request failed. Please try again.', variant: 'destructive' })
    if (instanceId && response.status !== 400 && response.retryable !== false) {
      recordSendFailure({
        instanceId,
        siteId,
        errorMessage: response.error?.message || 'Assistant request failed',
        message: messageToSend,
        requestId,
      })
    }
    return false
  } catch (error) {
    console.error('Error sending assistant message:', error)
    toast({ title: 'Error', description: error instanceof Error ? error.message : 'The assistant request failed. Please try again.', variant: 'destructive' })
    return false
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

  const requestId = createRequestId()
  try {
    const supabase = createClient()
    const { data: { user } } = await withTimeout<{ data: { user: { id: string } | null } }>(
      supabase.auth.getUser(), 10_000, 'Checking your session timed out. Please try again.',
    )
    const contextData = await withTimeout(contextService.getContextData(selectedContext, siteId), 15_000, 'Loading the selected context timed out. Please try again.')
    const robotContext = {
      ...selectedContext,
      record_diagrams: contextData.records
        .filter((record) => record.diagram)
        .map((record) => ({
          record_id: record.id,
          diagram: record.diagram,
        })),
      record_context_omitted_ids: contextData.recordContextOmittedIds,
    }
    let response

    if (activeRobotInstance?.id) {
      const isRobotRunning = ['running', 'active'].includes(activeRobotInstance.status || '')
      if (!isRobotRunning) {
        setThinkingStateWithTimeout()
        onMessageSent?.(true)
      }

      const promptPayload = {
        instance_id: activeRobotInstance.id,
        message: messageToSend,
        step_status: 'in_progress',
        site_id: siteId,
        context: JSON.stringify(robotContext),
        activity: 'robot',
        request_id: requestId,
        client_persisted: false,
      }

      const persisted = await withTimeout(persistUserActionLog({
        instanceId: activeRobotInstance.id,
        siteId,
        userId: user?.id,
        message: messageToSend,
        requestId,
        activity: 'robot',
      }), 5000, 'Saving the message timed out.').catch(() => null)
      promptPayload.client_persisted = Boolean(persisted?.id)

      response = await postWithRetry('/api/workflow/promptRobot', promptPayload, {
        instanceId: activeRobotInstance.id,
        message: messageToSend,
        requestId,
      })
    } else {
      setNewMakinaThinking()
      response = await postWithRetry('/api/workflow/startRobot', {
        site_id: siteId,
        user_id: user?.id,
        activity: 'robot',
        message: messageToSend,
        context: JSON.stringify(robotContext),
        request_id: requestId,
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

    clearThinkingState()
    clearNewMakinaThinking()
    toast({ title: 'Error', description: response.error?.message || 'Failed to start robot workflow. Please try again.', variant: 'destructive' })
    if (activeRobotInstance?.id && response.retryable !== false) {
      recordSendFailure({
        instanceId: activeRobotInstance.id,
        siteId,
        userId: user?.id,
        errorMessage: response.error?.message || 'Failed to start robot workflow',
        message: messageToSend,
        requestId,
      })
    }
  } catch (error) {
    console.error('Error starting robot workflow:', error)
    clearThinkingState()
    clearNewMakinaThinking()
    toast({
      title: 'Error',
      description: error instanceof Error ? error.message : 'Failed to start robot workflow. Please try again.',
      variant: 'destructive',
    })
  }
}
