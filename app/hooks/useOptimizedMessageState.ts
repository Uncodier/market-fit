import { useState, useCallback, useRef, useEffect } from 'react'

interface UseOptimizedMessageStateReturn {
  message: string
  setMessage: (message: string) => void
  messageRef: React.MutableRefObject<string>
  handleMessageChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  clearMessage: () => void
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>
  syncMessage: () => void
}

export function useOptimizedMessageState(initialValue = "", cacheKey?: string): UseOptimizedMessageStateReturn {
  // Initialize from cache if cacheKey is provided
  const [message, setMessageState] = useState(() => {
    if (cacheKey && typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem(`input-cache-${cacheKey}`)
        if (cached !== null) {
          return JSON.parse(cached)
        }
      } catch (e) {
        console.warn('Error reading from localStorage cache', e)
      }
    }
    return initialValue
  })
  const messageRef = useRef(message)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  
  // Update state when cacheKey changes
  useEffect(() => {
    if (cacheKey && typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem(`input-cache-${cacheKey}`)
        if (cached !== null) {
          const parsed = JSON.parse(cached)
          messageRef.current = parsed
          setMessageState(parsed)
          if (textareaRef.current) {
            textareaRef.current.value = parsed
            // Request auto-resize
            setTimeout(() => {
              if (textareaRef.current) {
                // Manually trigger resize
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 135), 300)}px`
              }
            }, 0)
          }
        } else {
          messageRef.current = initialValue
          setMessageState(initialValue)
          if (textareaRef.current) {
            textareaRef.current.value = initialValue
          }
        }
      } catch (e) {
        console.warn('Error reading from localStorage cache on key change', e)
      }
    }
  }, [cacheKey, initialValue])
  
  // Auto-resize function - pure DOM manipulation for performance
  const autoResize = useCallback((textarea: HTMLTextAreaElement) => {
    // Reset height to measure scrollHeight accurately
    textarea.style.height = 'auto'
    
    // Calculate new height
    const scrollHeight = textarea.scrollHeight
    const minHeight = 135 // Match the original h-[135px]
    const maxHeight = 300 // Maximum height before scrolling
    
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    
    // Apply new height
    textarea.style.height = `${newHeight}px`
    
    // Enable/disable scrolling based on content
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto'
    } else {
      textarea.style.overflowY = 'hidden'
    }
  }, [])
  
  // Sync from textarea to React state periodically
  const syncMessage = useCallback(() => {
    if (textareaRef.current) {
      const currentValue = textareaRef.current.value
      messageRef.current = currentValue
      setMessageState(currentValue)
      
      if (cacheKey && typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`input-cache-${cacheKey}`, JSON.stringify(currentValue))
        } catch (e) {
          console.warn('Error saving to localStorage cache', e)
        }
      }
    }
  }, [cacheKey])
  
  // Programmatic setter (for clearing, etc.)
  const setMessage = useCallback((newMessage: string) => {
    messageRef.current = newMessage
    setMessageState(newMessage)
    
    if (cacheKey && typeof window !== 'undefined') {
      try {
        if (!newMessage) {
          window.localStorage.removeItem(`input-cache-${cacheKey}`)
        } else {
          window.localStorage.setItem(`input-cache-${cacheKey}`, JSON.stringify(newMessage))
        }
      } catch (e) {
        console.warn('Error saving to localStorage cache', e)
      }
    }

    if (textareaRef.current) {
      textareaRef.current.value = newMessage
      // Auto-resize after programmatic change
      autoResize(textareaRef.current)
    }
  }, [autoResize, cacheKey])
  
  // PERFORMANCE-FIRST: Update ref immediately, minimal debounce for React state
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    const newValue = textarea.value
    
    // 1. Update ref immediately (always current, no re-render)
    messageRef.current = newValue
    
    // 2. Auto-resize immediately for smooth UX
    autoResize(textarea)
    
    // 3. Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Save to cache immediately but without blocking React thread
    if (cacheKey && typeof window !== 'undefined') {
      try {
        if (!newValue) {
          window.localStorage.removeItem(`input-cache-${cacheKey}`)
        } else {
          window.localStorage.setItem(`input-cache-${cacheKey}`, JSON.stringify(newValue))
        }
      } catch (e) {
        console.warn('Error saving to localStorage cache', e)
      }
    }
    
    // 4. Minimal debounce for React state (only for non-critical UI updates)
    debounceRef.current = setTimeout(() => {
      setMessageState(newValue)
    }, 50) // Much shorter delay for better responsiveness
    
  }, [autoResize, cacheKey])
  
  // Clear function
  const clearMessage = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    messageRef.current = ""
    setMessageState("")
    
    if (cacheKey && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`input-cache-${cacheKey}`)
      } catch (e) {
        console.warn('Error removing from localStorage cache', e)
      }
    }

    if (textareaRef.current) {
      textareaRef.current.value = ""
      // Reset height when clearing
      autoResize(textareaRef.current)
      textareaRef.current.focus()
    }
  }, [autoResize, cacheKey])
  
  // Setup auto-resize on mount
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Set initial height
      autoResize(textarea)
      
      // Add native input event listener for additional auto-resize triggers
      const handleInput = () => autoResize(textarea)
      textarea.addEventListener('input', handleInput)
      
      return () => {
        textarea.removeEventListener('input', handleInput)
      }
    }
  }, [autoResize])
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])
  
  return {
    message,
    setMessage,
    messageRef,
    handleMessageChange,
    clearMessage,
    textareaRef,
    syncMessage
  }
} 