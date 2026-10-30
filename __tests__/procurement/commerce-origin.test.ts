/** @jest-environment node */
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { isProcurementRequestOrigin } from '@/app/api/procurement/request-origin'
import { commerceBody } from '@/app/api/procurement/commerce/http'
import { credentialAccess } from '@/app/api/procurement/credentials/access'
import { POST as quotes } from '@/app/api/procurement/commerce/quotes/route'
import { POST as receipts } from '@/app/api/procurement/commerce/receipts/route'
import { POST as approvals } from '@/app/api/procurement/commerce/approvals/route'
import { POST as submissions } from '@/app/api/procurement/commerce/submissions/route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))

function request(origin: string, contentType = 'application/json', extra = {}) {
  return new Request('https://app.makinari.com/api/procurement/commerce/submissions', {
    method: 'POST', headers: { origin, 'content-type': contentType, ...extra }, body: '{}',
  })
}

beforeEach(() => jest.clearAllMocks())

test.each([quotes, receipts, approvals, submissions])('rejects cross-origin commerce writes before auth or RPC', async handler => {
  for (const origin of ['https://evil.example', 'null', 'https://www.makinari.com.evil.example']) {
    const response = await handler(request(origin, 'text/plain;application/json'))
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  }
  expect(createClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(requireSiteAccess).not.toHaveBeenCalled()
})

test.each(['text/plain;application/json', 'application/jsonp', 'multipart/form-data'])('rejects disguised JSON MIME %s', async mime => {
  expect(await commerceBody(request('https://app.makinari.com', mime))).toBeNull()
})

test('accepts real JSON including charset parameters', async () => {
  expect(await commerceBody(request('https://app.makinari.com', 'application/json; charset=utf-8'))).toEqual({})
})

test.each(['https://www.makinari.com', 'https://makinari.com', 'https://app.makinari.com'])(
  'supports trusted public origin %s without skipping credential authentication', async origin => {
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
    expect(isProcurementRequestOrigin(request(origin))).toBe(true)
    const result = await credentialAccess(request(origin))
    expect(result.error?.status).toBe(401)
    expect(createClient).toHaveBeenCalledWith(true)
  },
)

test('never trusts forwarded hosts, arbitrary targets or explicit cross-site metadata', () => {
  expect(isProcurementRequestOrigin(request('https://evil.example', 'application/json', {
    'x-forwarded-host': 'www.makinari.com', host: 'www.makinari.com',
  }))).toBe(false)
  expect(isProcurementRequestOrigin(request('https://www.makinari.com', 'application/json', {
    'sec-fetch-site': 'cross-site',
  }))).toBe(false)
  expect(isProcurementRequestOrigin(new Request('https://preview.example/api/procurement/credentials', {
    headers: { origin: 'https://www.makinari.com' },
  }))).toBe(false)
})