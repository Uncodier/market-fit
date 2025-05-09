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
    // Check for future dates in URL which can cause infinite redirect loops
    if (url.includes('startDate=') || url.includes('endDate=')) {
      try {
        const parsedUrl = new URL(url, window.location.origin);
        const params = parsedUrl.searchParams;
        
        // Get and validate the dates
        const startDate = params.get('startDate');
        const endDate = params.get('endDate');
        const today = new Date();
        const currentYear = today.getFullYear();
        
        // Flag to track if URLs were changed
        let datesWereFixed = false;
        
        // Parse and validate the dates
        if (startDate) {
          const parsedStartDate = new Date(startDate);
          
          // Check specifically for years that are too far in the future (e.g. 2025 when it's 2023)
          // This catches the most common issue of the year being set incorrectly
          if (parsedStartDate.getFullYear() > currentYear) {
            console.error(`[RequestController] Future year detected in startDate: ${startDate} (year: ${parsedStartDate.getFullYear()}, current year: ${currentYear})`);
            
            // Create a corrected date with the current year instead
            const correctedDate = new Date(parsedStartDate);
            correctedDate.setFullYear(currentYear);
            
            // If it's still in the future after fixing the year, move back one year
            if (correctedDate > today) {
              correctedDate.setFullYear(currentYear - 1);
            }
            
            const formattedDate = correctedDate.toISOString().split('T')[0];
            console.log(`[RequestController] Corrected startDate year to: ${formattedDate}`);
            params.set('startDate', formattedDate);
            datesWereFixed = true;
          }
          // Also check for any future date, even if the year is current
          else if (parsedStartDate > today) {
            console.error(`[RequestController] Future start date detected: ${startDate}, using one year ago`);
            // Replace with a date one year ago from today
            const safeDate = new Date(today);
            safeDate.setFullYear(currentYear - 1);
            const formattedDate = safeDate.toISOString().split('T')[0];
            params.set('startDate', formattedDate);
            datesWereFixed = true;
          }
        }
        
        if (endDate) {
          const parsedEndDate = new Date(endDate);
          
          // Check for years that are too far in the future
          if (parsedEndDate.getFullYear() > currentYear) {
            console.error(`[RequestController] Future year detected in endDate: ${endDate} (year: ${parsedEndDate.getFullYear()}, current year: ${currentYear})`);
            
            // Create a corrected date with today's date instead
            const formattedDate = today.toISOString().split('T')[0];
            console.log(`[RequestController] Corrected endDate to today: ${formattedDate}`);
            params.set('endDate', formattedDate);
            datesWereFixed = true;
          }
          // Also check for any future date
          else if (parsedEndDate > today) {
            console.error(`[RequestController] Future end date detected: ${endDate}, using today`);
            // Replace with today
            const formattedDate = today.toISOString().split('T')[0];
            params.set('endDate', formattedDate);
            datesWereFixed = true;
          }
        }
        
        // Rebuild the URL with validated parameters if changes were made
        if (datesWereFixed) {
          const newUrl = `${parsedUrl.pathname}?${params.toString()}`;
          console.log(`[RequestController] URL with fixed dates: ${newUrl}`);
          url = newUrl;
        }
      } catch (error) {
        console.error("[RequestController] Error validating dates in URL:", error);
        // Continue with original URL if validation fails
      }
    }
    
    // Determine endpoint from URL (strip query parameters)
    const endpoint = url.split('?')[0];
    
    // Get signal for this endpoint (cancels previous requests)
    const signal = getSignalForEndpoint(endpoint);
    
    // Create new request options with our signal
    const requestOptions: RequestInit = {
      ...options,
      signal,
      headers: {
        ...(options?.headers || {}),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      redirect: 'manual' // Prevent automatic redirect following to avoid loops
    };
    
    try {
      // Add a random cache-busting parameter to avoid cache-related redirect loops
      const cacheBustUrl = url.includes('?') 
        ? `${url}&_=${Math.random().toString(36).substring(2, 10)}` 
        : `${url}?_=${Math.random().toString(36).substring(2, 10)}`;
      
      console.log(`[RequestController] Fetching with cache bust: ${cacheBustUrl}`);
      
      return await fetch(cacheBustUrl, requestOptions);
    } catch (error) {
      // Rethrow unless it's an abort error (which we can ignore)
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log(`[RequestController] Request to ${endpoint} was aborted`);
        // Return null for aborted requests
        return null;
      }
      
      // Log other errors but still throw them
      console.error(`[RequestController] Error in fetch:`, error);
      throw error;
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