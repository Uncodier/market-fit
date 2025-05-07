/**
 * Configuración global de autenticación para la aplicación
 */

// Determinar si estamos en modo de desarrollo
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Configuración para modo de desarrollo
 */
export const authConfig = {
  // Si es true, se omitirán las comprobaciones de autenticación en APIs sensibles
  allowUnauthenticatedApiAccess: isDevelopment,
  
  // Mensaje para registrar en los logs cuando se omite la autenticación
  bypassMessage: 'Development mode: Authentication check bypassed',
  
  // Tiempo de caducidad de los tokens (en días)
  tokenExpiryDays: 30,
};

/**
 * Utilidad para comprobar si se debe permitir el acceso sin autenticación
 * @param forceSecurity - Si es true, ignorará la configuración de desarrollo y requerirá autenticación
 * @returns true si se debe permitir el acceso sin autenticación
 */
export function shouldAllowUnauthenticatedAccess(forceSecurity = false): boolean {
  if (forceSecurity) return false;
  return authConfig.allowUnauthenticatedApiAccess;
}

/**
 * Registra un mensaje cuando se omite la autenticación en modo desarrollo
 */
export function logAuthBypass(): void {
  if (isDevelopment) {
    console.log(authConfig.bypassMessage);
  }
} 