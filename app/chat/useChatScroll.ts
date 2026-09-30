"use client"

import { useCallback, useEffect, useRef } from "react"
import type { ChatMessage } from "@/app/types/chat"

export function useChatScroll(
  conversationId: string,
  chatMessages: ChatMessage[],
  isAgentResponding: boolean,
) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const userJustSentRef = useRef(false)
  const prevConversationIdRef = useRef<string>("")
  const prevAgentRespondingRef = useRef(false)

  // Scroll to the bottom of the messages container
  const scrollToBottom = useCallback((instant = false) => {
    const container = messagesContainerRef.current
    if (!container) return

    container.scrollTo({
      top: container.scrollHeight,
      behavior: instant ? "auto" : "smooth",
    })
    isNearBottomRef.current = true
  }, [])

  // Track scroll position to know if user is near the bottom
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
      isNearBottomRef.current = distanceFromBottom < 150
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => container.removeEventListener("scroll", handleScroll)
  }, [])

  // Scroll to bottom: instant when switching conversations, smart when messages update
  useEffect(() => {
    const conversationChanged = prevConversationIdRef.current !== conversationId
    prevConversationIdRef.current = conversationId

    // Only react to isAgentResponding when it turns ON (false → true), not on every change
    const agentJustStarted = isAgentResponding && !prevAgentRespondingRef.current
    prevAgentRespondingRef.current = isAgentResponding

    if (conversationChanged) {
      userJustSentRef.current = false
      scrollToBottom(true)
      return
    }

    // For new messages or agent starting to respond: only scroll if near bottom or user just sent
    const userJustSent = userJustSentRef.current
    if (userJustSent) {
      userJustSentRef.current = false
    }

    const shouldScroll = isNearBottomRef.current || userJustSent || agentJustStarted
    if (shouldScroll) {
      scrollToBottom()
    }
  }, [chatMessages, isAgentResponding, conversationId, scrollToBottom])

  return { messagesEndRef, messagesContainerRef, userJustSentRef }
}
