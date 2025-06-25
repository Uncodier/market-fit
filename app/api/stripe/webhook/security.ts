import Stripe from 'stripe'

/**
 * Security utilities for Stripe webhooks
 */

/**
 * Validates that the event is from a trusted source
 */
export function validateEventSource(event: Stripe.Event): boolean {
  // Check that event has required properties
  if (!event.id || !event.type || !event.created) {
    return false
  }

  // Validate event ID format (should start with evt_)
  if (!event.id.startsWith('evt_')) {
    return false
  }

  return true
}

/**
 * Validates that the event is recent enough to process
 */
export function validateEventTimestamp(event: Stripe.Event, maxAgeMinutes: number = 5): boolean {
  const eventTimestamp = event.created * 1000 // Convert to milliseconds
  const currentTime = Date.now()
  const maxAge = maxAgeMinutes * 60 * 1000 // Convert to milliseconds

  return (currentTime - eventTimestamp) <= maxAge
}

/**
 * Validates that the webhook endpoint secret is properly configured
 */
export function validateWebhookConfig(): { valid: boolean; error?: string } {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return { 
      valid: false, 
      error: 'STRIPE_WEBHOOK_SECRET environment variable is not set' 
    }
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return { 
      valid: false, 
      error: 'STRIPE_SECRET_KEY environment variable is not set' 
    }
  }

  // Validate webhook secret format
  if (!process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    return { 
      valid: false, 
      error: 'STRIPE_WEBHOOK_SECRET must start with whsec_' 
    }
  }

  return { valid: true }
}

/**
 * Sanitizes and logs webhook security information
 */
export function logSecurityEvent(
  type: 'success' | 'failure' | 'warning',
  event: Stripe.Event | null,
  details: Record<string, any> = {}
) {
  const timestamp = new Date().toISOString()
  const logData = {
    timestamp,
    type,
    eventId: event?.id || 'unknown',
    eventType: event?.type || 'unknown',
    ...details
  }

  switch (type) {
    case 'success':
      if (process.env.NODE_ENV === 'development') {
        console.log('🔐 Webhook Security Success:', logData)
      }
      break
    case 'failure':
      console.error('🚨 Webhook Security Failure:', logData)
      break
    case 'warning':
      console.warn('⚠️ Webhook Security Warning:', logData)
      break
  }
}

/**
 * Rate limiting for webhook endpoints (basic implementation)
 */
const webhookAttempts = new Map<string, { count: number; lastAttempt: number }>()

export function checkRateLimit(clientIP: string, maxAttempts: number = 50, windowMinutes: number = 5): boolean {
  const now = Date.now()
  const windowMs = windowMinutes * 60 * 1000
  
  const attempts = webhookAttempts.get(clientIP)
  
  if (!attempts) {
    webhookAttempts.set(clientIP, { count: 1, lastAttempt: now })
    return true
  }

  // Reset if outside window
  if (now - attempts.lastAttempt > windowMs) {
    webhookAttempts.set(clientIP, { count: 1, lastAttempt: now })
    return true
  }

  // Check if under limit
  if (attempts.count < maxAttempts) {
    attempts.count++
    attempts.lastAttempt = now
    return true
  }

  return false
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimit() {
  const now = Date.now()
  const maxAge = 5 * 60 * 1000 // 5 minutes

  webhookAttempts.forEach((data, ip) => {
    if (now - data.lastAttempt > maxAge) {
      webhookAttempts.delete(ip)
    }
  })
} 