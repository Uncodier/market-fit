# Google Authentication Setup

Este documento explica cómo configurar correctamente Google Authentication en Supabase para evitar errores PKCE como "code challenge does not match previously saved code verifier".

## ⚠️ Problema Común: Error PKCE

Si ves el error `code challenge does not match previously saved code verifier`, significa que hay un problema con la configuración de las URLs de callback en Supabase.

## 🛠️ Solución Paso a Paso

### 1. Configurar URLs en Supabase Dashboard

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Authentication > URL Configuration**
3. Configura estas URLs **exactamente**:

#### Site URLs:
```
http://localhost:3000
https://tu-dominio-produccion.com
```

#### Redirect URLs:
```
http://localhost:3000/auth/callback
https://tu-dominio-produccion.com/auth/callback
```

⚠️ **CRÍTICO**: Las URLs deben coincidir **exactamente** con las que usa tu aplicación.

### 2. Configurar Google OAuth Provider

1. En Supabase Dashboard, ve a **Authentication > Providers**
2. Encuentra "Google" y haz click en configurar
3. Activa "Enable sign in with Google"
4. Agrega tu **Client ID** y **Client Secret** de Google Cloud Console

### 3. Configurar Variables de Entorno

Asegúrate de tener estas variables en tu `.env.local`:

```bash
# URL de tu aplicación (REQUERIDA)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 4. Verificar Configuración de Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Navega a **APIs & Services > Credentials**
3. Edita tu OAuth 2.0 Client ID
4. Agrega estas **Authorized redirect URIs**:

```
http://localhost:3000/auth/callback
https://tu-dominio-produccion.com/auth/callback
https://tu-proyecto.supabase.co/auth/v1/callback
```

## 🔧 Cambios Implementados

Los siguientes cambios se han hecho en el código para prevenir errores PKCE:

### 1. Limpieza de Estado de Autenticación
```typescript
// Limpiar estado antes de OAuth para evitar conflictos PKCE
await supabase.auth.signOut({ scope: 'local' })
await new Promise(resolve => setTimeout(resolve, 100))
```

### 2. URLs Consistentes
Todas las configuraciones OAuth ahora usan `window.location.origin` para consistencia:
```typescript
redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(finalReturnTo)}`
```

### 3. Manejo Mejorado de Errores PKCE
```typescript
if (error.message.includes('code verifier') || error.message.includes('code challenge')) {
  setErrorMessage('Authentication session expired. Please try signing in again.')
}
```

### 4. Limpieza de Cookies Problemáticas
```typescript
const cookiesToClear = [
  'sb-auth-token',
  'supabase-auth-token', 
  'pkce_verifier',
  'sb-provider-token'
]
```

## 🐛 Debugging

### Logs a Revisar

Busca estos logs en tu consola del navegador:

```
🧹 Clearing auth state before Google OAuth to prevent PKCE conflicts
🔄 Starting Google OAuth flow with clean state
✅ Google OAuth initiated successfully
🔄 Attempting to exchange code for session
✅ Auth callback success, session established for: usuario@email.com
🎯 Redirecting to: /dashboard with session for user: usuario@email.com
```

### Errores Comunes y Soluciones

| Error | Causa | Solución |
|-------|--------|----------|
| `code challenge does not match` | URLs de callback no coinciden | Verificar configuración en Supabase Dashboard |
| `Invalid redirect URL` | URL no autorizada | Agregar URL a Redirect URLs en Supabase |
| `OAuth provider error` | Configuración incorrecta de Google | Verificar Client ID/Secret en Supabase |
| `Authentication failed - no session` | Problema en el callback | Revisar logs del servidor |

## 🔍 Verificación Final

Para verificar que todo funciona:

1. **Abre la consola del navegador** (F12)
2. **Intenta iniciar sesión con Google**
3. **Verifica que veas los logs** con emojis como se muestra arriba
4. **El usuario debe ser redirigido** al dashboard exitosamente

Si sigues viendo errores PKCE después de seguir estos pasos, revisa que:
- ✅ Las URLs en Supabase Dashboard sean exactas
- ✅ Google Cloud Console tenga las URLs correctas
- ✅ Las variables de entorno estén configuradas
- ✅ No haya conflictos de cookies (prueba en incógnito)

## 📞 Soporte Adicional

Si el problema persiste:
1. Verifica que las URLs no tengan caracteres extra o espacios
2. Prueba en modo incógnito para descartar problemas de cookies
3. Revisa los logs del servidor para más detalles
4. Contacta soporte si el problema persiste después de verificar toda la configuración 