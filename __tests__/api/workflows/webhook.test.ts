import { NextRequest } from 'next/server'
import { POST, GET } from '@/app/api/workflows/webhook/route'

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-lead-id',
              name: 'Test Lead',
              email: 'test@example.com',
              status: 'new'
            },
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'test-task-id' },
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      }))
    }))
  }))
}))

describe('/api/workflows/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('should return webhook information', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Workflow webhook endpoint is active')
      expect(data.usage).toContain('POST to this endpoint')
      expect(data.expected_payload).toBeDefined()
    })
  })

  describe('POST', () => {
    it('should handle leadFollowUp response_received successfully', async () => {
      const requestBody = {
        workflow_type: 'leadFollowUp',
        event_type: 'response_received',
        lead_id: 'test-lead-id',
        site_id: 'test-site-id',
        user_id: 'test-user-id',
        response_data: {
          message: 'Lead responded to follow-up email',
          response_type: 'email',
          response_content: 'Thanks for reaching out!',
          timestamp: new Date().toISOString()
        }
      }

      const request = new NextRequest('http://localhost:3000/api/workflows/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Follow-up response processed successfully')
      expect(data.data.lead_id).toBe('test-lead-id')
      expect(data.data.task_created).toBe(true)
      expect(data.data.notification_sent).toBe(true)
    })

    it('should handle workflow_completed events', async () => {
      const requestBody = {
        workflow_type: 'leadResearch',
        event_type: 'workflow_completed',
        lead_id: 'test-lead-id',
        site_id: 'test-site-id',
        user_id: 'test-user-id'
      }

      const request = new NextRequest('http://localhost:3000/api/workflows/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Workflow completion processed')
      expect(data.data.workflow_type).toBe('leadResearch')
    })

    it('should handle workflow_failed events', async () => {
      const requestBody = {
        workflow_type: 'leadFollowUp',
        event_type: 'workflow_failed',
        lead_id: 'test-lead-id',
        site_id: 'test-site-id',
        user_id: 'test-user-id',
        metadata: {
          error_type: 'email_delivery_failed',
          error_message: 'SMTP server rejected recipient'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/workflows/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Workflow failure processed')
      expect(data.data.workflow_type).toBe('leadFollowUp')
    })

    it('should return 400 for invalid payload', async () => {
      const requestBody = {
        invalid_field: 'invalid_value'
      }

      const request = new NextRequest('http://localhost:3000/api/workflows/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid webhook payload')
      expect(data.details).toBeDefined()
    })

    it('should handle different workflow types', async () => {
      const workflowTypes = ['leadFollowUp', 'leadResearch', 'syncEmails', 'dailyStandUp', 'leadGeneration', 'assignLeads']
      
      for (const workflowType of workflowTypes) {
        const requestBody = {
          workflow_type: workflowType,
          event_type: 'workflow_completed',
          lead_id: 'test-lead-id',
          site_id: 'test-site-id',
          user_id: 'test-user-id'
        }

        const request = new NextRequest('http://localhost:3000/api/workflows/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.workflow_type).toBe(workflowType)
      }
    })

    it('should handle missing lead gracefully', async () => {
      // Mock Supabase to return no lead found
      const mockSupabase = require('@supabase/supabase-js').createClient()
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Lead not found' }
      })

      const requestBody = {
        workflow_type: 'leadFollowUp',
        event_type: 'response_received',
        lead_id: 'non-existent-lead-id',
        site_id: 'test-site-id',
        user_id: 'test-user-id'
      }

      const request = new NextRequest('http://localhost:3000/api/workflows/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Lead not found')
    })
  })
}) 