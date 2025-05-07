/**
 * Configuración de API keys para acceder a endpoints sin autenticación de usuario
 */

// API key predeterminada para desarrollo
const DEFAULT_API_KEY = 'market-fit-dev-api-key';

// API keys permitidas (en producción deberían estar en variables de entorno o base de datos)
export const validApiKeys: string[] = [
  DEFAULT_API_KEY,
  process.env.API_KEY || '',
  // Agregar aquí más API keys si es necesario
].filter(Boolean);

/**
 * Verifica si una API key es válida
 * @param apiKey - La API key a verificar
 * @returns true si la API key es válida
 */
export function isValidApiKey(apiKey: string | null | undefined): boolean {
  if (!apiKey) return false;

  // En desarrollo, permitir bypass de verificación
  if (process.env.NODE_ENV === 'development' && !process.env.REQUIRE_API_KEY) {
    return true;
  }

  return validApiKeys.includes(apiKey);
}

/**
 * Obtiene la API key de una solicitud (de headers o query params)
 * @param headers - Headers de la solicitud
 * @param query - Query params de la solicitud
 * @returns La API key si se encuentra, null en caso contrario
 */
export function getApiKeyFromRequest(
  headers: Headers,
  query: URLSearchParams | null = null
): string | null {
  // Intentar obtener de Authorization header
  const authHeader = headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Intentar obtener de X-API-Key header
  const apiKeyHeader = headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Intentar obtener de query params
  if (query) {
    const apiKeyParam = query.get('api_key');
    if (apiKeyParam) {
      return apiKeyParam;
    }
  }

  return null;
}

/**
 * Respuesta de error para API key inválida
 */
export const INVALID_API_KEY_RESPONSE = {
  error: 'Invalid API key',
  status: 401,
  message: 'Please provide a valid API key via Authorization header, X-API-Key header, or api_key query parameter'
}; 