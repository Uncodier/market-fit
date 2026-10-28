/** @jest-environment node */
import { GET } from '@/app/api/auth/logout/route'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))

const signOut = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  signOut.mockResolvedValue({ error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { signOut } } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(cookies).mockResolvedValue({ getAll: () => [
    { name: 'sb-127-auth-token.0', value: 'synthetic-session' },
    { name: 'sb-127-auth-token.1', value: 'synthetic-session-continuation' },
    { name: 'market_fit_demo_site_id', value: 'demo-synthetic' },
    { name: 'unrelated-preference', value: 'keep' },
  ] } as unknown as Awaited<ReturnType<typeof cookies>>)
})

it.each([
  'http://localhost:37695/api/auth/logout',
  'http://127.0.0.1:3000/api/auth/logout',
  'https://app.makinari.com/api/auth/logout',
  'https://www.makinari.com/api/auth/logout',
])('keeps logout on the browser origin for %s', async url => {
  const response = await GET(new Request(url))
  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/auth')
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(response.cookies.get('sb-127-auth-token.0')?.value).toBe('')
  expect(response.cookies.get('sb-127-auth-token.1')?.maxAge).toBe(0)
  expect(response.cookies.get('market_fit_demo_site_id')?.maxAge).toBe(0)
  expect(response.cookies.get('unrelated-preference')).toBeUndefined()
})

it('does not redirect to client returnTo, Origin or forwarded-host values', async () => {
  const response = await GET(new Request('http://localhost:37695/api/auth/logout?returnTo=https://evil.invalid', {
    headers: { host: 'evil.invalid', origin: 'https://evil.invalid', 'x-forwarded-host': 'evil.invalid' },
  }))
  expect(response.headers.get('location')).toBe('/auth')
})

it('clears cookies even when the original session can no longer be signed out', async () => {
  signOut.mockRejectedValueOnce(new Error('Expired synthetic session'))
  const response = await GET(new Request('http://localhost:37695/api/auth/logout'))
  expect(response.headers.get('location')).toBe('/auth')
  expect(response.cookies.get('sb-127-auth-token.0')?.maxAge).toBe(0)
})