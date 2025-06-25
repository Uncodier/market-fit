# Sistema de Logging Condicionado

Este documento describe el sistema de logging implementado en Market Fit que permite controlar los logs según el entorno de ejecución.

## Características Principales

✅ **Control centralizado**: Un solo lugar controla todos los logs  
✅ **Sin cambios de código**: No necesitas modificar ningún `console.log` existente  
✅ **Errores preservados**: Los errores críticos siempre se muestran  
✅ **Cero overhead en producción**: No hay verificaciones if/else en cada log  
✅ **Transparente**: El código existente funciona sin modificaciones  

## Cómo Funciona

### 1. Interceptación Global

El sistema funciona **sobrescribiendo globalmente** las funciones de `console.log`, `console.warn`, `console.info` y `console.debug` al cargar la aplicación:

```typescript
// Los logs normales solo aparecen en modo debug
console.log("Este mensaje solo aparece en desarrollo");
console.warn("Esta advertencia solo aparece en desarrollo");
console.info("Esta información solo aparece en desarrollo");

// Los errores SIEMPRE aparecen (con información adicional en debug)
console.error("Este error SIEMPRE aparece");
```

### 2. Control por Configuración

La configuración determina automáticamente si mostrar logs:

```typescript
import { config } from '../lib/config';

// Verificar si estamos en modo debug
if (config.isDebug()) {
  // Código que solo se ejecuta en modo debug
}
```

## Formas de Habilitar Debug

### 1. Automático por Entorno
- **Desarrollo** (`NODE_ENV=development`): Debug **HABILITADO** por defecto
- **Producción** (`NODE_ENV=production`): Debug **DESHABILITADO** por defecto

### 2. Variable de Entorno
```bash
# Forzar debug en cualquier entorno
NEXT_PUBLIC_DEBUG=true

# Forzar deshabilitar debug
NEXT_PUBLIC_DEBUG=false
```

### 3. Parámetro de URL (para desarrollo/testing)
```
https://tu-app.com?debug=true
```

### 4. Configuración de Log Level
```bash
# Niveles disponibles: 'error' | 'warn' | 'info' | 'debug'
NEXT_PUBLIC_LOG_LEVEL=debug
```

## Uso del Logger Avanzado

### Logger con Contexto
```typescript
import { createLogger, logger } from '../lib/init';

// Logger con contexto específico
const authLogger = createLogger('AUTH');
authLogger.debug('Usuario autenticado', { userId: 123 });
authLogger.error('Error de autenticación', error);

// Logger por defecto
logger.info('Aplicación iniciada');
logger.warn('Advertencia importante');
```

### Logger Jerárquico
```typescript
const apiLogger = createLogger('API');
const userApiLogger = apiLogger.child('USER');

userApiLogger.debug('Consultando usuario', { id: 123 });
// Output: [timestamp] [DEBUG] [API:USER] Consultando usuario {id: 123}
```

### Funciones de Forzado
```typescript
import { forceLog, forceWarn, forceError } from '../lib/init';

// Estos logs aparecen SIEMPRE, independientemente del modo debug
forceLog('Mensaje importante que siempre debe aparecer');
forceWarn('Advertencia crítica');
forceError('Error que siempre debe ser visible');
```

## Comportamiento por Entorno

### Desarrollo (NODE_ENV=development)
- ✅ Todos los logs aparecen (`console.log`, `console.warn`, `console.info`, `console.debug`)
- ✅ Errores con información adicional de debug
- ✅ Mensajes de inicialización del sistema
- ✅ Timestamps y contexto en Logger avanzado

### Producción (NODE_ENV=production)
- ❌ `console.log`, `console.warn`, `console.info`, `console.debug` NO aparecen
- ✅ `console.error` siempre aparece
- ❌ Sin información adicional de debug
- ❌ Sin mensajes de inicialización

### Testing (NODE_ENV=test)
- ❌ Logs normales deshabilitados por defecto
- ✅ Errores y advertencias habilitados
- ✅ Posibilidad de restaurar console original para testing

## Configuración Avanzada

### Restaurar Console Original (útil para testing)
```typescript
import { restoreConsole } from '../lib/init';

// En tests, restaurar comportamiento original
beforeEach(() => {
  restoreConsole();
});
```

### Verificar Estado del Sistema
```typescript
import { config } from '../lib/init';

// Obtener configuración completa
const appConfig = config.getConfig();
console.log('Configuración:', appConfig);

// Verificar entorno
if (config.isDevelopment()) {
  // Código específico para desarrollo
}

if (config.isProduction()) {
  // Código específico para producción
}
```

## Ejemplos de Uso

### En Componentes React
```typescript
import { createLogger } from '../lib/init';

const MyComponent = () => {
  const logger = createLogger('MyComponent');
  
  useEffect(() => {
    logger.debug('Componente montado');
    
    // Log normal - solo aparece en desarrollo
    console.log('Estado del componente:', state);
    
    return () => {
      logger.debug('Componente desmontado');
    };
  }, []);

  const handleError = (error: Error) => {
    // Error - SIEMPRE aparece
    console.error('Error en componente:', error);
    logger.error('Error detallado:', { error, component: 'MyComponent' });
  };

  return <div>...</div>;
};
```

### En Servicios/APIs
```typescript
import { createLogger } from '../lib/init';

const apiLogger = createLogger('API');

export const fetchUserData = async (userId: string) => {
  apiLogger.debug('Consultando datos de usuario', { userId });
  
  try {
    const response = await fetch(`/api/users/${userId}`);
    
    // Log normal - solo en desarrollo
    console.log('Respuesta de API:', response);
    
    const data = await response.json();
    apiLogger.info('Datos obtenidos exitosamente', { userId, dataKeys: Object.keys(data) });
    
    return data;
  } catch (error) {
    // Error - SIEMPRE aparece
    console.error('Error al obtener datos de usuario:', error);
    apiLogger.error('Error detallado en API', { userId, error });
    throw error;
  }
};
```

## Variables de Entorno

Agregar a tu archivo `.env.local`:

```bash
# Habilitar debug en cualquier entorno
NEXT_PUBLIC_DEBUG=true

# Configurar nivel de log
NEXT_PUBLIC_LOG_LEVEL=debug
```

## Migración de Código Existente

✅ **No necesitas cambiar nada** - Todo el código existente con `console.log` funciona automáticamente

```typescript
// Este código funciona sin modificaciones
console.log('Mensaje de desarrollo');
console.warn('Advertencia de desarrollo');
console.error('Error importante'); // Siempre aparece

// Si quieres un control más granular, puedes usar el Logger
import { createLogger } from '../lib/init';
const logger = createLogger('MODULO');
logger.debug('Debug con contexto');
```

## Troubleshooting

### Los logs no aparecen en desarrollo
1. Verificar que `NODE_ENV=development`
2. Verificar que no hay `NEXT_PUBLIC_DEBUG=false`
3. Verificar que el sistema se inicializó correctamente

### Los logs aparecen en producción
1. Verificar que `NODE_ENV=production`
2. Verificar que no hay `NEXT_PUBLIC_DEBUG=true`
3. Verificar que no hay parámetros `?debug=true` en la URL

### Errores no aparecen
Los errores SIEMPRE deben aparecer. Si no aparecen, verificar:
1. Que estás usando `console.error` y no `console.log`
2. Que no hay código que intercepte errores antes del logger

## Rendimiento

- **Desarrollo**: Overhead mínimo, solo verificaciones de configuración
- **Producción**: Overhead casi nulo, las funciones de log se vuelven no-op
- **Memoria**: Sin impact significativo, solo almacena referencias a funciones originales 