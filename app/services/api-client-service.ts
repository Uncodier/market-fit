import { createClient } from "@/lib/supabase/client";
import { handleApiResponse, type ApiResponse } from "./api-client-response";
import { withTimeout } from "./request-timeout";

// Helper functions for URL validation
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Get API server URL from environment variables
const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '';

// Ensure URL has proper protocol
const getFullApiUrl = (baseUrl: string) => {
  if (!baseUrl) return '';
  
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl;
  }

  // Default to https for non-local environments to avoid mixed-content errors in production.
  const lower = baseUrl.toLowerCase();
  const isLocal =
    lower.startsWith('localhost') ||
    lower.startsWith('127.0.0.1') ||
    lower.startsWith('0.0.0.0');

  return `${isLocal ? 'http' : 'https'}://${baseUrl}`;
};

// Full URL with protocol
const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL);

// Read the demo-mode cookie in either runtime.
async function getDemoSiteIdAsync(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    try {
      const match = document.cookie.match(/market_fit_demo_site_id=([^;]+)/);
      return match ? match[1] : null;
    } catch (e) {
      return null;
    }
  } else {
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      return cookieStore.get('market_fit_demo_site_id')?.value || null;
    } catch (e) {
      return null;
    }
  }
}

// Silence API server URL log

interface ApiClientOptions {
  headers?: Record<string, string>;
  includeAuth?: boolean;
  timeout?: number;
  cache?: RequestCache;
}


export async function isDemoModeActive(): Promise<boolean> {
  const id = await getDemoSiteIdAsync();
  return !!id;
}

export class ApiClientService {
  private static instance: ApiClientService;
  private apiServerUrl: string;

  private constructor() {
    this.apiServerUrl = FULL_API_SERVER_URL;
  }

  static getInstance(): ApiClientService {
    if (!ApiClientService.instance) {
      ApiClientService.instance = new ApiClientService();
    }
    return ApiClientService.instance;
  }

  getApiUrl(): string {
    return this.apiServerUrl;
  }

  private buildUrl(endpoint: string): string {
    // Allow absolute URLs.
    if (endpoint && isValidUrl(endpoint)) return endpoint;

    // Keep browser assistant traffic same-origin: localhost refers to the user's
    // machine, not the API host. This route authenticates and forwards the stream.
    if (typeof window !== 'undefined' && endpoint === '/api/robots/instance/assistant') {
      return endpoint;
    }

    // If an API server URL is configured, send all requests (including /api/*) to it.
    if (this.apiServerUrl && this.apiServerUrl.trim() !== '') {
      return `${this.apiServerUrl}${endpoint}`;
    }

    // No external API: use endpoint as-is (relative URL, same-origin Next.js routes).
    return endpoint;
  }

  private async getAuthToken(): Promise<string | null> {
    const supabase = createClient();
    const { data: { session } } = await withTimeout<{ data: { session: { access_token: string } | null } }>(
      supabase.auth.getSession(), 10_000,
      'Checking your session timed out. Please sign in again and retry.',
    );
    return session?.access_token || null;
  }


  async get<T = any>(endpoint: string, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const demoSiteId = await getDemoSiteIdAsync();
    if (demoSiteId) {
      console.log(`🤖 DEMO API INTERCEPT: GET ${endpoint}`);
      return { success: true, data: {} } as unknown as ApiResponse<T>;
    }

    const url = this.buildUrl(endpoint);
    
    // Silence GET request log

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...options.headers
      };

      if (options.includeAuth !== false) {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        cache: options.cache || 'no-cache',
        ...(options.timeout && { signal: AbortSignal.timeout(options.timeout) })
      });

      return await handleApiResponse<T>(response);
    } catch (error) {
      console.error('Error in GET request:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          details: error
        }
      };
    }
  }

  async post<T = any>(endpoint: string, body: any, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const demoSiteId = await getDemoSiteIdAsync();
    if (demoSiteId) {
      console.log(`🤖 DEMO API INTERCEPT: POST ${endpoint}`);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock different endpoints
      if (endpoint.includes('workflow/buildSegments') || endpoint.includes('workflow/buildSegmentsICP')) {
        return {
          success: true,
          data: {
            segments: [
              { name: 'Demo Segment 1', description: 'Auto-generated demo segment' },
              { name: 'Demo Segment 2', description: 'Another auto-generated segment' }
            ]
          }
        } as unknown as ApiResponse<T>;
      }
      if (endpoint.includes('site/experiments')) {
        return {
          success: true,
          data: {
            experiments: [
              { name: 'Demo Experiment', hypothesis: 'Testing demo conversion' }
            ]
          }
        } as unknown as ApiResponse<T>;
      }
      if (endpoint.includes('workflow/buildCampaigns')) {
        return {
          success: true,
          data: {
            campaigns: [
              { name: 'Demo Campaign', description: 'Simulated campaign' }
            ]
          }
        } as unknown as ApiResponse<T>;
      }
      if (endpoint.includes('workflow/buildContent')) {
        return {
          success: true,
          data: {
            content: [
              { title: 'Demo Content', type: 'blog_post', description: 'Simulated content' }
            ]
          }
        } as unknown as ApiResponse<T>;
      }
      if (endpoint.includes('generate')) {
         return {
           success: true,
           data: {
             result: "This is a simulated AI generated text for the demo mode. The real API wasn't called."
           }
         } as unknown as ApiResponse<T>;
      }
      
      // Default mock response for other POSTs
      return {
        success: true,
        data: { id: `demo-res-${Date.now()}`, ...body }
      } as unknown as ApiResponse<T>;
    }

    const url = this.buildUrl(endpoint);
    
    // Silence POST request logs

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      };

      if (options.includeAuth !== false) {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Bound connection setup separately from the long-running assistant stream.
      const controller = new AbortController();
      const isAssistant = endpoint === '/api/robots/instance/assistant';
      const timer = isAssistant && !options.timeout ? setTimeout(() => controller.abort(), 75_000) : undefined;
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          cache: options.cache || 'no-cache',
          signal: options.timeout ? AbortSignal.timeout(options.timeout) : isAssistant ? controller.signal : undefined,
        });
      } finally {
        clearTimeout(timer);
      }

      return await handleApiResponse<T>(response);
    } catch (error) {
      console.error('Error in POST request:', error);
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Network error';
      const errorDetails: any = { originalError: error };
      
      if (error instanceof TypeError) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Failed to connect to API server. Please check if the server is running and the URL is correct.';
          errorDetails.suggestion = 'Verify NEXT_PUBLIC_API_SERVER_URL environment variable and server connectivity';
        } else if (error.message.includes('URL')) {
          errorMessage = 'Invalid API server URL format';
          errorDetails.suggestion = 'Check the NEXT_PUBLIC_API_SERVER_URL format (e.g., http://localhost:3001)';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      if (endpoint === '/api/robots/instance/assistant' && error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'The assistant connection timed out. The workflow may still be running. Check the conversation before sending again.';
      }
      
      // Add debugging information
      errorDetails.requestUrl = url;
      errorDetails.apiServerUrl = this.apiServerUrl;
      errorDetails.endpoint = endpoint;
      
      return {
        success: false,
        // A disconnected assistant POST may already have started a workflow.
        retryable: endpoint === '/api/robots/instance/assistant' ? false : undefined,
        error: {
          message: errorMessage,
          details: errorDetails
        }
      };
    }
  }

  async put<T = any>(endpoint: string, body: any, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const demoSiteId = await getDemoSiteIdAsync();
    if (demoSiteId) {
      console.log(`🤖 DEMO API INTERCEPT: PUT ${endpoint}`);
      return { success: true, data: { ...body } } as unknown as ApiResponse<T>;
    }

    const url = this.buildUrl(endpoint);
    
    // Silence PUT request logs

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      };

      if (options.includeAuth !== false) {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
        cache: options.cache || 'no-cache',
        ...(options.timeout && { signal: AbortSignal.timeout(options.timeout) })
      });

      return await handleApiResponse<T>(response);
    } catch (error) {
      console.error('Error in PUT request:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          details: error
        }
      };
    }
  }

  async patch<T = any>(endpoint: string, body: any, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const demoSiteId = await getDemoSiteIdAsync();
    if (demoSiteId) {
      return { success: true, data: { ...body } } as unknown as ApiResponse<T>;
    }

    const url = this.buildUrl(endpoint);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      };

      if (options.includeAuth !== false) {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        cache: options.cache || 'no-cache',
        ...(options.timeout && { signal: AbortSignal.timeout(options.timeout) })
      });

      return await handleApiResponse<T>(response);
    } catch (error) {
      console.error('Error in PATCH request:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          details: error
        }
      };
    }
  }

  async delete<T = any>(endpoint: string, options: ApiClientOptions = {}): Promise<ApiResponse<T>> {
    const demoSiteId = await getDemoSiteIdAsync();
    if (demoSiteId) {
      console.log(`🤖 DEMO API INTERCEPT: DELETE ${endpoint}`);
      return { success: true, data: { deleted: true } } as unknown as ApiResponse<T>;
    }

    const url = this.buildUrl(endpoint);
    
    // Silence DELETE request logs

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...options.headers
      };

      if (options.includeAuth !== false) {
        const token = await this.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        cache: options.cache || 'no-cache',
        ...(options.timeout && { signal: AbortSignal.timeout(options.timeout) })
      });

      return await handleApiResponse<T>(response);
    } catch (error) {
      console.error('Error in DELETE request:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          details: error
        }
      };
    }
  }

  // Method for special cases with custom headers like API keys
  async postWithApiKeys<T = any>(
    endpoint: string, 
    body: any, 
    apiKey: string, 
    apiSecret: string, 
    options: ApiClientOptions = {}
  ): Promise<ApiResponse<T>> {
    return this.post<T>(endpoint, body, {
      ...options,
      headers: {
        ...options.headers,
        'x-api-key': apiKey,
        'x-api-secret': apiSecret
      }
    });
  }
}

// Export singleton instance
export const apiClient = ApiClientService.getInstance(); 