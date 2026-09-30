/** @jest-environment node */

import { configuredApiUrl, isSameOriginApiRequest } from '@/lib/http/api-proxy-security'

const originalApi = process.env.API_SERVER_URL
const originalPublic = process.env.NEXT_PUBLIC_API_SERVER_URL
const request = new Request('https://app.example.test/api/site/setup')

afterEach(() => {
  jest.restoreAllMocks()
  if (originalApi === undefined) delete process.env.API_SERVER_URL
  else process.env.API_SERVER_URL = originalApi
  if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalPublic
})

it('uses the configured server origin and only falls back to the public configuration', () => {
  process.env.API_SERVER_URL = 'api.example.test'
  process.env.NEXT_PUBLIC_API_SERVER_URL = 'https://fallback.example.test'
  expect(String(configuredApiUrl(request, '/api/site/setup'))).toBe('https://api.example.test/api/site/setup')
  delete process.env.API_SERVER_URL
  expect(String(configuredApiUrl(request, '/api/site/setup'))).toBe('https://fallback.example.test/api/site/setup')
})

it.each(['', 'https://user:password@api.example.test', 'https://app.example.test',
  'https://api.example.test/path', 'https://api.example.test?url=other', 'http://api.example.test',
])('rejects invalid configured destinations: %s', base => {
  process.env.API_SERVER_URL = base
  delete process.env.NEXT_PUBLIC_API_SERVER_URL
  expect(configuredApiUrl(request, '/api/site/setup')).toBeNull()
})

it('rejects external paths, production loopback HTTP and cross-origin browser requests', () => {
  process.env.API_SERVER_URL = 'https://api.example.test'
  expect(configuredApiUrl(request, '//evil.test')).toBeNull()
  expect(configuredApiUrl(request, 'https://evil.test')).toBeNull()
  expect(configuredApiUrl(request, '/api/\\evil.test')).toBeNull()
  jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production', API_SERVER_URL: 'http://localhost:3001' })
  expect(configuredApiUrl(request, '/api/site/setup')).toBeNull()
  expect(isSameOriginApiRequest(new Request(request.url, { headers: { origin: 'https://evil.test' } }))).toBe(false)
  expect(isSameOriginApiRequest(new Request(request.url, { headers: { 'sec-fetch-site': 'cross-site' } }))).toBe(false)
})

it('allows same-origin requests and dev loopback normalization but not a forged host', () => {
  expect(isSameOriginApiRequest(new Request(request.url, { headers: { origin: 'https://app.example.test' } }))).toBe(true)
  expect(isSameOriginApiRequest(new Request('http://0.0.0.0:3000/api/site/setup', {
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
  }))).toBe(true)
  expect(isSameOriginApiRequest(new Request('http://0.0.0.0:3000/api/site/setup', {
    headers: { origin: 'http://localhost:3000', host: 'evil.test' },
  }))).toBe(false)
})