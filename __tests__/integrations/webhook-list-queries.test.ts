import { listWebhookEndpoints, listWebhookSubscriptions } from '@/lib/webhooks'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

it('reads only displayed webhook fields with site/endpoint RLS filters and cancellation', async () => {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockResolvedValue({ data: [], error: null }) }
  const from = jest.fn().mockReturnValue(query)
  jest.mocked(createClient).mockReturnValue({ from } as never)
  const signal = new AbortController().signal
  await listWebhookEndpoints('site', signal)
  await listWebhookSubscriptions('site', 'endpoint', signal)
  expect(from.mock.calls).toEqual([['webhooks_endpoints'], ['webhooks_subscriptions']])
  expect(query.select.mock.calls).toEqual([['id, name, target_url'], ['event_type, is_active']])
  expect(query.eq.mock.calls).toEqual([['site_id', 'site'], ['site_id', 'site'], ['endpoint_id', 'endpoint']])
  expect(query.abortSignal.mock.calls).toEqual([[signal], [signal]])
})