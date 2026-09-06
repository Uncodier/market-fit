import { useState, useCallback, useRef, useEffect } from 'react'
import {
  CACHE_PERSIST_DEBOUNCE_MS,
  readInputCache,
  resizeComposerTextarea,
  writeInputCache,
} from './optimized-message-state-utils'

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
  const [message, setMessageState] = useState(() => {
    if (cacheKey) {
      const cached = readInputCache(cacheKey)
      if (cached !== null) return cached
    }
    return initialValue
  })
  const messageRef = useRef(message)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const cachePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistCache = useCallback((value: string, immediate = false) => {
    if (!cacheKey) return

    if (cachePersistRef.current) {
      clearTimeout(cachePersistRef.current)
      cachePersistRef.current = null
    }

    if (immediate) {
      writeInputCache(cacheKey, value)
      return
    }

    cachePersistRef.current = setTimeout(() => {
      writeInputCache(cacheKey, value)
      cachePersistRef.current = null
    }, CACHE_PERSIST_DEBOUNCE_MS)
  }, [cacheKey])

  // Update state when cacheKey changes
  useEffect(() => {
    if (!cacheKey) return

    const cached = readInputCache(cacheKey)
    const nextValue = cached !== null ? cached : initialValue
    messageRef.current = nextValue
    setMessageState(nextValue)
    if (textareaRef.current) {
      textareaRef.current.value = nextValue
      resizeComposerTextarea(textareaRef.current)
    }
  }, [cacheKey, initialValue])

  const applyValue = useCallback((newMessage: string, persistImmediately = true) => {
    messageRef.current = newMessage
    setMessageState(newMessage)
    persistCache(newMessage, persistImmediately)

    if (textareaRef.current) {
      textareaRef.current.value = newMessage
      resizeComposerTextarea(textareaRef.current)
    }
  }, [persistCache])

  // Sync from textarea to React state (explicit, not during typing)
  const syncMessage = useCallback(() => {
    if (!textareaRef.current) return
    applyValue(textareaRef.current.value)
  }, [applyValue])

  // Programmatic setter (for clearing, prompt chips, etc.)
  const setMessage = useCallback((newMessage: string) => {
    applyValue(newMessage)
  }, [applyValue])

  // Keep the native textarea as the source of truth while typing so the
  // messages view does not re-render on every keystroke.
  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    const previousLength = messageRef.current.length
    const newValue = textarea.value

    messageRef.current = newValue
    resizeComposerTextarea(textarea, { previousLength })
    persistCache(newValue)
  }, [persistCache])

  const clearMessage = useCallback(() => {
    applyValue("")
    textareaRef.current?.focus()
  }, [applyValue])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      resizeComposerTextarea(textarea)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (cachePersistRef.current) {
        clearTimeout(cachePersistRef.current)
        cachePersistRef.current = null
      }
      if (cacheKey) {
        writeInputCache(cacheKey, messageRef.current)
      }
    }
  }, [cacheKey])

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
