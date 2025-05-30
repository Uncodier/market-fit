import { createClient } from "@/lib/supabase/client";
import { apiClient } from "@/app/services/api-client-service";

// Interfaz para la respuesta de la API
export interface AISegmentResponse {
  success: boolean;
  message?: string;
  segments?: any[];
  error?: string;
  jobId?: string;
  rawResponse?: string;
  details?: any;
  data?: any;
  apiUrl?: string; // URL de la API para ayudar en la depuración
}

// Interfaz para los parámetros de la solicitud
export interface BuildSegmentsParams {
  url?: string;
  segmentCount?: number;
  mode?: 'create' | 'analyze' | 'update';
  analysisType?: 'general' | 'icp' | 'topics';
  provider?: string;
  modelId?: string;
  includeScreenshot?: boolean;
  user_id: string;
  site_id: string;
  apiKey?: string;
  apiSecret?: string;
}

// Variable para controlar si hay una petición en curso
let isRequestInProgress = false;

/**
 * Servicio para construir segmentos utilizando IA
 */
export async function buildSegmentsWithAI(params: BuildSegmentsParams): Promise<AISegmentResponse> {
  // Si ya hay una petición en curso, devolver un error
  if (isRequestInProgress) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Marcar que hay una petición en curso
  isRequestInProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      isRequestInProgress = false; // Liberar el bloqueo
      return {
        success: false,
        error: "Authentication required. Please sign in to continue."
      };
    }
    
    // Preparar los parámetros según la estructura correcta
    const requestParams = {
      // La URL debe ser la del sitio seleccionado o la proporcionada en los parámetros
      url: params.url,
      segmentCount: params.segmentCount || 3, // Asegurar que el valor predeterminado sea 3
      mode: params.mode || "create",
      analysisType: params.analysisType || "general",
      provider: params.provider || "openai",
      modelId: params.modelId || "gpt-4o",
      includeScreenshot: params.includeScreenshot !== false,
      // Incluir user_id y site_id directamente en el objeto principal
      user_id: params.user_id,
      site_id: params.site_id,
      // Metadatos adicionales si son necesarios
      metadata: {
        // Cualquier otro metadato que se necesite
      }
    };
    
    // Obtener las credenciales de API (en un entorno real, estas vendrían de una fuente segura)
    const apiKey = params.apiKey || process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
    const apiSecret = params.apiSecret || process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
    
    console.log("Calling AI service with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.postWithApiKeys(
        '/api/site/segments',
        requestParams,
        apiKey,
        apiSecret
      );
      
      // Verificar si la respuesta contiene un arreglo 'errors' no vacío
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        isRequestInProgress = false; // Liberar el bloqueo
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      isRequestInProgress = false; // Liberar el bloqueo
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError) {
      console.error("Network error in buildSegmentsWithAI:", fetchError);
      
      // Proporcionar información más detallada sobre el error de red
      let errorMessage = "Network error occurred while connecting to the server";
      let errorDetails = {};
      
      if (fetchError instanceof Error) {
        errorMessage = `Network error: ${fetchError.message}`;
        errorDetails = {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        };
        
        // Verificar si es un error de CORS o de conexión rechazada
        if (
          fetchError.message.includes('CORS') || 
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('Network request failed') ||
          fetchError.message.includes('Connection refused')
        ) {
          errorMessage = `Cannot connect to API server at ${apiClient.getApiUrl()}. Please check if the server is running and accessible.`;
        }
      }
      
      isRequestInProgress = false; // Liberar el bloqueo
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Incluir la URL de la API para ayudar en la depuración
      };
    }
  } catch (error) {
    console.error("Error in buildSegmentsWithAI:", error);
    isRequestInProgress = false; // Liberar el bloqueo
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Verifica la conexión con el servidor API
 */
export async function checkApiConnection(): Promise<AISegmentResponse> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: "Authentication required. Please sign in to continue."
      };
    }
    
    // Obtener las credenciales de API (en un entorno real, estas vendrían de una fuente segura)
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
    const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
    
    console.log("Checking API connection at:", apiClient.getApiUrl());
    
    try {
      const response = await apiClient.get('/', {
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret
        },
        timeout: 5000,
        includeAuth: false // No incluir auth token para este endpoint
      });
      
      // Si la respuesta es OK, la conexión está funcionando
      if (response.success || response.status === 200) {
        return {
          success: true,
          message: "API connection successful",
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      // Si la respuesta no es OK pero recibimos una respuesta, el servidor está activo
      // pero puede haber problemas con la autenticación o permisos
      return {
        success: false,
        error: `API server is reachable but returned status: ${response.status}`,
        apiUrl: apiClient.getApiUrl()
      };
    } catch (fetchError) {
      console.error("API connection check failed:", fetchError);
      
      return {
        success: false,
        error: `Cannot connect to API server at ${apiClient.getApiUrl()}. Please check if the server is running and accessible.`,
        details: {
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          name: fetchError instanceof Error ? fetchError.name : 'Unknown Error'
        },
        apiUrl: apiClient.getApiUrl()
      };
    }
  } catch (error) {
    console.error("Error in checkApiConnection:", error);
    
    return {
      success: false,
      error: "An unexpected error occurred while checking API connection",
      details: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown Error'
      }
    };
  }
}

/**
 * Realiza un diagnóstico completo de la conexión con el servidor API
 */
export async function diagnoseApiConnection(): Promise<AISegmentResponse> {
  try {
    console.log("Starting API connection diagnosis...");
    
    // 1. Verificar que tenemos una URL de API válida
    const apiUrl = apiClient.getApiUrl();
    if (!apiUrl) {
      return {
        success: false,
        error: "API server URL is not configured. Please check your environment variables.",
        details: {
          apiUrl: apiUrl,
          envVars: {
            NEXT_PUBLIC_API_SERVER_URL: process.env.NEXT_PUBLIC_API_SERVER_URL,
            API_SERVER_URL: process.env.API_SERVER_URL
          }
        }
      };
    }
    
    console.log("API URL configured as:", apiUrl);
    
    // 2. Verificar la sesión de autenticación
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: "Authentication required. No active session found.",
        apiUrl: apiUrl
      };
    }
    
    console.log("Authentication session found:", !!session);
    
    // Obtener las credenciales de API (en un entorno real, estas vendrían de una fuente segura)
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
    const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
    
    // 3. Intentar una solicitud simple para verificar la conexión
    try {
      console.log("Testing API connection with simple request...");
      
      const response = await apiClient.get('/', {
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret
        },
        timeout: 5000,
        includeAuth: false
      });
      
      console.log("GET request response status:", response.status);
      
      // Si recibimos cualquier respuesta, el servidor está activo
      if (response.status) {
        return {
          success: response.success,
          message: response.success
            ? "API server is reachable and responding correctly" 
            : `API server is reachable but returned status: ${response.status}`,
          details: {
            status: response.status,
            ...(response.error?.details || {})
          },
          apiUrl: apiUrl
        };
      }
    } catch (requestError) {
      console.error("API request test error:", requestError);
      
      return {
        success: false,
        error: "API request test failed. This may indicate a network issue or that the API server is not running.",
        details: {
          message: requestError instanceof Error ? requestError.message : String(requestError),
          name: requestError instanceof Error ? requestError.name : 'Unknown Error'
        },
        apiUrl: apiUrl
      };
    }
    
    // Si llegamos aquí, algo inesperado ocurrió
    return {
      success: false,
      error: "API connection diagnosis completed with unexpected result",
      apiUrl: apiUrl
    };
  } catch (error) {
    console.error("Error in diagnoseApiConnection:", error);
    
    return {
      success: false,
      error: "An unexpected error occurred during API connection diagnosis",
      details: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown Error'
      },
      apiUrl: apiClient.getApiUrl()
    };
  }
}

/**
 * Interface for build experiments parameters
 */
export interface BuildExperimentsParams {
  url?: string;
  experimentCount?: number;
  mode?: 'create' | 'analyze' | 'update';
  provider?: string;
  modelId?: string;
  includeScreenshot?: boolean;
  user_id: string;
  site_id: string;
  apiKey?: string;
  apiSecret?: string;
}

/**
 * Service to build experiments using AI
 */
export async function buildExperimentsWithAI(params: BuildExperimentsParams): Promise<AISegmentResponse> {
  // If a request is already in progress, return an error
  if (isRequestInProgress) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Mark that a request is in progress
  isRequestInProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      isRequestInProgress = false; // Release the lock
      return {
        success: false,
        error: "Authentication required. Please sign in to continue."
      };
    }
    
    // Prepare parameters according to the correct structure
    const requestParams = {
      // The URL should be the selected site URL or the one provided in the parameters
      url: params.url,
      experimentCount: params.experimentCount || 2, // Default to 2 experiments
      mode: params.mode || "create",
      provider: params.provider || "openai",
      modelId: params.modelId || "gpt-4o",
      includeScreenshot: params.includeScreenshot !== false,
      // Include user_id and site_id directly in the main object
      user_id: params.user_id,
      site_id: params.site_id,
      // Additional metadata if needed
      metadata: {
        // Any other metadata needed
      }
    };
    
    // Get API credentials (in a real environment, these would come from a secure source)
    const apiKey = params.apiKey || process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
    const apiSecret = params.apiSecret || process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
    
    console.log("Calling AI service for experiments with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.postWithApiKeys(
        '/api/site/experiments',
        requestParams,
        apiKey,
        apiSecret
      );
      
      // Check if the response contains a non-empty 'errors' array
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        isRequestInProgress = false; // Release the lock
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      isRequestInProgress = false; // Release the lock
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError) {
      console.error("Network error in buildExperimentsWithAI:", fetchError);
      
      // Provide more detailed information about the network error
      let errorMessage = "Network error occurred while connecting to the server";
      let errorDetails = {};
      
      if (fetchError instanceof Error) {
        errorMessage = `Network error: ${fetchError.message}`;
        errorDetails = {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        };
        
        // Check if it's a CORS error or connection refused
        if (
          fetchError.message.includes('CORS') || 
          fetchError.message.includes('Failed to fetch') ||
          fetchError.message.includes('Network request failed') ||
          fetchError.message.includes('Connection refused')
        ) {
          errorMessage = `Cannot connect to API server at ${apiClient.getApiUrl()}. Please check if the server is running and accessible.`;
        }
      }
      
      isRequestInProgress = false; // Release the lock
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Include the API URL to help with debugging
      };
    }
  } catch (error) {
    console.error("Error in buildExperimentsWithAI:", error);
    isRequestInProgress = false; // Release the lock
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
} 