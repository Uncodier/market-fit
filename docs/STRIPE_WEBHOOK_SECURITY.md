# Stripe Webhook Security Configuration

## 🔐 Configuración del Handshake de Seguridad

Para asegurar que los webhooks vienen realmente de Stripe y no de atacantes, implementamos múltiples capas de seguridad.

## ⚙️ Configuración en Stripe Dashboard

### 1. Crear el Webhook Endpoint

1. **Ve a Stripe Dashboard** → Developers → Webhooks
2. **Clic en "Add endpoint"**
3. **Endpoint URL**: `https://tudominio.com/api/stripe/webhook`
4. **Selecciona estos eventos**:
   ```
   checkout.session.completed
   customer.subscription.created
   customer.subscription.updated
   customer.subscription.deleted
   invoice.payment_succeeded
   ```

### 2. Obtener el Webhook Secret

1. **Después de crear el endpoint**, clic en él
2. **En la sección "Signing secret"**, clic en "Reveal"
3. **Copia el secret** (empezará con `whsec_...`)

### 3. Variables de Entorno

Agrega estas variables a tu `.env.local`:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx... # o sk_live_xxx...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx... # o pk_live_xxx...

# 🔑 CRÍTICO: Webhook Security
STRIPE_WEBHOOK_SECRET=whsec_xxx...

# Subscription Plans
STRIPE_STARTUP_PRICE_ID=price_xxx...
STRIPE_ENTERPRISE_PRICE_ID=price_xxx...
```

## 🛡️ Capas de Seguridad Implementadas

### 1. **Verificación de Firma Criptográfica**
```typescript
// Verificación principal - usa HMAC SHA256
event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
```

### 2. **Validación de Headers**
```typescript
// Verifica que el header stripe-signature esté presente
if (!sig) {
  return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
}
```

### 3. **Verificación de Timestamp**
```typescript
// Rechaza eventos más antiguos de 5 minutos (previene replay attacks)
if (currentTime - eventTimestamp > fiveMinutes) {
  return NextResponse.json({ error: 'Webhook event is too old' }, { status: 400 })
}
```

### 4. **Validación de Configuración**
```typescript
// Verifica que todas las variables estén configuradas
if (!endpointSecret || !process.env.STRIPE_SECRET_KEY) {
  return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
}
```

## 🔍 Logging y Debugging

### En Desarrollo
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('✅ Stripe webhook signature verified successfully')
  console.log(`📝 Event type: ${event.type}`)
  console.log(`🆔 Event ID: ${event.id}`)
}
```

### En Producción
Solo se loggean errores y eventos críticos para evitar spam en los logs.

## 🚨 Manejo de Errores

### Tipos de Errores y Respuestas

| Error | Status | Descripción |
|-------|--------|-------------|
| Missing signature | 400 | Header `stripe-signature` no presente |
| Invalid signature | 400 | Firma no válida (HMAC falló) |
| Event too old | 400 | Timestamp mayor a 5 minutos |
| Missing config | 500 | Variables de entorno no configuradas |

### Respuesta de Error Ejemplo
```json
{
  "error": "Webhook signature verification failed",
  "details": "Invalid signature",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

## ✅ Verificación de Funcionamiento

### 1. **Probar el Webhook**
En Stripe Dashboard → Webhooks → Tu endpoint → "Send test webhook"

### 2. **Logs Esperados** (desarrollo)
```
✅ Stripe webhook signature verified successfully
📝 Event type: checkout.session.completed
🆔 Event ID: evt_xxx...
```

### 3. **Respuesta Exitosa**
```json
{
  "received": true,
  "eventId": "evt_xxx...",
  "eventType": "checkout.session.completed",
  "processed": true,
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

## 🔄 Testing Local

Para testing local con el webhook:

1. **Instala Stripe CLI**:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login a Stripe**:
   ```bash
   stripe login
   ```

3. **Forward webhooks**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Usar el webhook secret del CLI**:
   ```bash
   # Copia el whsec_... que aparece y úsalo en .env.local
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 🚀 Deploy Production

1. **Actualiza el endpoint URL** en Stripe Dashboard
2. **Usa el webhook secret de producción** (no el del CLI)
3. **Verifica que todas las variables estén en producción**

## 📊 Monitoreo

### Stripe Dashboard
- Ve a Webhooks → Tu endpoint
- Revisa la sección "Recent deliveries"
- Verifica que los responses sean 200

### Application Logs
- Busca logs con "❌" para errores
- Busca logs con "✅" para verificaciones exitosas 