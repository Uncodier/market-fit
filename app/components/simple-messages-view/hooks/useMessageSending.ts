import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'
import { type SelectedContextIds } from '@/app/services/context-service'
import { ImageParameters, VideoParameters, AudioParameters, InstanceLog } from '../types'
import { sendAssistantMessage, sendRobotMessage } from './message-send-handlers'
import { type SkillSelection } from '../components/SkillSelector'
import { findRunningUserLog } from './useRunningWorkflow'
import { shouldQueueCommand } from './command-queue'
import { buildPendingWorkPayload, enqueuePendingWork } from './pending-work'

interface UseMessageSendingProps {
  activeRobotInstance?: any
  selectedActivity: string
  selectedContext: SelectedContextIds
  skillSelection: SkillSelection
  messageRef: React.MutableRefObject<string>
  logsRef?: MutableRefObject<InstanceLog[]>
  onMessageSent?: (hasMessageBeenSent: boolean) => void
  onClearMessage?: () => void
  onScrollToBottom?: () => void
  onNewInstanceCreated?: (instanceId: string, shouldNavigate?: boolean) => void
  startInstancePolling?: (activityName: string, instanceId?: string, shouldAutoNavigate?: boolean) => Promise<void>
  onAddOptimisticMessage?: (message: string, extraDetails?: Record<string, unknown>) => void
  onPendingEnqueued?: () => void
  imageParameters?: ImageParameters
  videoParameters?: VideoParameters
  audioParameters?: AudioParameters
}

export const useMessageSending = ({
  activeRobotInstance,
  selectedActivity,
  selectedContext,
  skillSelection,
  messageRef,
  logsRef,
  onMessageSent,
  onClearMessage,
  onNewInstanceCreated,
  startInstancePolling,
  onAddOptimisticMessage,
  onPendingEnqueued,
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
  const activeRequestIdRef = useRef<string | null>(null)
  const sendingLockRef = useRef(false)
  const sendingMessageRef = useRef<string | null>(null)
  const loadingInstanceIdRef = useRef<string | null>(null)
  const { currentSite } = useSite()
  const { toast } = useToast()
  const sendScope = `${currentSite?.id || ''}:${activeRobotInstance?.id || ''}`
  const sendScopeRef = useRef(sendScope)
  sendScopeRef.current = sendScope

  const clearThinkingState = useCallback(() => {
    const currentInstanceId = activeRobotInstance?.id
    if (loadingInstanceIdRef.current !== null && loadingInstanceIdRef.current !== currentInstanceId) {
      return
    }

    setIsWaitingForResponse(false)
    setIsSendingMessage(false)
    setWaitingForMessageId(null)
    loadingInstanceIdRef.current = null

    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }
  }, [activeRobotInstance?.id])

  const setNewMakinaThinking = useCallback(() => {
    loadingInstanceIdRef.current = null
    setIsNewMakinaThinking(true)
  }, [])

  const clearNewMakinaThinking = useCallback(() => {
    if (loadingInstanceIdRef.current !== null && activeRobotInstance?.id) {
      return
    }

    setIsNewMakinaThinking(false)
    setIsSendingMessage(false)
    loadingInstanceIdRef.current = null
  }, [activeRobotInstance?.id])

  const setThinkingStateWithTimeout = useCallback(() => {
    const currentInstanceId = activeRobotInstance?.id
    if (!currentInstanceId) return

    loadingInstanceIdRef.current = currentInstanceId
    setIsWaitingForResponse(true)
    setWaitingForMessageId(`pending-${Date.now()}`)

    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
    }

    thinkingTimeoutRef.current = setTimeout(() => {
      if (selectedActivity !== 'robot' && sendingLockRef.current) return // Assistant owns its terminal state.
      if (loadingInstanceIdRef.current === currentInstanceId) {
        clearThinkingState()
        loadingInstanceIdRef.current = null
      }
    }, 5 * 60 * 1000)
  }, [activeRobotInstance?.id, clearThinkingState, selectedActivity])

  const handleAssistantMessage = useCallback(async (messageToSend: string, activity = selectedActivity) => {
    if (!currentSite?.id) return
    const success = await sendAssistantMessage({
      messageToSend,
      siteId: currentSite.id,
      selectedActivity: activity,
      selectedContext,
      skillSelection,
      activeRobotInstance,
      imageParameters,
      videoParameters,
      audioParameters,
      toast,
    })
    // SSE completion is authoritative even if realtime log delivery was missed.
    clearThinkingState()
    clearNewMakinaThinking()
    return success
  }, [
    currentSite?.id,
    selectedActivity,
    selectedContext,
    skillSelection,
    activeRobotInstance,
    imageParameters,
    videoParameters,
    audioParameters,
    toast,
    clearThinkingState,
    clearNewMakinaThinking,
  ])

  const handleRobotMessage = useCallback(async (messageToSend: string) => {
    if (!currentSite?.id) return
    await sendRobotMessage({
      messageToSend,
      siteId: currentSite.id,
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
    })
  }, [
    currentSite?.id,
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
  ])

  const handleRobotMessageRef = useRef(handleRobotMessage)
  const handleAssistantMessageRef = useRef(handleAssistantMessage)
  handleRobotMessageRef.current = handleRobotMessage
  handleAssistantMessageRef.current = handleAssistantMessage

  const dispatchPreparedMessage = useCallback(async (messageToSend: string, activity: string) => {
    const requestId = Date.now().toString()
    activeRequestIdRef.current = requestId
    sendingLockRef.current = true
    sendingMessageRef.current = messageToSend
    setIsSendingMessage(true)

    // Temporal robot requests keep their existing unlock behavior; assistant
    // requests settle only when their bounded stream reaches a terminal state.
    const safetyUnlockTimeout = activity === 'robot' ? setTimeout(() => {
      if (activeRequestIdRef.current === requestId) {
        sendingLockRef.current = false
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }, 35000) : undefined

    // Keep the send lock until the bounded request settles, not just SSE headers.
    try {
      if (activity === 'robot') {
        await handleRobotMessageRef.current(messageToSend)
        return true
      } else {
        return await handleAssistantMessageRef.current(messageToSend, activity)
      }
    } finally {
      clearTimeout(safetyUnlockTimeout)
      if (activeRequestIdRef.current === requestId) {
        sendingLockRef.current = false
        sendingMessageRef.current = null
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }
  }, [])

  const handleSendMessage = useCallback(async () => {
    const currentMessage = typeof messageRef.current === 'string' ? messageRef.current : ''
    if (!currentMessage.trim() || !currentSite?.id) return

    const messageToSend = currentMessage.trim()
    // Assistant drafts stay visible until success; a second click must not queue
    // the unchanged in-flight message as an unintended replay.
    if (selectedActivity !== 'robot' && sendingLockRef.current && sendingMessageRef.current === messageToSend) return
    if (selectedActivity !== 'robot' && skillSelection.skill_mode === 'required' && skillSelection.skill_slugs.length === 0) {
      toast({ title: 'Select a skill', description: 'Choose at least one required skill before sending.', variant: 'destructive' })
      return
    }
    // A failed preflight can leave an optimistic row, but it is not a running workflow.
    const durableLogs = (logsRef?.current || []).filter(log => !log.details?.temp_message)
    const isBusy = shouldQueueCommand(Boolean(findRunningUserLog(durableLogs)) || sendingLockRef.current || isSendingMessage)

    if (isBusy && activeRobotInstance?.id) {
      if (selectedActivity !== 'robot' && skillSelection.skill_mode === 'required') {
        toast({ title: 'Wait to send', description: 'Required skills cannot be attached to queued commands. Wait for the current task to finish.', variant: 'destructive' })
        return
      }
      const payload = await buildPendingWorkPayload({
        siteId: currentSite.id,
        activity: selectedActivity,
        selectedContext,
        imageParameters,
        videoParameters,
        audioParameters,
      })
      const queued = await enqueuePendingWork({
        instanceId: activeRobotInstance.id,
        siteId: currentSite.id,
        userId: payload.userId,
        message: messageToSend,
        activity: selectedActivity,
        context: payload.context,
        systemPrompt: payload.systemPrompt,
      })
      if (!queued) {
        toast({
          title: 'Error',
          description: 'Failed to save the pending command.',
          variant: 'destructive',
        })
        return
      }
      onClearMessage?.()
      onPendingEnqueued?.()
      return
    }

    if (sendingLockRef.current || isSendingMessage) return

    if (!activeRobotInstance) {
      setNewMakinaThinking()
      setHasMessageBeenSent(true)
      onMessageSent?.(true)
    } else {
      if (selectedActivity === 'robot') {
        onAddOptimisticMessage?.(messageToSend, {
          status: 'running',
          request_type: selectedActivity,
          context: selectedContext,
        })
      }
      // Assistant user logs come from the API after admission. A rejected send
      // must not leave an optimistic row claiming that unsent work is running.
      setThinkingStateWithTimeout()
    }

    if (selectedActivity === 'robot') onClearMessage?.()

    try {
      const success = await dispatchPreparedMessage(messageToSend, selectedActivity)
      if (sendScopeRef.current !== sendScope) return
      if (selectedActivity !== 'robot' && success && messageRef.current === currentMessage) {
        onClearMessage?.()
      }
      if (!success && !activeRobotInstance) {
        setHasMessageBeenSent(false)
        onMessageSent?.(false)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({ title: 'Error', description: 'The message could not be sent. Please try again.', variant: 'destructive' })
      if (!activeRobotInstance) {
        setHasMessageBeenSent(false)
        onMessageSent?.(false)
        clearNewMakinaThinking()
      } else {
        clearThinkingState()
      }
    }
  }, [
    currentSite?.id,
    isSendingMessage,
    activeRobotInstance,
    selectedActivity,
    selectedContext,
    skillSelection,
    imageParameters,
    videoParameters,
    audioParameters,
    logsRef,
    toast,
    onClearMessage,
    setNewMakinaThinking,
    onMessageSent,
    onAddOptimisticMessage,
    onPendingEnqueued,
    setThinkingStateWithTimeout,
    clearNewMakinaThinking,
    clearThinkingState,
    dispatchPreparedMessage,
    messageRef,
    sendScope,
  ])

  const resetMessageSentState = useCallback(() => {
    setHasMessageBeenSent(false)
  }, [])

  useEffect(() => {
    const currentInstanceId = activeRobotInstance?.id || null

    if (loadingInstanceIdRef.current !== null && loadingInstanceIdRef.current !== currentInstanceId) {
      setIsWaitingForResponse(false)
      setWaitingForMessageId(null)
      setIsNewMakinaThinking(false)
      setIsSendingMessage(false)
      sendingLockRef.current = false
      loadingInstanceIdRef.current = null

      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current)
        thinkingTimeoutRef.current = null
      }
    }

    if (currentInstanceId) {
      loadingInstanceIdRef.current = currentInstanceId
    }
  }, [activeRobotInstance?.id])

  useEffect(() => {
    if (!activeRobotInstance) {
      setHasMessageBeenSent(false)
      setIsWaitingForResponse(false)
      setWaitingForMessageId(null)
      setIsNewMakinaThinking(false)
      setIsSendingMessage(false)
      sendingLockRef.current = false
      loadingInstanceIdRef.current = null

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
