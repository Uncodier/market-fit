import { useState, useCallback, useMemo, useRef } from 'react'

interface Message {
  id: string
  content: string
  timestamp: string
  sender: string
}

interface UseVirtualizedMessagesProps {
  messages: Message[]
  containerHeight: number
  itemHeight: number
  overscan?: number
}

export function useVirtualizedMessages({
  messages,
  containerHeight,
  itemHeight,
  overscan = 3
}: UseVirtualizedMessagesProps) {
  
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      messages.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    
    return { startIndex, endIndex }
  }, [scrollTop, containerHeight, itemHeight, overscan, messages.length])
  
  // Get visible messages
  const visibleMessages = useMemo(() => {
    const { startIndex, endIndex } = visibleRange
    return messages.slice(startIndex, endIndex + 1).map((message, index) => ({
      ...message,
      virtualIndex: startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        width: '100%'
      }
    }))
  }, [messages, visibleRange, itemHeight])
  
  // Total height for scroll container
  const totalHeight = messages.length * itemHeight
  
  // Optimized scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    setScrollTop(target.scrollTop)
  }, [])
  
  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = totalHeight
    }
  }, [totalHeight])
  
  // Smooth scroll to specific message
  const scrollToMessage = useCallback((messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId)
    if (messageIndex !== -1 && containerRef.current) {
      const targetScrollTop = messageIndex * itemHeight
      containerRef.current.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      })
    }
  }, [messages, itemHeight])
  
  return {
    containerRef,
    visibleMessages,
    totalHeight,
    handleScroll,
    scrollToBottom,
    scrollToMessage,
    isScrolledToBottom: scrollTop + containerHeight >= totalHeight - 10
  }
} 