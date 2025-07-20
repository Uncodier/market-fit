import { useCallback, useRef, useEffect } from 'react'

interface TypingMetrics {
  lastKeystroke: number
  typingSpeed: number
  avgInterval: number
  burstMode: boolean
}

interface UseAdaptiveDebounceProps {
  onUpdate: (value: string) => void
  minDelay?: number
  maxDelay?: number
  burstThreshold?: number
}

export function useAdaptiveDebounce({
  onUpdate,
  minDelay = 8,
  maxDelay = 150,
  burstThreshold = 5
}: UseAdaptiveDebounceProps) {
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const metricsRef = useRef<TypingMetrics>({
    lastKeystroke: 0,
    typingSpeed: 0,
    avgInterval: 100,
    burstMode: false
  })
  const keystrokeHistoryRef = useRef<number[]>([])
  
  const adaptiveUpdate = useCallback((value: string) => {
    const now = Date.now()
    const metrics = metricsRef.current
    
    // Update keystroke history
    keystrokeHistoryRef.current.push(now)
    
    // Keep only last 10 keystrokes for calculation
    if (keystrokeHistoryRef.current.length > 10) {
      keystrokeHistoryRef.current.shift()
    }
    
    // Calculate typing metrics
    if (keystrokeHistoryRef.current.length >= 2) {
      const history = keystrokeHistoryRef.current
      const timespan = history[history.length - 1] - history[0]
      const charCount = history.length - 1
      
      metrics.typingSpeed = (charCount / timespan) * 1000
      metrics.avgInterval = timespan / charCount
      metrics.burstMode = metrics.typingSpeed > burstThreshold
    }
    
    // Calculate adaptive delay based on typing pattern
    let delay = minDelay
    
    if (metrics.burstMode) {
      delay = minDelay
    } else if (metrics.typingSpeed < 1) {
      delay = Math.min(maxDelay, metrics.avgInterval * 0.8)
    } else {
      const speedFactor = Math.max(0.1, 1 - (metrics.typingSpeed / burstThreshold))
      delay = minDelay + (maxDelay - minDelay) * speedFactor
    }
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Set new timeout with adaptive delay
    timeoutRef.current = setTimeout(() => {
      onUpdate(value)
    }, delay)
    
    metrics.lastKeystroke = now
  }, [onUpdate, minDelay, maxDelay, burstThreshold])
  
  const immediateUpdate = useCallback((value: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onUpdate(value)
  }, [onUpdate])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return {
    adaptiveUpdate,
    immediateUpdate,
    getMetrics: () => metricsRef.current
  }
} 