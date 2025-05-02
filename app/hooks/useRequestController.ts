"use client"

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook to manage request cancellation when parameters change
 * Provides a utility for cancelling in-flight API requests when new ones are made
 * Particularly useful for dashboard widgets that need to refresh based on changing date ranges
 */
export function useRequestController() {
  // Keep track of active abort controllers by endpoint
  const controllersRef = useRef<Map<string, AbortController>>(new Map())
  
  /**
   * Get an AbortController signal for a specific endpoint
   * This will cancel any previous requests to the same endpoint
   */
  const getSignalForEndpoint = useCallback((endpoint: string): AbortSignal => {
    // Cancel previous request to this endpoint if it exists
    if (controllersRef.current.has(endpoint)) {
      console.log(`[RequestController] Cancelling previous request to ${endpoint}`)
      const prevController = controllersRef.current.get(endpoint)
      if (prevController && !prevController.signal.aborted) {
        prevController.abort()
      }
    }
    
    // Create a new controller for this endpoint
    const controller = new AbortController()
    controllersRef.current.set(endpoint, controller)
    return controller.signal
  }, [])
  
  /**
   * Cancel all active requests
   */
  const cancelAllRequests = useCallback(() => {
    console.log(`[RequestController] Cancelling all requests (${controllersRef.current.size} active)`)
    controllersRef.current.forEach((controller, endpoint) => {
      if (!controller.signal.aborted) {
        console.log(`[RequestController] Cancelling request to ${endpoint}`)
        controller.abort()
      }
    })
    controllersRef.current.clear()
  }, [])
  
  /**
   * Create a fetch function that utilizes our abort controllers
   */
  const fetchWithController = useCallback(async (url: string, options?: RequestInit) => {
    // Determine endpoint from URL (strip query parameters)
    const endpoint = url.split('?')[0]
    
    // Get signal for this endpoint (cancels previous requests)
    const signal = getSignalForEndpoint(endpoint)
    
    // Create new request options with our signal
    const requestOptions: RequestInit = {
      ...options,
      signal
    }
    
    try {
      return await fetch(url, requestOptions)
    } catch (error) {
      // Rethrow unless it's an abort error (which we can ignore)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log(`[RequestController] Request to ${endpoint} was aborted`)
        // Return null for aborted requests
        return null
      }
      throw error
    }
  }, [getSignalForEndpoint])
  
  // Clean up by cancelling all requests when component unmounts
  useEffect(() => {
    return () => {
      cancelAllRequests()
    }
  }, [cancelAllRequests])
  
  return {
    getSignalForEndpoint,
    cancelAllRequests,
    fetchWithController
  }
} 