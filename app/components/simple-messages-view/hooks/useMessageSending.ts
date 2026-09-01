import { useState, useRef, useEffect, useCallback } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { useToast } from '@/app/components/ui/use-toast'
import { type SelectedContextIds } from '@/app/services/context-service'
import { ImageParameters, VideoParameters, AudioParameters } from '../types'
import { sendAssistantMessage, sendRobotMessage } from './message-send-handlers'

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

  const handleAssistantMessage = useCallback(async (messageToSend: string) => {
    if (!currentSite?.id) return
    await sendAssistantMessage({
      messageToSend,
      siteId: currentSite.id,
      selectedActivity,
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

  const handleSendMessage = useCallback(async () => {
    const currentMessage = typeof messageRef.current === 'string' ? messageRef.current : ''
    if (!currentMessage.trim() || !currentSite?.id || sendingLockRef.current || isSendingMessage) return

    const messageToSend = currentMessage.trim()
    sendingLockRef.current = true

    const requestId = Date.now().toString()
    activeRequestIdRef.current = requestId

    setIsSendingMessage(true)
    onClearMessage?.()

    const safetyUnlockTimeout = setTimeout(() => {
      if (activeRequestIdRef.current === requestId) {
        console.warn('⏰ Send safety timeout reached, unlocking send button')
        sendingLockRef.current = false
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }, 35000)

    if (!activeRobotInstance) {
      setNewMakinaThinking()
      setHasMessageBeenSent(true)
      onMessageSent?.(true)
    } else {
      onAddOptimisticMessage?.(messageToSend)
      setThinkingStateWithTimeout()
    }

    try {
      if (selectedActivity === 'robot') {
        await handleRobotMessageRef.current(messageToSend)
      } else {
        await handleAssistantMessageRef.current(messageToSend)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      if (!activeRobotInstance) {
        clearNewMakinaThinking()
      } else {
        clearThinkingState()
      }
    } finally {
      clearTimeout(safetyUnlockTimeout)
      sendingLockRef.current = false
      if (activeRequestIdRef.current === requestId) {
        setIsSendingMessage(false)
        activeRequestIdRef.current = null
      }
    }
  }, [
    currentSite?.id,
    isSendingMessage,
    activeRobotInstance,
    selectedActivity,
    onClearMessage,
    setNewMakinaThinking,
    onMessageSent,
    onAddOptimisticMessage,
    setThinkingStateWithTimeout,
    clearNewMakinaThinking,
    clearThinkingState,
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
