import { useState, useCallback, useRef } from 'react'

interface UseSimpleMessageStateReturn {
  message: string
  setMessage: (message: string) => void
  messageRef: React.MutableRefObject<string>
  handleMessageChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  clearMessage: () => void
}

// Ultra-simple version for debugging character loss issues
export function useSimpleMessageState(initialValue = ""): UseSimpleMessageStateReturn {
  const [message, setMessage] = useState(initialValue)
  const messageRef = useRef(initialValue)
  
  // Direct change handler - no optimizations whatsoever
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    console.log('Character input:', value) // Debug logging
    messageRef.current = value
    setMessage(value)
  }, [])
  
  // Clear function
  const clearMessage = useCallback(() => {
    messageRef.current = ""
    setMessage("")
  }, [])
  
  return {
    message,
    setMessage: useCallback((value: string) => {
      messageRef.current = value
      setMessage(value)
    }, []),
    messageRef,
    handleMessageChange,
    clearMessage
  }
} 