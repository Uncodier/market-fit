/**
 * Fetches data with automatic retry logic and proper error handling
 * Keeps loading state during retries and returns null on failure (so widgets show default 0 values)
 */

interface FetchWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  initialDelay?: number;
}

/**
 * Wraps fetchWithController with retry logic
 * @param fetchWithController - The fetch function from useRequestController hook
 * @param url - URL to fetch
 * @param options - Retry configuration
 * @returns Response object on success, null on failure or cancellation
 */
export async function fetchWithRetry(
  fetchWithController: (url: string, options?: RequestInit) => Promise<Response | null>,
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response | null> {
  const { maxRetries = 3, retryDelay = 1000, initialDelay = 500 } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithController(url);
      
      // Request was cancelled (aborted) - return null immediately, no retry
      if (!response) {
        return null;
      }
      
      // Request succeeded
      if (response.ok) {
        return response;
      }
      
      // HTTP error - retry if we have attempts left
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[fetchWithRetry] HTTP error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // All retries exhausted
      console.error(`[fetchWithRetry] All retries exhausted for ${url}, status: ${response.status}`);
      return null;
      
    } catch (error) {
      // Network or other errors - retry if we have attempts left
      if (attempt < maxRetries) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`[fetchWithRetry] Error occurred, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // All retries exhausted
      console.error(`[fetchWithRetry] All retries exhausted for ${url}:`, error);
      return null;
    }
  }
  
  // Should never reach here, but just in case
  return null;
}










