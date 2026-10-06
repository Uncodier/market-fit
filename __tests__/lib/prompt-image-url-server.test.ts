/** @jest-environment node */

import { normalizePromptImageUrl, promptImageUrl } from '@/app/lib/prompt-image-url'

it('keeps server URL generation relative without depending on browser globals', () => {
  expect(promptImageUrl('Coffee', 400)).toBe('/api/images/prompt?prompt=Coffee&width=400&height=400')
  expect(normalizePromptImageUrl('https://old.test/api/public/image/prompt/Coffee?cache_only=1&token=secret'))
    .toBe('/api/images/prompt?prompt=Coffee&width=1024&height=1024&cache_only=1')
})