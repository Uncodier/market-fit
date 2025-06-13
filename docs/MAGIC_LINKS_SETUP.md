# Magic Links Setup for Team Invitations

Este documento explica cómo configurar Magic Links de Supabase para reemplazar el sistema de invitaciones SendGrid.

## ¿Qué son los Magic Links?

Los Magic Links de Supabase son enlaces de autenticación sin contraseña que se envían por email. Son más simples y seguros que el sistema anterior de SendGrid porque:

- ✅ No requieren configuración externa de email
- ✅ Usan la infraestructura de email de Supabase
- ✅ Expiran automáticamente por seguridad
- ✅ Manejan automáticamente la autenticación del usuario
- ✅ Simplifican el flujo de invitaciones

## Configuración Requerida

### 1. Variables de Entorno

Asegúrate de tener estas variables en tu `.env.local`:

```bash
# URL de tu aplicación (requerida para redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (ya deberías tenerlas)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Configuración en Supabase Dashboard

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **Authentication > URL Configuration**
3. Agrega estas URLs:

#### Site URLs (permitidas para redirects):
```
http://localhost:3000
https://your-production-domain.com
```

#### Redirect URLs (para magic links):
```
http://localhost:3000/api/auth/callback
https://your-production-domain.com/api/auth/callback
```

**⚠️ IMPORTANTE:** Estas URLs deben estar **exactamente configuradas** en Supabase Dashboard, de lo contrario el usuario no se autenticará y solo verá la pantalla de login.

**Pasos para configurar:**
1. Ve a [Supabase Dashboard](https://supabase.com/dashboard) → Tu proyecto
2. **Authentication** → **URL Configuration** 
3. En **Redirect URLs** agrega:
   - `http://localhost:3000/api/auth/callback`
   - `https://tu-dominio-produccion.com/api/auth/callback`
4. **Guarda los cambios**

**Verificación:**
- Si el usuario ve la pantalla de login = URL no configurada ❌
- Si el usuario se autentica automáticamente = URL configurada correctamente ✅

### 3. Email Templates (Requerido)

**IMPORTANTE:** Para invitaciones de equipo usamos el template **"Magic Link"** que es más confiable para autenticación.

Configura el template de **"Magic Link"** en **Authentication > Email Templates > Magic Link**:

```html
<h2>You've been invited to join {{ .Data.siteName }}!</h2>
<p>Hello {{ .Data.name }},</p>
<p>You've been invited to join the team at <strong>{{ .Data.siteName }}</strong> as a {{ .Data.role }}.</p>
<p>Click the link below to accept your invitation:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
<p>If you already have an account, you'll be logged in automatically. If not, a new account will be created for you.</p>
<p>This invitation expires in 24 hours.</p>
<p>Welcome to the team!</p>
```

**¿Por qué Magic Link en lugar de Invite user?**
- ✅ **Flujo de autenticación más simple** - No hay "wall guardian" ni códigos extra
- ✅ **Funciona para usuarios existentes y nuevos** - Un solo método para todos
- ✅ **Mejor experiencia de usuario** - Click directo y autenticación automática
- ✅ **Menos problemas de configuración** - Un solo template para personalizar

## Cómo Funciona el Nuevo Sistema

### 1. Envío de Invitación

El sistema ahora usa un **flujo unificado con Magic Links** para todos los usuarios:

#### Para todos los usuarios (existentes y nuevos):
- Se envía un **Magic Link** usando `signInWithOtp()` con `shouldCreateUser: true`
- Usa el template "Magic Link" personalizado para invitaciones
- Si el usuario existe: autentica directamente
- Si el usuario no existe: Supabase crea la cuenta automáticamente
- En ambos casos: click en el link → autenticación → página de invitación

**Ventajas del flujo unificado:**
- 🔒 **Sin wall guardian** - Autenticación directa y segura
- 🎯 **Un solo template** - Más fácil de configurar y mantener
- ⚡ **Experiencia fluida** - Click directo, sin códigos extras

### 2. API Route para Invitaciones

El sistema ahora usa una API route (`/api/team/invite-member`) que:

1. **Valida permisos**: Verifica que el usuario tenga permisos para invitar
2. **Envía Magic Link unificado**: Usa `signInWithOtp()` con `shouldCreateUser: true`
3. **Maneja todos los casos**: Usuarios existentes y nuevos en un solo flujo
4. **Maneja errores**: Proporciona mensajes de error claros incluindo rate limits

### 3. Procesamiento de Invitación

Cuando se agrega un nuevo miembro:

```typescript
// En site-members-service.ts
const result = await sendMagicLinkInvitation({
  email: member.email,
  siteId: siteId,
  siteName: siteName,
  role: invitationRole,
  name: member.name,
  position: member.position
});
```

### 2. Procesamiento de la Invitación

El usuario recibe un email con un magic link que lo lleva a:
```
/auth/team-invitation?siteId=xxx&siteName=xxx&role=xxx&name=xxx&position=xxx
```

### 3. Autenticación y Adición al Equipo

La página `/auth/team-invitation` automáticamente:
1. Autentica al usuario usando el magic link
2. Valida la invitación
3. Agrega al usuario al equipo
4. Redirige al dashboard del sitio

## Migración desde SendGrid

### Archivos Modificados

1. **Nuevo archivo**: `app/services/magic-link-invitation-service.ts`
   - Implementa `sendMagicLinkInvitation()`
   - Implementa `resendMagicLinkInvitation()`
   - Implementa `processTeamInvitation()`

2. **Nuevo archivo**: `app/auth/team-invitation/page.tsx`
   - Página de destino para procesar invitaciones

3. **Modificado**: `app/services/site-members-service.ts`
   - Cambiado de `sendTeamInvitation()` a `sendMagicLinkInvitation()`

4. **Modificado**: `app/components/settings/TeamSection.tsx`
   - Cambiado de `resendTeamInvitation()` a `resendMagicLinkInvitation()`

### Archivos Obsoletos (se pueden eliminar)

- `app/services/team-invitation-service.ts` (SendGrid)
- Cualquier configuración de SendGrid en variables de entorno

## Testing

### En Desarrollo

1. Agrega un nuevo miembro al equipo
2. Revisa los logs para ver el magic link generado
3. Copia el link y ábrelo en una nueva ventana
4. Verifica que el usuario sea agregado correctamente

### En Producción

1. Configura las URLs de producción en Supabase
2. Prueba el flujo completo con un email real
3. Verifica que los emails lleguen correctamente

## Solución de Problemas

### Error: "Invalid redirect URL"
- Verifica que la URL esté configurada en Supabase Dashboard
- Asegúrate de que `NEXT_PUBLIC_APP_URL` esté configurada

### Error: "User not found"
- El usuario debe autenticarse primero con el magic link
- Verifica que el email en la invitación coincida con el email autenticado

### Error: "email rate limit exceeded"
**Causa:** Supabase limita el número de Magic Links que se pueden enviar por email por período de tiempo.

**Límites de Supabase:**
- **Desarrollo:** ~3-5 emails por minuto por email
- **Producción:** Límites más altos dependiendo del plan

**Soluciones:**
1. **Durante Desarrollo:**
   ```bash
   # Espera 1-2 minutos entre invitaciones al mismo email
   # Usa diferentes emails para pruebas
   # Verifica logs de Supabase Dashboard para ver rate limits
   ```

2. **En Producción:**
   - Upgrade a un plan de Supabase con límites más altos
   - Implementa validación del lado cliente para evitar envíos duplicados
   - Considera usar webhooks para notificaciones críticas

3. **Manejo en Código:**
   ```typescript
   // El sistema ya maneja rate limits automáticamente
   // Muestra mensajes específicos al usuario
   // Sugiere tiempo de espera antes de reintentar
   ```

### Error: "Los emails de invitación no llegan"
**Causa más común:** Template no configurado correctamente

**Diagnóstico:**
1. **Verifica en Supabase Dashboard > Logs & Analytics** qué requests llegan:
   - ✅ `/auth/v1/verify?type=signup` = Confirmación de cuenta (funciona)
   - ✅ `/auth/v1/otp` = Magic link (debería aparecer para invitaciones)

2. **Verifica template en Supabase Dashboard:**
   - Ve a **Authentication > Email Templates > Magic Link**
   - Personaliza el template para invitaciones como se muestra arriba

**Solución:**
```typescript
// ✅ CORRECTO (usa template "Magic Link" personalizado)
await supabase.auth.signInWithOtp({ 
  email, 
  options: { 
    shouldCreateUser: true,
    emailRedirectTo: redirectTo,
    data: { /* invitation data */ }
  } 
})
```

**Template recomendado:**
- Personaliza el texto para que sea claro que es una invitación
- Incluye variables como `{{ .Data.siteName }}` y `{{ .Data.role }}`
- Mantén la funcionalidad de autenticación automática

### Error: "signInWithOtp envía verify email en lugar de Magic Link"

**Problema:** `signInWithOtp()` está enviando emails de verificación en lugar de Magic Links.

**✅ SOLUCIÓN IMPLEMENTADA:** El sistema ahora **funciona con ambos tipos de email**:

1. **Magic Link** (preferido) - Autenticación directa
2. **Email Verify** (backup) - Verificación + autenticación via callback

**Cómo funciona:**
```
1. Usuario hace clic en email (Magic Link O email verify)
2. Supabase autentica → Redirige a /api/auth/callback
3. Callback detecta `invitationType=team_invitation`
4. Callback redirige a /auth/team-invitation con los datos
5. Procesamiento automático de la invitación
```

**URLs de redirección actualizadas:**
- Ahora todos los emails redirigen a `/api/auth/callback` con parámetros de invitación
- El callback maneja la detección automática del tipo de flujo
- Funciona independientemente del template de email que use Supabase

**No necesitas configurar templates específicos** - funciona con cualquier configuración de Supabase.

## Ventajas del Nuevo Sistema

1. **Simplicidad**: No más configuración de SendGrid
2. **Seguridad**: Links expiran automáticamente
3. **Integración**: Usa la infraestructura nativa de Supabase
4. **Mantenimiento**: Menos código y dependencias externas
5. **Confiabilidad**: Mejor entregabilidad de emails 