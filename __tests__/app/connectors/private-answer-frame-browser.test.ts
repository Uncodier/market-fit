/** @jest-environment node */
import { chromium } from 'playwright'
import { createClient } from '@/lib/supabase/server'
import { GET as inline } from '@/app/robots/private-answer/[id]/inline/route'
import { GET as download } from '@/app/robots/private-answer/[id]/download/route'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

it('keeps even a same-origin parent out of the answer document and permits an authorized file download', async () => {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const origin = 'https://app.example.test'
    const id = '00000000-0000-4000-8000-000000000001'
    const base = `${origin}/robots/private-answer/${id}`
    const rpc = jest.fn(() => ({ abortSignal: async () => ({ data: 'Private quarterly analysis' }) }))
    jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id, is_anonymous: false } } }) }, rpc } as never)
    await page.context().route('**/*', async route => {
      const url = route.request().url()
      if (url === `${origin}/robots`) {
        // Deliberately omit sandbox: the response itself must enforce isolation.
        return route.fulfill({ contentType: 'text/html', body: `<iframe src="${base}/inline"></iframe>` })
      }
      const handler = url === `${base}/inline` ? inline : url === `${base}/download` ? download : null
      if (!handler) return route.abort()
      const res = await handler(new Request(url), { params: Promise.resolve({ id }) })
      return route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() })
    })
    await page.goto(`${origin}/robots`)
    const doc = page.frameLocator('iframe')
    await doc.getByText('Private quarterly analysis').waitFor()
    expect(await page.locator('iframe').evaluate(el => (el as HTMLIFrameElement).contentDocument === null)).toBe(true)
    const [file] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }), doc.getByRole('link', { name: 'Download report (.md)' }).click(),
    ])
    expect(file.suggestedFilename()).toBe('private-ask-report.md')
    expect(rpc).toHaveBeenCalledTimes(2)
  } finally { await browser.close() }
}, 20_000)