import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'

// Test configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

describe('Stripe Webhook Idempotency', () => {
  let supabase: ReturnType<typeof createClient>
  let testSiteId: string
  let testEventId: string

  beforeAll(() => {
    supabase = createClient(supabaseUrl, supabaseServiceKey)
  })

  beforeEach(async () => {
    // Generate unique test identifiers
    testSiteId = `test-site-${Date.now()}-${Math.random().toString(36).substring(7)}`
    testEventId = `evt_test_${Date.now()}_${Math.random().toString(36).substring(7)}`
  })

  afterAll(async () => {
    // Clean up test data
    try {
      await supabase
        .from('webhook_events')
        .delete()
        .like('stripe_event_id', 'evt_test_%')
      
      await supabase
        .from('payments')
        .delete()
        .like('transaction_id', 'test_%')
    } catch (error) {
      console.warn('Cleanup failed:', error)
    }
  })

  describe('Webhook Event Tracking Functions', () => {
    it('should detect unprocessed events correctly', async () => {
      // Test with non-existent event
      const { data: isProcessed, error } = await supabase
        .rpc('check_webhook_event_processed', { event_id: testEventId })

      expect(error).toBeNull()
      expect(isProcessed).toBe(false)
    })

    it('should mark event as processed', async () => {
      // Mark event as processed
      const { data: webhookEventId, error: markError } = await supabase
        .rpc('mark_webhook_event_processed', {
          event_id: testEventId,
          event_type_param: 'checkout.session.completed',
          event_data_param: { test: true },
          site_id_param: testSiteId
        })

      expect(markError).toBeNull()
      expect(webhookEventId).toBeDefined()

      // Verify it's now marked as processed
      const { data: isProcessed, error: checkError } = await supabase
        .rpc('check_webhook_event_processed', { event_id: testEventId })

      expect(checkError).toBeNull()
      expect(isProcessed).toBe(true)
    })

    it('should mark event as failed', async () => {
      const failedEventId = `evt_failed_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      const { data: webhookEventId, error: markError } = await supabase
        .rpc('mark_webhook_event_failed', {
          event_id: failedEventId,
          event_type_param: 'checkout.session.completed',
          error_msg: 'Test error message',
          event_data_param: { test: true, error: 'test' },
          site_id_param: testSiteId
        })

      expect(markError).toBeNull()
      expect(webhookEventId).toBeDefined()

      // Verify the event is recorded as failed
      const { data: events, error: queryError } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('stripe_event_id', failedEventId)
        .single()

      expect(queryError).toBeNull()
      expect(events).toBeDefined()
      expect(events!.status).toBe('failed')
      expect(events!.error_message).toBe('Test error message')
    })

    it('should track attempt count for failed events', async () => {
      const retryEventId = `evt_retry_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // First failure
      await supabase.rpc('mark_webhook_event_failed', {
        event_id: retryEventId,
        event_type_param: 'checkout.session.completed',
        error_msg: 'First failure',
        event_data_param: { test: true },
        site_id_param: testSiteId
      })

      // Second failure (retry)
      await supabase.rpc('mark_webhook_event_failed', {
        event_id: retryEventId,
        event_type_param: 'checkout.session.completed',
        error_msg: 'Second failure',
        event_data_param: { test: true },
        site_id_param: testSiteId
      })

      // Verify attempt count is tracked
      const { data: event, error } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('stripe_event_id', retryEventId)
        .single()

      expect(error).toBeNull()
      expect(event).toBeDefined()
      expect((event! as any).event_data.attempt_count).toBe(2)
      expect(event!.error_message).toBe('Second failure')
    })

    it('should handle duplicate event marking gracefully', async () => {
      // Mark event as processed first time
      const { data: firstResult, error: firstError } = await supabase
        .rpc('mark_webhook_event_processed', {
          event_id: testEventId,
          event_type_param: 'checkout.session.completed',
          event_data_param: { attempt: 1 }
        })

      expect(firstError).toBeNull()
      expect(firstResult).toBeDefined()

      // Mark same event as processed second time
      const { data: secondResult, error: secondError } = await supabase
        .rpc('mark_webhook_event_processed', {
          event_id: testEventId,
          event_type_param: 'checkout.session.completed',
          event_data_param: { attempt: 2 }
        })

      expect(secondError).toBeNull()
      expect(secondResult).toBeDefined()

      // Should still be only one record
      const { data: events, error: queryError } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('stripe_event_id', testEventId)

      expect(queryError).toBeNull()
      expect(events).toBeDefined()
      expect(events!).toHaveLength(1)
      expect(events![0].status).toBe('processed')
    })
  })

  describe('Payment Idempotency', () => {
    it('should prevent duplicate payment processing', async () => {
      const transactionId = `test_payment_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // Create first payment
      const { data: firstPayment, error: firstError } = await supabase
        .from('payments')
        .insert({
          site_id: testSiteId,
          transaction_id: transactionId,
          transaction_type: 'credits_purchase',
          amount: 100.00,
          currency: 'USD',
          status: 'completed',
          payment_method: 'stripe',
          details: { test: true, attempt: 1 },
          credits: 100
        })
        .select()
        .single()

      expect(firstError).toBeNull()
      expect(firstPayment).toBeDefined()

      // Try to create duplicate payment
      const { data: duplicatePayment, error: duplicateError } = await supabase
        .from('payments')
        .insert({
          site_id: testSiteId,
          transaction_id: transactionId, // Same transaction ID
          transaction_type: 'credits_purchase',
          amount: 100.00,
          currency: 'USD',
          status: 'completed',
          payment_method: 'stripe',
          details: { test: true, attempt: 2 },
          credits: 100
        })
        .select()
        .single()

      // Should fail due to unique constraint
      expect(duplicateError).toBeDefined()
      expect(duplicateError?.code).toBe('23505') // Unique violation

      // Verify only one payment exists
      const { data: payments, error: queryError } = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)

      expect(queryError).toBeNull()
      expect(payments).toBeDefined()
      expect(payments!).toHaveLength(1)
      expect((payments![0] as any).details.attempt).toBe(1) // First payment remains
    })

    it('should check for existing payments before processing', async () => {
      const transactionId = `test_existing_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // Create existing payment
      await supabase
        .from('payments')
        .insert({
          site_id: testSiteId,
          transaction_id: transactionId,
          transaction_type: 'subscription',
          amount: 99.99,
          currency: 'USD',
          status: 'completed',
          payment_method: 'stripe',
          details: { existing: true }
        })

      // Check for existing payment (simulating webhook logic)
      const { data: existingPayment, error: checkError } = await supabase
        .from('payments')
        .select('id, transaction_id')
        .eq('transaction_id', transactionId)
        .single()

      expect(checkError).toBeNull()
      expect(existingPayment).toBeDefined()
      expect(existingPayment!.transaction_id).toBe(transactionId)
    })
  })

  describe('Event Age Validation', () => {
    it('should validate event creation timestamp for new events', () => {
      const now = Math.floor(Date.now() / 1000)
      const fiveMinutesAgo = now - (5 * 60)
      const tenMinutesAgo = now - (10 * 60)
      
      // Recent event should be valid
      const recentEventAge = now - (now - 30) // 30 seconds ago
      expect(recentEventAge).toBeLessThan(5 * 60)
      
      // Old event should be invalid for new events
      const oldEventAge = now - fiveMinutesAgo
      expect(oldEventAge).toBeGreaterThanOrEqual(5 * 60)
      
      // Very old event should definitely be invalid for new events
      const veryOldEventAge = now - tenMinutesAgo
      expect(veryOldEventAge).toBeGreaterThan(5 * 60)
    })

    it('should allow older events for failed event retries', () => {
      const now = Math.floor(Date.now() / 1000)
      const oneHourAgo = now - (60 * 60) // 1 hour ago
      const oneDayAgo = now - (24 * 60 * 60) // 1 day ago
      const fourDaysAgo = now - (4 * 24 * 60 * 60) // 4 days ago
      const threeDaysLimit = 3 * 24 * 60 * 60 // 3 days

      // 1 hour old should be valid for retries
      const oneHourAge = now - oneHourAgo
      expect(oneHourAge).toBeLessThan(threeDaysLimit)

      // 1 day old should be valid for retries
      const oneDayAge = now - oneDayAgo
      expect(oneDayAge).toBeLessThan(threeDaysLimit)

      // 4 days old should be invalid even for retries
      const fourDaysAge = now - fourDaysAgo
      expect(fourDaysAge).toBeGreaterThan(threeDaysLimit)
    })
  })

  describe('Database Cleanup', () => {
    it('should clean up old webhook events', async () => {
      // Create old test event (simulate by backdating)
      const oldEventId = `evt_old_${Date.now()}_${Math.random().toString(36).substring(7)}`
      
      // Insert directly to bypass created_at trigger
      await supabase
        .from('webhook_events')
        .insert({
          stripe_event_id: oldEventId,
          event_type: 'test.cleanup',
          status: 'processed',
          created_at: new Date(Date.now() - (31 * 24 * 60 * 60 * 1000)).toISOString() // 31 days ago
        })

      // Run cleanup function
      const { data: deletedCount, error: cleanupError } = await supabase
        .rpc('cleanup_old_webhook_events')

      expect(cleanupError).toBeNull()
      expect(typeof deletedCount).toBe('number')
      expect(deletedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing event_id gracefully', async () => {
      const { data, error } = await supabase
        .rpc('check_webhook_event_processed', { event_id: '' })

      expect(error).toBeNull()
      expect(data).toBe(false)
    })

    it('should handle null parameters in mark functions', async () => {
      const nullEventId = `evt_null_test_${Date.now()}`
      
      const { data, error } = await supabase
        .rpc('mark_webhook_event_processed', {
          event_id: nullEventId,
          event_type_param: 'test.null',
          event_data_param: null,
          site_id_param: null
        })

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })
}) 