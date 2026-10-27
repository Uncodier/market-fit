/** @jest-environment node */
import { developmentConnectSources } from '../../lib/http/development-connect-src'

test('production never expands connection sources', () => {
  expect(developmentConnectSources({ NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' })).toEqual([])
})
test('development adds only configured loopback API/Auth/realtime dependencies', () => {
  const sources = developmentConnectSources({ NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    NEXT_PUBLIC_API_SERVER_URL: 'http://127.0.0.1:3001' })
  expect(sources).toContain('http://127.0.0.1:54321')
  expect(sources).toContain('ws://127.0.0.1:54321')
  expect(sources).toContain('http://127.0.0.1:3001')
})
test.each(['https://production.supabase.co', 'http://evil.invalid:54321', 'http://token@127.0.0.1:54321', 'invalid'])('rejects non-local or unsafe configured origin %s', value => {
  expect(developmentConnectSources({ NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: value }))
    .toEqual(['ws://127.0.0.1:*', 'ws://localhost:*'])
})