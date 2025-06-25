# Stripe Integration Setup

Esta documentación explica cómo configurar la integración con Stripe para el checkout de créditos y suscripciones.

## Variables de Entorno

Añadir las siguientes variables al archivo `.env.local`:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs para suscripciones
STRIPE_STARTUP_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

## Configuración en Stripe Dashboard

### 1. Crear Productos y Precios

#### Productos de Suscripción:
- **Startup Plan**: $99/mes
- **Enterprise Plan**: $500/mes

#### Productos de Créditos (one-time payments):
- **20 Credits**: $20
- **52 Credits**: $49.25
- **515 Credits**: $500

### 2. Configurar Webhooks

URL del webhook: `https://tu-dominio.com/api/stripe/webhook`

Eventos a escuchar:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated` 
- `customer.subscription.deleted`
- `invoice.payment_succeeded`

### 3. Configurar URLs de Retorno

- **Success URL**: `https://tu-dominio.com/billing/success`
- **Cancel URL**: `https://tu-dominio.com/billing`

## Funcionalidades Implementadas

### 1. Checkout de Créditos (`/checkout`)
- Selección de paquetes de créditos
- Checkout seguro vía Stripe
- Actualización automática de créditos después del pago
- Página de confirmación

### 2. Checkout de Suscripciones
- Planes Startup y Enterprise
- Gestión automática de suscripciones
- Renovación automática
- Actualización de estado vía webhooks

### 3. Webhook de Stripe (`/api/stripe/webhook`)
- Procesamiento automático de pagos exitosos
- Actualización de créditos en la base de datos
- Registro de transacciones
- Gestión de estados de suscripción

### 4. Base de Datos

#### Tabla `billing`:
- Información del cliente en Stripe
- Estado de suscripción
- Créditos disponibles
- Plan actual

#### Tabla `payments`:
- Historial de pagos
- Tipos: `credits_purchase`, `subscription`
- Metadatos de Stripe

## APIs Creadas

### `POST /api/stripe/checkout/credits`
Crea sesión de Stripe Checkout para compra de créditos.

**Parámetros:**
```json
{
  "credits": 20,
  "amount": 20,
  "siteId": "uuid",
  "userEmail": "user@example.com",
  "successUrl": "https://...",
  "cancelUrl": "https://..."
}
```

### `POST /api/stripe/checkout/subscription`
Crea sesión de Stripe Checkout para suscripciones.

**Parámetros:**
```json
{
  "plan": "startup",
  "siteId": "uuid", 
  "userEmail": "user@example.com",
  "successUrl": "https://...",
  "cancelUrl": "https://..."
}
```

### `POST /api/stripe/webhook`
Procesa eventos de Stripe automáticamente.

## Funciones de Supabase

### `add_credits(p_site_id, p_credits)`
Añade créditos a la cuenta de un sitio.

### `upsert_billing(...)`
Actualiza o crea información de facturación.

## Flujo de Usuario

### Compra de Créditos:
1. Usuario selecciona paquete en `/billing`
2. Redirige a `/checkout?credits=20`
3. Clic en "Purchase Credits" → Stripe Checkout
4. Pago exitoso → Webhook actualiza créditos
5. Redirige a `/billing/success`

### Suscripción:
1. Usuario selecciona plan en `/billing`
2. Clic en "Save Billing Info" → Stripe Checkout
3. Pago exitoso → Webhook actualiza suscripción
4. Redirige a `/billing/success`

## Seguridad

- ✅ No se almacenan datos de tarjetas en la base de datos
- ✅ Toda la información sensible se maneja en Stripe
- ✅ Webhooks verificados con firma de Stripe
- ✅ RLS policies en Supabase para proteger datos
- ✅ Validación de paquetes de créditos en servidor

## Testing

Para probar en modo desarrollo:
1. Usar claves de test de Stripe (`sk_test_...`, `pk_test_...`)
2. Usar números de tarjeta de prueba de Stripe
3. Configurar webhook con ngrok o similar para desarrollo local

## Monitoreo

- Logs en Stripe Dashboard para pagos
- Logs en aplicación para webhooks
- Tabla `payments` para auditoría
- Métricas de conversión en Stripe

## Migración

Ejecutar la migración SQL:
```bash
psql -f migrations/stripe_billing_functions.sql
```

O aplicar directamente en Supabase Dashboard. 