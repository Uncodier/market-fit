/** @jest-environment node */
import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient } from '@/lib/supabase/server'
import { getSales } from '@/app/sales/actions'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('server-only', () => ({}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

it('makes one user-client list request and publishes only visible same-site segment labels', async () => {
  const site = '11111111-1111-4111-8111-111111111111'
  const base = { site_id: site, sale_date: '2026-09-25', amount: 40, amount_due: 15, segment_id: 's1',
    leads: { name: 'Customer' }, payments: [{ amount: 25, method: 'cash' }] }
  const rows = [
    { ...base, id: 'visible', segments: { name: 'Subscribers', site_id: site } },
    { ...base, id: 'hidden', segments: null },
    { ...base, id: 'foreign-link', segments: { name: 'Other site label', site_id: 'another-site' } },
    { ...base, id: 'unassigned', segment_id: null, segments: null },
  ]
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(async () => Response.json(rows))
  jest.mocked(createClient).mockResolvedValue(new PostgrestClient('https://test.invalid/rest/v1', { fetch: transport }))
  const result = await getSales(site)
  expect(transport).toHaveBeenCalledTimes(1)
  const [request, init] = transport.mock.calls[0]
  const { pathname, searchParams } = new URL(String(request))
  expect([init?.method, pathname, searchParams.get('site_id'), searchParams.get('order')]).toEqual([
    'GET', '/rest/v1/sales', `eq.${site}`, 'sale_date.desc,created_at.desc',
  ])
  expect(searchParams.get('select')).toContain('leads(name),segments!sales_segment_id_fkey(name,site_id)')
  expect(searchParams.get('segments.site_id')).toBe(`eq.${site}`)
  expect(result.sales?.map(row => [row.id, row.segmentName])).toEqual([
    ['visible', 'Subscribers'], ['hidden', null], ['foreign-link', null], ['unassigned', null],
  ])
  expect(result.sales?.[0]).toMatchObject({ leadName: 'Customer', amount: 40, amount_due: 15, payments: base.payments })
})