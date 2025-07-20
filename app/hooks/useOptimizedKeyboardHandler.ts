import { useCallback, useRef } from 'react'

interface UseOptimizedKeyboardHandlerProps {
  messageRef: React.MutableRefObject<string>
  isLoading: boolean
  onSendMessage: (e: React.FormEvent) => Promise<void>
}

export function useOptimizedKeyboardHandler({
  messageRef,
  isLoading,
  onSendMessage
}: UseOptimizedKeyboardHandlerProps) {
  
  const isProcessingRef = useRef(false)
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Prevent multiple rapid fire sends
    if (isProcessingRef.current) {
      return
    }
    
    // Handle Enter key for sending messages
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      
      const currentMessage = messageRef.current.trim()
      
      if (!currentMessage || isLoading) {
        return
      }
      
      // Use requestAnimationFrame to ensure smooth UI updates
      isProcessingRef.current = true
      
      requestAnimationFrame(async () => {
        try {
          // Create a synthetic form event
          const syntheticEvent = {
            preventDefault: () => {},
            target: e.target,
            currentTarget: e.currentTarget
          } as React.FormEvent
          
          await onSendMessage(syntheticEvent)
        } finally {
          isProcessingRef.current = false
        }
      })
    }
    
    // Allow Shift+Enter for line breaks (default behavior)
    if (e.key === 'Enter' && e.shiftKey && !e.ctrlKey) {
      // Don't prevent default - allow line break
      return
    }
    
    // Handle other keyboard shortcuts if needed
    if (e.key === 'Escape') {
      // Could be used to clear input or close dialogs
      e.preventDefault()
      // Add escape functionality if needed
    }
  }, [messageRef, isLoading, onSendMessage])
  
  return { handleKeyDown }
} 