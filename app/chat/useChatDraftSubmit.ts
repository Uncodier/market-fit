"use client"

import { useCallback, useEffect, useRef } from 'react'
import type { FormEvent, MutableRefObject } from 'react'
import { toast } from 'react-hot-toast'

interface ChatDraftSubmitProps {
  conversationId: string
  messageRef: MutableRefObject<string>
  clearMessage: () => void
  handleSendMessage: (message: string) => Promise<boolean>
  userJustSentRef: MutableRefObject<boolean>
}

export function useChatDraftSubmit({
  conversationId, messageRef, clearMessage, handleSendMessage, userJustSentRef,
}: ChatDraftSubmitProps) {
  const activeConversationRef = useRef<string | null>(conversationId)
  useEffect(() => {
    activeConversationRef.current = conversationId
    return () => { activeConversationRef.current = null }
  }, [conversationId])

  return useCallback(async (event: FormEvent) => {
    event.preventDefault()
    const draft = messageRef.current
    if (!draft.trim()) return

    userJustSentRef.current = true
    try {
      const consumed = await handleSendMessage(draft.trim())
      // Do not clear a newer draft or another conversation after a slow response.
      if (consumed === true && activeConversationRef.current === conversationId && messageRef.current === draft) {
        clearMessage()
      }
    } catch {
      // Send operations normally report errors themselves; preserve the draft if
      // an unexpected rejection escapes rather than leaving an unhandled promise.
      toast.error('Message acceptance could not be confirmed. Your draft has been kept.')
    }
  }, [conversationId, messageRef, clearMessage, handleSendMessage, userJustSentRef])
}