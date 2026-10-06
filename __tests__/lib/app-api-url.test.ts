/** @jest-environment node */

import { resolveAppApiUrl } from '@/app/commerce/app-api-url'
import { promptImageUrl, normalizePromptImageUrl } from '@/app/lib/prompt-image-url'

const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

function browser(hostname: string) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { hostname } } })
}

afterEach(() => {
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
  else Reflect.deleteProperty(globalThis, 'window')
})

it.each(['www.makinari.com', 'makinari.com'])('routes APIs only from official commerce host %s to app', hostname => {
  browser(hostname)
  expect(resolveAppApiUrl('/api/commerce/visitor-session')).toBe('https://app.makinari.com/api/commerce/visitor-session')
  expect(resolveAppApiUrl('api/commerce/checkout')).toBe('https://app.makinari.com/api/commerce/checkout')
  expect(resolveAppApiUrl('/api/images/prompt?prompt=Coffee&width=400')).toBe('https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400')
})

it.each(['app.makinari.com', 'localhost', '127.0.0.1', 'preview.makinari.com', 'demo.makinari.com',
  'shop.example.test', 'www.makinari.com.evil.test', 'makinari.com.evil.test'])(
  'preserves same-origin API conventions on %s', hostname => {
    browser(hostname)
    expect(resolveAppApiUrl('api/commerce/visitor-session')).toBe('/api/commerce/visitor-session')
    expect(promptImageUrl('Coffee', 400)).toBe('/api/images/prompt?prompt=Coffee&width=400&height=400')
  },
)

it('keeps SSR API paths relative instead of assuming the public production deployment', () => {
  Reflect.deleteProperty(globalThis, 'window')
  expect(resolveAppApiUrl('api/images/prompt')).toBe('/api/images/prompt')
})

it('delivers apex-host images with public-cache-only semantics and sanitized legacy queries', () => {
  browser('makinari.com')
  expect(promptImageUrl('Coffee', 400)).toBe('https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400&height=400&cache_only=1')
  expect(normalizePromptImageUrl('https://old.test/api/images/prompt?prompt=Coffee&width=400&height=256&signature=private&cache_only=0'))
    .toBe('https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400&height=256&cache_only=1')
})