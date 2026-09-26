import { emitBillingLimit, parseBillingLimitError } from "@/lib/billing-limit-errors";
import { consumeApiEventStream } from "./api-event-stream";
import { withTimeout } from "./request-timeout";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  status?: number;
  retryable?: boolean;
}

function notifyBillingLimitError(...sources: unknown[]) {
  for (const source of sources) {
    const payload = parseBillingLimitError(source)
    if (payload) {
      emitBillingLimit(payload)
      return
    }
  }
}

export async function handleApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get('content-type');

  if (response.ok && contentType?.includes('text/event-stream')) {
    return consumeApiEventStream<T>(response)
  }

  // Read response body as text first to avoid "body stream already read" error
  let responseText: string;
  try {
    responseText = await withTimeout(response.text(), 15_000, 'Reading the server response timed out.');
  } catch (error) {
    console.error('Failed to read response text:', error);
    return {
      success: false,
      retryable: false,
      error: {
        message: 'Failed to read server response',
        details: error
      },
      status: response.status
    };
  }

  if (!response.ok) {
    // If the response is HTML (error page)
    if (contentType && contentType.includes('text/html')) {
      console.error('Server returned HTML:', responseText);
      return {
        success: false,
        error: {
          message: 'Server returned an HTML error page instead of JSON',
          details: { htmlContent: responseText.substring(0, 500) }
        },
        status: response.status
      };
    }

    // Try to parse as JSON, but handle text responses too
    try {
      const errorData = JSON.parse(responseText);
      const nested = errorData.error;
      let message: string;
      if (typeof nested === 'string') {
        message = nested;
      } else if (nested && typeof nested === 'object' && typeof nested.message === 'string') {
        message = nested.message;
        const d = nested.details;
        if (typeof d === 'string' && d && d !== nested.message) {
          message = `${nested.message}: ${d}`;
        }
      } else {
        message =
          (typeof errorData.message === 'string' ? errorData.message : '') ||
          `Server error: ${response.status} ${response.statusText}`;
      }
      const errorResult = {
        success: false as const,
        error: {
          message,
          code: errorData.code ?? (typeof nested === 'object' ? nested?.code : undefined),
          details: typeof nested === 'object' ? nested : errorData
        },
        status: response.status
      };
      notifyBillingLimitError(errorResult.error, errorData)
      return errorResult;
    } catch (parseError) {
      console.error('Server returned non-JSON error:', responseText);
      return {
        success: false,
        error: {
          message: `Server error: ${response.status} ${response.statusText}`,
          details: { textContent: responseText.substring(0, 500) }
        },
        status: response.status
      };
    }
  }

  // Success response
  try {
    const data = JSON.parse(responseText);
    
    // Check if the response has a success field
    if (typeof data.success === 'boolean' && !data.success) {
      const err = data.error;
      let msg = (err && typeof err.message === 'string' && err.message) || 'Unknown error';
      const d = err && typeof err.details === 'string' ? err.details : '';
      if (d && d !== msg) {
        msg = `${msg}: ${d}`;
      }
      const limitResult = {
        success: false as const,
        error: {
          message: msg,
          code: err?.code,
          details: err
        },
        status: response.status
      };
      notifyBillingLimitError(limitResult.error, data)
      return limitResult;
    }

    // Return successful response
    return {
      success: true,
      data: data.data || data,
      status: response.status
    };
  } catch (parseError) {
    // If can't parse as JSON, return as text
    return {
      success: true,
      data: responseText as T,
      status: response.status
    };
  }
}
