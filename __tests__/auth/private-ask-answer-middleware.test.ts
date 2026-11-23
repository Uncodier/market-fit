/** @jest-environment node */

import { NextRequest } from 'next/server'
import { middleware } from '@/app/middleware'
import { getMiddlewareUser } from '@/lib/supabase/middleware-client'
import { resolveBlockedScreenRedirect } from '@/lib/auth/enforce-screen-access'

jest.mock('@/lib/supabase/middleware-client', () => ({
  copyResponseCookies: jest.fn((_source, target) => target), getMiddlewareUser: jest.fn(),
}))
jest.mock('@/lib/auth/enforce-screen-access', () => ({ resolveBlockedScreenRedirect: jest.fn() }))
jest.mock('@/lib/redis/api-admission', () => ({ enforceApiAdmission: jest.fn() }))

const id = '00000000-0000-4000-8000-000000000001'
const path = `/robots/private-answer/${id}`
const request = (pathname: string) => new NextRequest(`https://app.makinari.com${pathname}`)

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getMiddlewareUser).mockResolvedValue({ user: null, lookupFailed: false })
})

it('preserves the private answer link across sign-in', async () => {
  const response = await middleware(request(path))

  expect(response.status).toBe(307)
  const location = new URL(response.headers.get('location')!)
  expect(location.pathname).toBe('/auth')
  expect(location.searchParams.get('returnTo')).toBe(path)
})

it('forwards signed-in users to the private route without bypassing workspace checks', async () => {
  const user = { id } as NonNullable<Awaited<ReturnType<typeof getMiddlewareUser>>['user']>
  jest.mocked(getMiddlewareUser).mockResolvedValue({ user, lookupFailed: false })
  const req = request(path)
  const response = await middleware(req)

  expect(response.headers.get('location')).toBeNull()
  expect(response.headers.get('x-middleware-next')).toBe('1')
  expect(resolveBlockedScreenRedirect).toHaveBeenCalledWith(req, expect.anything(), id)
})

it.each([`/robots/${id}`, `/instance/${id}`, `/site/${id}/robots/${id}`])(
  'keeps legacy instance redirects for %s', async (pathname) => {
    const response = await middleware(request(pathname))

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/robots')
    expect(location.searchParams.get('instance')).toBe(id)
    expect(getMiddlewareUser).not.toHaveBeenCalled()
  },
)