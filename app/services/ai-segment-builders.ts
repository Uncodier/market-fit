import { createClient } from "@/lib/supabase/client"
import { apiClient } from "@/app/services/api-client-service"
import type { AISegmentResponse, BuildSegmentsParams } from "./ai-service-types"
import { isDemoModeActive } from "@/lib/demo-utils"
import { aiRequestState } from "./ai-request-state"

/**
 * Servicio para construir segmentos utilizando IA
 */
export async function buildSegmentsWithAI(params: BuildSegmentsParams): Promise<AISegmentResponse> {
  // Si ya hay una petición en curso, devolver un error
  if (aiRequestState.inProgress && !(await isDemoModeActive())) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Marcar que hay una petición en curso
  aiRequestState.inProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      aiRequestState.inProgress = false; // Liberar el bloqueo
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
    
    console.log("Calling AI service with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.post(
        '/api/workflow/buildSegments',
        requestParams
      );
      
      // Verificar si la respuesta contiene un arreglo 'errors' no vacío
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        aiRequestState.inProgress = false; // Liberar el bloqueo
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      aiRequestState.inProgress = false; // Liberar el bloqueo
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          code: response.error?.code,
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError: any) {
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
      
      aiRequestState.inProgress = false; // Liberar el bloqueo
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Incluir la URL de la API para ayudar en la depuración
      };
    }
  } catch (error) {
    console.error("Error in buildSegmentsWithAI:", error);
    aiRequestState.inProgress = false; // Liberar el bloqueo
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}

/**
 * Servicio para construir segmentos ICP utilizando IA
 */
export async function buildSegmentsICPWithAI(params: BuildSegmentsParams): Promise<AISegmentResponse> {
  // Si ya hay una petición en curso, devolver un error
  if (aiRequestState.inProgress && !(await isDemoModeActive())) {
    console.warn("A request is already in progress. Please wait for it to complete.");
    return {
      success: false,
      error: "A request is already in progress. Please wait for it to complete."
    };
  }

  // Marcar que hay una petición en curso
  aiRequestState.inProgress = true;

  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      aiRequestState.inProgress = false; // Liberar el bloqueo
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
      mode: params.mode || "analyze",
      analysisType: params.analysisType || "icp",
      provider: params.provider || "openai",
      modelId: params.modelId || "gpt-4o",
      includeScreenshot: params.includeScreenshot !== false,
      // Incluir user_id, site_id y segment_id directamente en el objeto principal
      user_id: params.user_id,
      site_id: params.site_id,
      segment_id: params.segment_id,
      // Metadatos adicionales si son necesarios
      metadata: {
        // Cualquier otro metadato que se necesite
      }
    };
    
    console.log("Calling AI ICP service with params:", requestParams);
    console.log("Target site URL:", params.url);
    
    try {
      const response = await apiClient.post(
        '/api/workflow/buildSegmentsICP',
        requestParams
      );
      
      // Verificar si la respuesta contiene un arreglo 'errors' no vacío
      if (response.data?.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0) {
        console.error("API returned errors:", response.data.errors);
        aiRequestState.inProgress = false; // Liberar el bloqueo
        return {
          success: false,
          error: Array.isArray(response.data.errors) 
            ? response.data.errors.map((e: any) => e.message || e).join(', ') 
            : "API returned errors",
          details: response.data
        };
      }
      
      aiRequestState.inProgress = false; // Liberar el bloqueo
      
      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || "Unknown error occurred",
          code: response.error?.code,
          details: response.error?.details,
          rawResponse: response.error?.details?.htmlContent || response.error?.details?.textContent,
          apiUrl: apiClient.getApiUrl()
        };
      }
      
      return {
        success: true,
        data: response.data
      };
    } catch (fetchError: any) {
      console.error("Network error in buildSegmentsICPWithAI:", fetchError);
      
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
      
      aiRequestState.inProgress = false; // Liberar el bloqueo
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: apiClient.getApiUrl() // Incluir la URL de la API para ayudar en la depuración
      };
    }
  } catch (error) {
    console.error("Error in buildSegmentsICPWithAI:", error);
    aiRequestState.inProgress = false; // Liberar el bloqueo
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    };
  }
}
