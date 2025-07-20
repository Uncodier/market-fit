import { useEffect, useRef, useState, useCallback } from 'react'

interface PerformanceMetrics {
  averageFPS: number
  memoryUsage: number
  renderTime: number
  isHighPerformance: boolean
  isLowEndDevice: boolean
}

interface UsePerformanceMonitorReturn extends PerformanceMetrics {
  measureRender: (callback: () => void) => void
  optimizationLevel: 'low' | 'medium' | 'high'
}

export function usePerformanceMonitor(): UsePerformanceMonitorReturn {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    averageFPS: 60,
    memoryUsage: 0,
    renderTime: 0,
    isHighPerformance: true,
    isLowEndDevice: false
  })

  const fpsCounterRef = useRef({ frames: 0, lastTime: 0, fps: 60 })
  const renderTimesRef = useRef<number[]>([])
  
  // FPS monitoring
  useEffect(() => {
    let animationId: number
    
    const measureFPS = () => {
      const now = performance.now()
      const counter = fpsCounterRef.current
      
      counter.frames++
      
      if (now - counter.lastTime >= 1000) {
        counter.fps = (counter.frames * 1000) / (now - counter.lastTime)
        counter.frames = 0
        counter.lastTime = now
        
        setMetrics(prev => ({
          ...prev,
          averageFPS: counter.fps,
          isHighPerformance: counter.fps >= 55,
          isLowEndDevice: counter.fps < 30
        }))
      }
      
      animationId = requestAnimationFrame(measureFPS)
    }
    
    animationId = requestAnimationFrame(measureFPS)
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [])
  
  // Memory monitoring (if available)
  useEffect(() => {
    const updateMemoryUsage = () => {
      if ('memory' in performance && (performance as any).memory) {
        const memory = (performance as any).memory
        const usedMB = memory.usedJSHeapSize / 1024 / 1024
        
        setMetrics(prev => ({
          ...prev,
          memoryUsage: usedMB
        }))
      }
    }
    
    // Update memory usage every 5 seconds
    const interval = setInterval(updateMemoryUsage, 5000)
    updateMemoryUsage() // Initial measurement
    
    return () => clearInterval(interval)
  }, [])
  
  // Render time measurement
  const measureRender = useCallback((callback: () => void) => {
    const startTime = performance.now()
    
    callback()
    
    // Measure after next paint
    requestAnimationFrame(() => {
      const endTime = performance.now()
      const renderTime = endTime - startTime
      
      renderTimesRef.current.push(renderTime)
      
      // Keep only last 10 measurements
      if (renderTimesRef.current.length > 10) {
        renderTimesRef.current.shift()
      }
      
      // Calculate average render time
      const avgRenderTime = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length
      
      setMetrics(prev => ({
        ...prev,
        renderTime: avgRenderTime
      }))
    })
  }, [])
  
  // Determine optimization level based on performance
  const optimizationLevel = (() => {
    if (metrics.isLowEndDevice || metrics.averageFPS < 30) {
      return 'high' // Maximum optimizations for low-end devices
    } else if (metrics.averageFPS < 55 || metrics.memoryUsage > 100) {
      return 'medium' // Moderate optimizations
    } else {
      return 'low' // Minimal optimizations for high-performance devices
    }
  })()
  
  return {
    ...metrics,
    measureRender,
    optimizationLevel
  }
} 