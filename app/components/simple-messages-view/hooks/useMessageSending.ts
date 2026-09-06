import { useState, useRef, useEffect, useCallback, type MutableRefObject } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'
import { type SelectedContextIds } from '@/app/services/context-service'
import { ImageParameters, VideoParameters, AudioParameters, InstanceLog } from '../types'
import { sendAssistantMessage, sendRobotMessage } from './message-send-handlers'
import { findRunningUserLog } from './useRunningWorkflow'
import { shouldQueueCommand } from './command-queue'
import { buildPendingWorkPayload, enqueuePendingWork } from './pending-work'

interface UseMessageSendingProps {
  activeRobotInstance?: any
  selectedActivity: string
  selectedContext: SelectedContextIds
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
  const loadingInstanceIdRef = useRef<string | null>(null)
  const { currentSite } = useSite()
  const { toast } = useToast()

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

    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
    }

    thinkingTimeoutRef.current = setTimeout(() => {
      if (loadingInstanceIdRef.current === currentInstanceId) {
        clearThinkingState()
        loadingInstanceIdRef.current = null
      }
    }, 30000)
  }, [activeRobotInstance?.id, clearThinkingState])

  const handleAssistantMessage = useCallback(async (messageToSend: string, activity = selectedActivity) => {
    if (!currentSite?.id) return
    await sendAssistantMessage({
      messageToSend,
      siteId: currentSite.id,
      selectedActivity: activity,
      selectedContext,
      activeRobotInstance,
      imageParameters,
      videoParameters,
      audioParameters,
      toast,
    })
  }, [
    currentSite?.id,
    selectedActivity,
    selectedContext,
    activeRobotInstance,
    imageParameters,
    videoParameters,
    audioParameters,
    toast,
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
    setIsSendingMessage(true)

    const safetyUnlockTimeout = setTimeout(() => {
      if (activeRequestIdRef.current === requestId) {
        sendingLockRef.current = false
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }, 35000)

    try {
      if (activity === 'robot') {
        await handleRobotMessageRef.current(messageToSend)
      } else {
        await handleAssistantMessageRef.current(messageToSend, activity)
      }
    } finally {
      clearTimeout(safetyUnlockTimeout)
      sendingLockRef.current = false
      if (activeRequestIdRef.current === requestId) {
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }
  }, [])

  const handleSendMessage = useCallback(async () => {
    const currentMessage = typeof messageRef.current === 'string' ? messageRef.current : ''
    if (!currentMessage.trim() || !currentSite?.id) return

    const messageToSend = currentMessage.trim()
    const isBusy = shouldQueueCommand(Boolean(findRunningUserLog(logsRef?.current || [])) || sendingLockRef.current || isSendingMessage)

    if (isBusy && activeRobotInstance?.id) {
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
      onAddOptimisticMessage?.(messageToSend, {
        status: 'running',
        request_type: selectedActivity,
        context: selectedContext,
      })
      setThinkingStateWithTimeout()
    }

    onClearMessage?.()

    try {
      await dispatchPreparedMessage(messageToSend, selectedActivity)
    } catch (error) {
      console.error('Error sending message:', error)
      if (!activeRobotInstance) {
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
