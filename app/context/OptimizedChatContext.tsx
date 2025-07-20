"use client"

import React, { createContext, useContext, useCallback, useMemo, useRef, memo } from 'react'

interface OptimizedChatContextValue {
  // Stable refs for performance-critical operations
  messageRef: React.MutableRefObject<string>
  isLoadingRef: React.MutableRefObject<boolean>
  
  // Memoized handlers
  handleSendMessage: (message: string) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent) => void
  
  // Layout state
  isChatListCollapsed: boolean
  toggleChatList: () => void
  
  // Conversation state
  conversationId: string
  isAgentOnlyConversation: boolean
}

const OptimizedChatContext = createContext<OptimizedChatContextValue | null>(null)

interface OptimizedChatProviderProps {
  children: React.ReactNode
  messageRef: React.MutableRefObject<string>
  isLoadingRef: React.MutableRefObject<boolean>
  handleSendMessage: (message: string) => Promise<void>
  handleKeyDown: (e: React.KeyboardEvent) => void
  isChatListCollapsed: boolean
  toggleChatList: () => void
  conversationId: string
  isAgentOnlyConversation: boolean
}

export const OptimizedChatProvider = memo(function OptimizedChatProvider({
  children,
  messageRef,
  isLoadingRef,
  handleSendMessage,
  handleKeyDown,
  isChatListCollapsed,
  toggleChatList,
  conversationId,
  isAgentOnlyConversation
}: OptimizedChatProviderProps) {
  
  // Memoize the context value to prevent unnecessary re-renders of consumers
  const contextValue = useMemo(() => ({
    messageRef,
    isLoadingRef,
    handleSendMessage,
    handleKeyDown,
    isChatListCollapsed,
    toggleChatList,
    conversationId,
    isAgentOnlyConversation
  }), [
    messageRef,
    isLoadingRef,
    handleSendMessage,
    handleKeyDown,
    isChatListCollapsed,
    toggleChatList,
    conversationId,
    isAgentOnlyConversation
  ])

  return (
    <OptimizedChatContext.Provider value={contextValue}>
      {children}
    </OptimizedChatContext.Provider>
  )
})

export function useOptimizedChat() {
  const context = useContext(OptimizedChatContext)
  if (!context) {
    throw new Error('useOptimizedChat must be used within an OptimizedChatProvider')
  }
  return context
} 