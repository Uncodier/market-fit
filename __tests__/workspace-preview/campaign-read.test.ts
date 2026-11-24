/** @jest-environment node */
import { PostgrestClient } from '@supabase/postgrest-js'
import { getCampaigns } from '@/app/campaigns/actions/campaigns/read'
import { createClient } from '@/lib/supabase/server'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const fetcher = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
beforeEach(() => { fetcher.mockReset(); jest.mocked(createClient).mockResolvedValue(new PostgrestClient('https://test.invalid', { fetch: fetcher }) as never) })
it('loads independent campaign relations in one scoped GET even on a long list', async () => {
  fetcher.mockResolvedValue(Response.json(Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, title: `Title ${i}`,
    campaign_subtasks: [{ id: `sub${i}`, title: 'Subtask', campaign_id: `c${i}` }],
    campaign_segments: [{ segment_id: `s${i}` }], campaign_requirements: [{ requirement_id: `r${i}` }],
  }))))
  const result = await getCampaigns('site'); expect(result.error).toBeNull(); expect(result.data).toHaveLength(100)
  expect(result.data?.[99]).toMatchObject({ title: 'Title 99', subtasks: [{ id: 'sub99', campaignId: 'c99' }], segments: ['s99'], requirements: ['r99'] })
  expect(fetcher).toHaveBeenCalledTimes(1); const [req, init] = fetcher.mock.calls[0]
  const url = new URL(String(req)); expect(init?.method).toBe('GET'); expect(url.pathname).toBe('/campaigns'); expect(url.searchParams.get('site_id')).toBe('eq.site')
  expect(url.searchParams.get('select')).toContain('campaign_subtasks(')
})