/**
 * Fetches data with automatic retry logic and proper error handling
 * Keeps loading state during retries and returns null on failure (so widgets show default 0 values)
 */

interface FetchWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  initialDelay?: number;
  signal?: AbortSignal;
}

function retryAfterMs(response: Response, fallback: number): number {
  const value = response.headers?.get?.("retry-after")
  if (!value) return fallback
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : fallback
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted", "AbortError"))
      return
    }
    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout)
        reject(new DOMException("Request aborted", "AbortError"))
      },
      { once: true }
    )
  })
}

/**
 * Wraps fetchWithController with retry logic
 * @param fetchFn - The fetch function (e.g. global fetch)
 * @param url - URL to fetch
 * @param options - Retry configuration
 * @returns Response object on success, null on failure or cancellation
 */
export async function fetchWithRetry(
  fetchFn: (url: string, options?: RequestInit) => Promise<Response | null>,
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response | null> {
  const {
    maxRetries = 3,
    retryDelay = options.initialDelay ?? 500,
    signal,
  } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (signal?.aborted) return null;
      const response = await fetchFn(url, { signal });
      
      // Request was cancelled (aborted) - return null immediately, no retry
      if (!response) {
        return null;
      }
      
      // Request succeeded
      if (response.ok) {
        return response;
      }

      // Client errors won't succeed on retry (except timeouts and rate limits)
      const isRetryableClientError = response.status === 408 || response.status === 429;
      if (response.status >= 400 && response.status < 500 && !isRetryableClientError) {
        console.error(`[fetchWithRetry] Client error ${response.status} for ${url}`);
        return null;
      }
      
      // HTTP error - retry if we have attempts left
      if (attempt < maxRetries) {
        const fallbackDelay =
          retryDelay * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5);
        const delay = retryAfterMs(response, fallbackDelay);
        console.log(`[fetchWithRetry] HTTP error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await wait(delay, signal);
        continue;
      }
      
      // All retries exhausted
      console.error(`[fetchWithRetry] All retries exhausted for ${url}, status: ${response.status}`);
      return null;
      
    } catch (error: any) {
      if (error?.name === "AbortError") return null;
      // Check if the error itself is a non-retryable client error (e.g., from a library that throws on 4xx)
      const status = error?.status || error?.response?.status;
      const isRetryableClientError = status === 408 || status === 429;
      if (status >= 400 && status < 500 && !isRetryableClientError) {
        console.error(`[fetchWithRetry] Client error ${status} caught for ${url}`);
        return null;
      }

      // Network or other errors - retry if we have attempts left
      if (attempt < maxRetries) {
        const delay =
          retryDelay * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5);
        console.log(`[fetchWithRetry] Error occurred, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        await wait(delay, signal);
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











