/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import { approverNames } from '@/app/api/procurement/approvals/approver-names'

function client(error = false) {
  const queries: Record<string, jest.Mock>[] = []
  const from = jest.fn((table: string) => {
    const result = { data: table === 'sites' ? { user_id: 'owner' } : [
      { user_id: 'member', name: ' Alex ' }, { user_id: 'unnamed', name: null },
    ], error: error ? { message: 'private' } : null }
    const query: Record<string, jest.Mock> = {}
    for (const method of ['select', 'eq', 'in']) query[method] = jest.fn(() => query)
    query.maybeSingle = jest.fn(async () => result)
    query.then = jest.fn(resolve => Promise.resolve(result).then(resolve))
    queries.push(query)
    return query
  })
  return { supabase: { from } as unknown as SupabaseClient, from, queries }
}

test('scopes member names to the workspace and exact referenced users', async () => {
  const { supabase, from, queries } = client()
  const result = await approverNames(supabase, 'site', ['owner', 'member', 'unnamed'])
  expect(result.ownerId).toBe('owner')
  expect([...result.names]).toEqual([['member', 'Alex']])
  expect(from).toHaveBeenCalledWith('site_members')
  expect(queries[0].eq).toHaveBeenCalledWith('id', 'site')
  expect(queries[1].eq).toHaveBeenCalledWith('site_id', 'site')
  expect(queries[1].in).toHaveBeenCalledWith('user_id', ['owner', 'member', 'unnamed'])
})

test('does not fetch people without visible voters and fails closed on lookup errors', async () => {
  const { supabase, from } = client(true)
  expect(await approverNames(supabase, 'site', [])).toEqual({ names: new Map(), ownerId: null })
  expect(from).not.toHaveBeenCalled()
  await expect(approverNames(supabase, 'site', ['member'])).rejects.toThrow('Unable to load approver names')
})