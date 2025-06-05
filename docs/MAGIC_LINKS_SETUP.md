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
http://localhost:3000/auth/team-invitation
https://your-production-domain.com/auth/team-invitation
```

### 3. Email Templates (Opcional)

Puedes personalizar el template de email en **Authentication > Email Templates > Magic Link**:

```html
<h2>You've been invited to join a team!</h2>
<p>Click the link below to accept your invitation:</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
<p>This link expires in 24 hours.</p>
```

## Cómo Funciona el Nuevo Sistema

### 1. Envío de Invitación

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

### Los emails no llegan
- Revisa la configuración de SMTP en Supabase
- Verifica que el dominio del email esté permitido
- Checa la carpeta de spam

## Ventajas del Nuevo Sistema

1. **Simplicidad**: No más configuración de SendGrid
2. **Seguridad**: Links expiran automáticamente
3. **Integración**: Usa la infraestructura nativa de Supabase
4. **Mantenimiento**: Menos código y dependencias externas
5. **Confiabilidad**: Mejor entregabilidad de emails 