import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import { createClient } from "@/lib/supabase/client"

/**
 * Generate a UUID
 */
export function generateUUID(): string {
  try {
    // Use crypto.randomUUID() if available (Node.js environments)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback for older environments: Use random values to generate a UUID
    // First check if we have crypto.getRandomValues available
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    
    // Final fallback using Math.random (less secure but ensures we have a UUID)
    console.warn('Using Math.random fallback for UUID generation - less secure!');
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } catch (error) {
    // If all else fails, generate a timestamp-based pseudo-UUID
    console.error('UUID generation error:', error);
    
    try {
      // Try one more approach with Math.random directly handling any toString issues
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        try {
          const r = Math.floor(Math.random() * 16);
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          // Use explicit number-to-string conversion to avoid any toString issues
          return (v < 10) ? String(v) : String.fromCharCode(87 + v); // 'a' is charCode 97, so 97-10=87
        } catch (innerError) {
          // Handle any unexpected error in the replace function
          console.error('Critical error in UUID generation fallback:', innerError);
          // Just return a digit or letter based on simple math operation
          return Math.floor(Math.random() * 10).toString();
        }
      });
    } catch (finalError) {
      // If absolutely everything fails, use timestamp only
      const timestamp = new Date().getTime();
      const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `fallback-${timestamp}-${randomPart}`;
    }
  }
}

// Get API server URL from environment variables
export const API_SERVER_URL = process.env.NEXT_PUBLIC_API_SERVER_URL || process.env.API_SERVER_URL || '';

// Ensure URL has proper protocol and use correct host
export const getFullApiUrl = (baseUrl: string) => {
  if (!baseUrl) return '';
  
  // If already has http:// or https://, extract the host and port
  let apiUrl = baseUrl;
  
  if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
    // Extract the protocol, host, and port
    const url = new URL(baseUrl);
    const protocol = url.protocol;
    const port = url.port;
    
    // If we're in a browser environment and the baseUrl is using localhost
    if (typeof window !== 'undefined' && url.hostname === 'localhost') {
      // Get the current origin
      const origin = window.location.origin;
      const originUrl = new URL(origin);
      
      // If we're accessing from an IP address instead of localhost
      if (originUrl.hostname !== 'localhost' && /^\d+\.\d+\.\d+\.\d+$/.test(originUrl.hostname)) {
        // Replace localhost with the same IP as the origin
        apiUrl = `${protocol}//${originUrl.hostname}:${port}`;
        console.log(`Replaced localhost with origin IP: ${apiUrl}`);
      }
    }
    
    return apiUrl;
  }
  
  // If it's just a host:port without protocol, add http://
  return `http://${baseUrl}`;
};

// Full URL with protocol
export const FULL_API_SERVER_URL = getFullApiUrl(API_SERVER_URL);

// Initialize Supabase client with error handling
export let supabaseClientInitialized = false;

export const supabase: SupabaseClient<Database> = createClient();

/**
 * Checks if the API server is available
 */
export async function checkApiServerAvailability(): Promise<boolean> {
  try {
    // Muchos servidores no tienen una ruta /health, intentamos con la raíz
    const API_URL = `${FULL_API_SERVER_URL}/`;
    console.log("Checking API server availability at:", API_URL);
    
    // Set a short timeout to avoid long waits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort('Request timeout after 3 seconds');
    }, 3000);
    
    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        mode: 'no-cors', // Cambiamos a no-cors para evitar problemas CORS
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Con modo no-cors, siempre devuelve un status de tipo "opaque"
      // así que solo verificamos que la respuesta existe
      return true;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Check if the error is due to abort signal (timeout)
      if (fetchError instanceof Error && 
          (fetchError.name === 'AbortError' || 
           fetchError.message.includes('Request timeout') ||
           fetchError.toString().includes('Request timeout'))) {
        console.log("API server check timed out after 3 seconds - server may be unavailable");
        return false;
      }
      
      // Log other fetch errors but don't throw them - just return false
      console.log("API server fetch failed:", fetchError instanceof Error ? fetchError.message : String(fetchError));
      return false;
    }
  } catch (error) {
    // This should now only catch setup errors, not fetch errors
    console.error("Unexpected error in checkApiServerAvailability:", error);
    return false;
  }
}

// Check if essential methods are present
if (!supabase.from) {
  console.error("CRITICAL ERROR: supabase.from is undefined");
} else {
  console.log("supabase.from is available");
}

if (!supabase.auth) {
  console.error("CRITICAL ERROR: supabase.auth is undefined");
} else {
  console.log("supabase.auth is available");
}

// Test connection
supabase.auth.getSession().then((result) => {
  if (result.error) {
    if (result.error.message.includes('mock') || result.error.message.includes('No hay sesión disponible')) {
      console.log("Mock client skipped session check:", result.error.message);
    } else {
      console.error("Error verifying Supabase session in chat-service:", result.error);
    }
  } else {
    console.log("Supabase client initialized successfully in chat-service.ts");
    if (result.data.session) {
      console.log("User is authenticated:", result.data.session.user.id);
    } else {
      console.log("No active session found - user is not authenticated");
    }
    supabaseClientInitialized = true;
  }
});
