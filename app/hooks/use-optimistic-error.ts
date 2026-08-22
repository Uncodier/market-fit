import { useState, useEffect, useRef } from "react"

export const OPTIMISTIC_ERROR_DELAY_MS = 8000
export const OPTIMISTIC_RETRY_COUNT = 3
export const OPTIMISTIC_RETRY_BASE_MS = 1000

export async function retryOnError<T>(
  fn: () => Promise<T>,
  attempts: number = OPTIMISTIC_RETRY_COUNT,
  baseDelayMs: number = OPTIMISTIC_RETRY_BASE_MS
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)))
      }
    }
  }

  throw lastError
}

/**
 * Delays exposing a load error so brief first-attempt failures do not flash in the UI.
 * The timer starts on the first truthy error and does not reset when the error identity changes.
 */
export function useOptimisticError<T>(
  error: T | null | undefined,
  delay: number = OPTIMISTIC_ERROR_DELAY_MS
): [T | null | undefined, boolean] {
  const [debouncedError, setDebouncedError] = useState<T | null | undefined>(undefined)
  const [isMaskingError, setIsMaskingError] = useState(false)
  const startedAtRef = useRef<number | null>(null)
  const revealedRef = useRef(false)

  useEffect(() => {
    if (!error) {
      startedAtRef.current = null
      revealedRef.current = false
      setDebouncedError(undefined)
      setIsMaskingError(false)
      return
    }

    if (delay <= 0 || revealedRef.current) {
      revealedRef.current = true
      setDebouncedError(error)
      setIsMaskingError(false)
      return
    }

    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now()
      setIsMaskingError(true)
    }

    const remaining = Math.max(delay - (Date.now() - startedAtRef.current), 0)
    const timer = setTimeout(() => {
      revealedRef.current = true
      setDebouncedError(error)
      setIsMaskingError(false)
    }, remaining)

    return () => clearTimeout(timer)
  }, [error, delay])

  return [debouncedError, isMaskingError]
}

export function useOptimisticLoadState(isLoading: boolean, error: unknown, delay?: number) {
  const [debouncedError, isMaskingError] = useOptimisticError(error, delay)

  return {
    error: debouncedError,
    isLoading: isLoading || isMaskingError,
  }
}
