import { createClient } from "@/lib/supabase/client"
import { apiClient } from "@/app/services/api-client-service"
import type { AISegmentResponse } from "./ai-service-types"

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
