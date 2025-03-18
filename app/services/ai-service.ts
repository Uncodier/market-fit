import { createClient } from "@/lib/supabase/client";

// Obtener la URL del servidor API desde las variables de entorno
// Buscar primero NEXT_PUBLIC_API_SERVER_URL y luego API_SERVER_URL como fallback
const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '';

// Asegurarse de que la URL tenga el protocolo adecuado
const getFullApiUrl = (baseUrl: string) => {
  if (!baseUrl) return '';
  
  // Si ya tiene http:// o https://, devolver tal cual
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    return baseUrl;
  }
  
  // De lo contrario, agregar http:// (asumiendo desarrollo local)
  return `http://${baseUrl}`;
};

// URL completa con protocolo
const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL);

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
    
    // Usar la ruta correcta según la implementación proporcionada
    const API_URL = `${FULL_API_SERVER_URL}/api/site/segments`;
    
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
    console.log("Full API URL:", API_URL);
    console.log("Target site URL:", params.url);
    
    try {
      console.log("Attempting to connect to API at:", API_URL);
      console.log("With headers:", {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'x-api-secret': '***SECRET***', // No mostrar el secreto completo por seguridad
        'Accept': 'application/json'
      });
      
      // Intentar con fetch - SOLO UNA PETICIÓN
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-api-secret': apiSecret,
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestParams),
        cache: 'no-cache'
      });
      
      // Check if response is OK (status in the range 200-299)
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        
        // If the response is HTML (error page)
        if (contentType && contentType.includes('text/html')) {
          const htmlContent = await response.text();
          console.error("Server returned HTML instead of JSON:", htmlContent.substring(0, 200) + "...");
          isRequestInProgress = false; // Liberar el bloqueo
          return {
            success: false,
            error: "Server returned an HTML error page instead of JSON",
            rawResponse: htmlContent
          };
        }
        
        // Try to parse as JSON, but handle text responses too
        try {
          const errorData = await response.json();
          isRequestInProgress = false; // Liberar el bloqueo
          
          // Verificar si la respuesta contiene un arreglo 'errors' no vacío
          if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            console.error("API returned errors:", errorData.errors);
            return {
              success: false,
              error: Array.isArray(errorData.errors) 
                ? errorData.errors.map((e: any) => e.message || e).join(', ') 
                : "API returned errors",
              details: errorData
            };
          }
          
          return {
            success: false,
            error: errorData.message || errorData.error || `Server error: ${response.status} ${response.statusText}`,
            details: errorData
          };
        } catch (parseError) {
          // If we can't parse as JSON, return the text
          const textContent = await response.text();
          console.error("Failed to parse error response as JSON:", textContent.substring(0, 200) + "...");
          isRequestInProgress = false; // Liberar el bloqueo
          return {
            success: false,
            error: `Server error: ${response.status} ${response.statusText}`,
            rawResponse: textContent
          };
        }
      }
      
      // Parse successful response
      try {
        const data = await response.json();
        
        // Verificar si la respuesta contiene un arreglo 'errors' no vacío
        if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
          console.error("API returned errors:", data.errors);
          isRequestInProgress = false; // Liberar el bloqueo
          return {
            success: false,
            error: Array.isArray(data.errors) 
              ? data.errors.map((e: any) => e.message || e).join(', ') 
              : "API returned errors",
            details: data
          };
        }
        
        isRequestInProgress = false; // Liberar el bloqueo
        return {
          success: true,
          data
        };
      } catch (parseError) {
        const textContent = await response.text();
        console.error("Failed to parse successful response as JSON:", textContent.substring(0, 200) + "...");
        isRequestInProgress = false; // Liberar el bloqueo
        return {
          success: false,
          error: "Failed to parse successful response as JSON",
          rawResponse: textContent
        };
      }
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
          errorMessage = `Cannot connect to API server at ${FULL_API_SERVER_URL}. Please check if the server is running and accessible.`;
        }
      }
      
      isRequestInProgress = false; // Liberar el bloqueo
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        apiUrl: FULL_API_SERVER_URL // Incluir la URL de la API para ayudar en la depuración
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
    
    // Construir una URL para verificar la conexión (endpoint de health check o similar)
    // Si no existe un endpoint específico, podemos usar cualquier endpoint conocido
    const API_URL = FULL_API_SERVER_URL;
    
    console.log("Checking API connection at:", API_URL);
    
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret,
          'Accept': 'application/json'
        },
        // Timeout corto para la verificación
        signal: AbortSignal.timeout(5000),
        cache: 'no-cache'
      });
      
      // Si la respuesta es OK, la conexión está funcionando
      if (response.ok) {
        return {
          success: true,
          message: "API connection successful",
          apiUrl: FULL_API_SERVER_URL
        };
      }
      
      // Si la respuesta no es OK pero recibimos una respuesta, el servidor está activo
      // pero puede haber problemas con la autenticación o permisos
      return {
        success: false,
        error: `API server is reachable but returned status: ${response.status} ${response.statusText}`,
        apiUrl: FULL_API_SERVER_URL
      };
    } catch (fetchError) {
      console.error("API connection check failed:", fetchError);
      
      return {
        success: false,
        error: `Cannot connect to API server at ${FULL_API_SERVER_URL}. Please check if the server is running and accessible.`,
        details: {
          message: fetchError instanceof Error ? fetchError.message : String(fetchError),
          name: fetchError instanceof Error ? fetchError.name : 'Unknown Error'
        },
        apiUrl: FULL_API_SERVER_URL
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
    if (!FULL_API_SERVER_URL) {
      return {
        success: false,
        error: "API server URL is not configured. Please check your environment variables.",
        details: {
          apiUrl: FULL_API_SERVER_URL,
          envVars: {
            NEXT_PUBLIC_API_SERVER_URL: process.env.NEXT_PUBLIC_API_SERVER_URL,
            API_SERVER_URL: process.env.API_SERVER_URL
          }
        }
      };
    }
    
    console.log("API URL configured as:", FULL_API_SERVER_URL);
    
    // 2. Verificar la sesión de autenticación
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return {
        success: false,
        error: "Authentication required. No active session found.",
        apiUrl: FULL_API_SERVER_URL
      };
    }
    
    console.log("Authentication session found:", !!session);
    
    // Obtener las credenciales de API (en un entorno real, estas vendrían de una fuente segura)
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || "YOUR_API_KEY";
    const apiSecret = process.env.NEXT_PUBLIC_API_SECRET || "YOUR_API_SECRET";
    
    // 3. Intentar una solicitud simple para verificar la conexión
    try {
      console.log("Testing API connection with simple request...");
      
      // Usar la raíz del servidor
      const testUrl = FULL_API_SERVER_URL;
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'x-api-secret': apiSecret,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000),
        cache: 'no-cache'
      });
      
      console.log("GET request response status:", response.status);
      
      // Si recibimos cualquier respuesta, el servidor está activo
      if (response.status) {
        let responseBody = "";
        try {
          responseBody = await response.text();
          console.log("Response body preview:", responseBody.substring(0, 200) + (responseBody.length > 200 ? "..." : ""));
        } catch (textError) {
          console.error("Error reading response body:", textError);
        }
        
        return {
          success: response.ok,
          message: response.ok 
            ? "API server is reachable and responding correctly" 
            : `API server is reachable but returned status: ${response.status} ${response.statusText}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers).reduce((obj, [key, value]) => {
              obj[key] = value;
              return obj;
            }, {} as Record<string, string>),
            bodyPreview: responseBody.substring(0, 200) + (responseBody.length > 200 ? "..." : "")
          },
          apiUrl: FULL_API_SERVER_URL
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
        apiUrl: FULL_API_SERVER_URL
      };
    }
    
    // Si llegamos aquí, algo inesperado ocurrió
    return {
      success: false,
      error: "API connection diagnosis completed with unexpected result",
      apiUrl: FULL_API_SERVER_URL
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
      apiUrl: FULL_API_SERVER_URL
    };
  }
} 