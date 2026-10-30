/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import { approvalRevisionState } from '@/app/api/procurement/approvals/revision-state'

const site = 'site'
const approval = { event: 'publication', target_id: 'tender', target_version: 2, policy_revision: 3 }
function client(revision: number | null, version: number | null, error = false) {
  const from = jest.fn((table: string) => {
    const result = { data: table === 'procurement_policy_versions' ? (revision === null ? null : { revision })
      : version === null ? [] : [{ id: 'tender', version }], error: error ? { message: 'private' } : null }
    const query: Record<string, jest.Mock> = {}
    for (const method of ['select', 'eq', 'order', 'limit', 'in']) query[method] = jest.fn(() => query)
    query.maybeSingle = jest.fn(async () => result)
    query.then = jest.fn(resolve => Promise.resolve(result).then(resolve))
    return query
  })
  return { supabase: { from } as unknown as SupabaseClient, from }
}
test.each([
  [3, 2, false], [4, 2, true], [3, 3, true], [4, 3, true], [null, 2, true], [3, null, true],
])('compares policy %s and tender %s without changing the saved revision', async (policy, version, deprecated) => {
  const { supabase, from } = client(policy, version)
  const [row] = await approvalRevisionState(supabase, site, [approval])
  expect(row).toEqual(expect.objectContaining({ ...approval, is_deprecated: deprecated }))
  for (const result of from.mock.results) expect(result.value.eq).toHaveBeenCalledWith('site_id', site)
})
test('applies workspace policy revision to commerce approvals without comparing unrelated tender IDs', async () => {
  const { supabase, from } = client(4, 2)
  expect((await approvalRevisionState(supabase, site, [{ ...approval, event: 'award' }]))[0].is_deprecated).toBe(true)
  expect(from).not.toHaveBeenCalledWith('procurement_tenders')
})
test('fails closed on unreadable revisions and avoids reads for an empty list', async () => {
  const { supabase, from } = client(3, 2, true)
  await expect(approvalRevisionState(supabase, site, [approval])).rejects.toThrow('Unable to verify')
  from.mockClear()
  expect(await approvalRevisionState(supabase, site, [])).toEqual([])
  expect(from).not.toHaveBeenCalled()
})