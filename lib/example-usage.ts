// Ejemplo de uso del sistema de logging condicionado
// Este archivo demuestra cómo usar el sistema en diferentes scenarios

import { createLogger, config, logger } from './init';

// Ejemplo 1: Uso básico con console normal
console.log('🔄 Este log solo aparece en desarrollo');
console.warn('⚠️ Esta advertencia solo aparece en desarrollo');
console.info('ℹ️ Esta información solo aparece en desarrollo');
console.error('❌ Este error SIEMPRE aparece, en cualquier entorno');

// Ejemplo 2: Logger con contexto
const authLogger = createLogger('AUTH');
const apiLogger = createLogger('API');
const dbLogger = createLogger('DATABASE');

// Simulación de proceso de autenticación
export function simulateLogin() {
  authLogger.debug('Iniciando proceso de login');
  
  // Log normal - solo en desarrollo
  console.log('Datos de login recibidos');
  
  try {
    authLogger.info('Validando credenciales');
    
    // Simulación de llamada a API
    apiLogger.debug('Llamando a API de autenticación');
    console.log('Response de API:', { status: 200, user: 'john@example.com' });
    
    authLogger.info('Usuario autenticado exitosamente');
    
    return { success: true, user: 'john@example.com' };
    
  } catch (error) {
    // Error - SIEMPRE aparece
    console.error('Error en autenticación:', error);
    authLogger.error('Error detallado en login', { error, timestamp: new Date() });
    
    return { success: false, error: 'Authentication failed' };
  }
}

// Ejemplo 3: Logger jerárquico
export function simulateDatabaseOperations() {
  const userDbLogger = dbLogger.child('USER');
  const sessionDbLogger = dbLogger.child('SESSION');
  
  userDbLogger.debug('Consultando datos de usuario');
  console.log('Query SQL: SELECT * FROM users WHERE id = ?');
  
  sessionDbLogger.debug('Creando nueva sesión');
  console.log('Nueva sesión creada:', { sessionId: 'abc123', expires: '2025-01-01' });
}

// Ejemplo 4: Verificación de configuración
export function showConfiguration() {
  console.log('=== CONFIGURACIÓN DEL SISTEMA DE LOGGING ===');
  
  const appConfig = config.getConfig();
  console.log('Configuración completa:', appConfig);
  
  console.log('¿Modo debug habilitado?', config.isDebug());
  console.log('¿Es desarrollo?', config.isDevelopment());
  console.log('¿Es producción?', config.isProduction());
  console.log('Nivel de log:', config.getLogLevel());
  
  if (config.isDebug()) {
    console.log('✅ Los logs de desarrollo están HABILITADOS');
  } else {
    console.log('❌ Los logs de desarrollo están DESHABILITADOS');
  }
}

// Ejemplo 5: Diferentes niveles de log
export function demonstrateLogLevels() {
  logger.debug('Este es un mensaje de DEBUG');
  logger.info('Este es un mensaje de INFO');
  logger.warn('Este es un mensaje de WARNING');
  logger.error('Este es un mensaje de ERROR (siempre aparece)');
}

// Ejemplo 6: Log de rendimiento
export function performanceLogging() {
  const perfLogger = createLogger('PERFORMANCE');
  
  perfLogger.debug('Iniciando operación costosa');
  const startTime = Date.now();
  
  // Simulación de operación
  setTimeout(() => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    perfLogger.info('Operación completada', { duration: `${duration}ms` });
    console.log(`⏱️ Operación tomó ${duration}ms`);
  }, 100);
}

// Auto-ejecutar ejemplos si estamos en modo debug  
if (config.isDebug()) {
  console.log('\n🚀 EJECUTANDO EJEMPLOS DEL SISTEMA DE LOGGING\n');
  
  showConfiguration();
  console.log('\n--- Simulación de Login ---');
  simulateLogin();
  
  console.log('\n--- Operaciones de Base de Datos ---');
  simulateDatabaseOperations();
  
  console.log('\n--- Diferentes Niveles de Log ---');
  demonstrateLogLevels();
  
  console.log('\n--- Logging de Rendimiento ---');
  performanceLogging();
} 