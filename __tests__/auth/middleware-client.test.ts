/** @jest-environment node */
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getMiddlewareUser } from '@/lib/supabase/middleware-client'

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))
const mockedCreateClient = jest.mocked(createServerClient)

function setup(getUser: () => Promise<unknown>) {
  const request = new NextRequest('https://app.test/pos')
  request.cookies.set('sb-project-auth-token', 'synthetic-session')
  const response = NextResponse.next()
  mockedCreateClient.mockReturnValue({ auth: { getUser } } as unknown as ReturnType<typeof createServerClient>)
  const pending = getMiddlewareUser(request, response)
  const cookies = mockedCreateClient.mock.calls[0][2].cookies as CookieMethodsServer
  return { request, response, pending, cookies }
}

describe('middleware auth operation lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockedCreateClient.mockReset()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    expect(jest.getTimerCount()).toBe(0)
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('bounds an SDK lock that never reaches fetch and refuses late cookie callbacks', async () => {
    const { request, response, pending, cookies } = setup(() => new Promise(() => {}))
    await jest.advanceTimersByTimeAsync(8_000)
    await expect(pending).resolves.toEqual({ user: null, lookupFailed: true })
    await cookies.setAll!([{ name: 'sb-project-auth-token', value: 'late-token', options: {} }])
    expect(request.cookies.get('sb-project-auth-token')?.value).toBe('synthetic-session')
    expect(response.cookies.getAll()).toEqual([])
  })

  it('refuses cookie writes after successful completion, not just after timeout', async () => {
    const { request, response, pending, cookies } = setup(async () => ({
      data: { user: { id: 'verified-user' } }, error: null,
    }))
    await expect(pending).resolves.toEqual({ user: { id: 'verified-user' }, lookupFailed: false })
    await cookies.setAll!([{ name: 'sb-project-auth-token', value: 'late-token', options: {} }])
    expect(request.cookies.get('sb-project-auth-token')?.value).toBe('synthetic-session')
    expect(response.cookies.getAll()).toEqual([])
  })

  it('preserves clearing for thrown invalid-refresh errors', async () => {
    const { request, response, pending } = setup(async () => {
      throw { code: 'refresh_token_not_found' }
    })
    await expect(pending).resolves.toEqual({ user: null, lookupFailed: false })
    expect(request.cookies.get('sb-project-auth-token')).toBeUndefined()
    expect(response.cookies.get('sb-project-auth-token')?.maxAge).toBe(0)
  })

  it('does not clear cookies for late invalid-refresh failures even before the timer runs', async () => {
    const { request, response, pending } = setup(async () => {
      // Model an event-loop stall: wall time passes without the timer callback.
      jest.setSystemTime(Date.now() + 8_000)
      throw { code: 'refresh_token_not_found' }
    })
    await expect(pending).resolves.toEqual({ user: null, lookupFailed: true })
    expect(request.cookies.get('sb-project-auth-token')?.value).toBe('synthetic-session')
    expect(response.cookies.getAll()).toEqual([])
  })
})