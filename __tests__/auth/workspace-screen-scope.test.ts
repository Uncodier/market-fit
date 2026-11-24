import { parseWorkspaceScreenScope, readWorkspaceScreenScope } from '@/lib/permissions/workspace-screen-scope'

const scope = { actor_id: 'a', site_id: 's', role: 'admin', blocked_screens: [], location_restricted: false }
type Response = { data: unknown; error: { code: string } | null; status?: number }
function client(rpcResponse: Response, member?: Response) {
  const query = (r: Response) => ({ retry: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockResolvedValue(r) })
  const legacy = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: () => query(member!) }
  return { rpc: jest.fn().mockReturnValue(query(rpcResponse)), from: jest.fn().mockReturnValue(legacy) }
}
it.each([{ actor_id: 'someone' }, { site_id: 'foreign' }, { role: '' }, { blocked_screens: null },
  { location_restricted: null }])('never gives a proof for an ambiguous projection %j', change => {
  expect(parseWorkspaceScreenScope({ ...scope, ...change }, 'a', 's')).toEqual({ status: 'unavailable' })
})
it('requires an authenticated scoped response; never treats a dependency outage or denial as a legacy grant', async () => {
  for (const [res, status] of [[{ data: null, error: null }, 'denied'],
    [{ data: null, error: { code: '57014' }, status: 500 }, 'unavailable'],
    [{ data: null, error: { code: '42501' }, status: 403 }, 'denied']] as const) {
    const db = client(res)
    await expect(readWorkspaceScreenScope(db, 'a', 's', new AbortController().signal)).resolves.toEqual({ status })
    expect(db.from).not.toHaveBeenCalled()
  }
})
it('only uses the old nav projection on a missing RPC, never to verify the independent inbox', async () => {
  const db = client({ data: null, error: { code: 'PGRST202' }, status: 404 },
    { data: { role: 'admin', blocked_screens: [] }, error: null })
  await expect(readWorkspaceScreenScope(db, 'a', 's', new AbortController().signal)).resolves.toMatchObject({ status: 'legacy' })
  expect(db.from).toHaveBeenCalledWith('site_members')
})