/** @jest-environment node */
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getContent } from '@/app/content/actions'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
const site = '11111111-1111-4111-8111-111111111111'
function db(role: string | null, restricted: boolean | null) {
  const getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'actor' } }, error: null })
  const rpc = jest.fn(async (name: string) => ({ error: null, data: name === 'current_user_site_role' ? role : restricted }))
  const order = jest.fn().mockResolvedValue({ data: [{ id: 'visible' }], error: null, count: 1 })
  const eq = jest.fn(() => ({ order })), from = jest.fn(() => ({ select: () => ({ eq }) }))
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc, from }); return { getUser, from, eq, rpc }
}
beforeEach(() => jest.clearAllMocks())
it('checks the caller once and reads only the requested site via the same authenticated client', async () => {
  const { getUser, from, eq, rpc } = db('marketing', false)
  await expect(getContent(site)).resolves.toEqual({ content: [{id: 'visible'}], count: 1, error: null })
  expect(getUser).toHaveBeenCalledTimes(1); expect(from).toHaveBeenCalledWith('content'); expect(eq).toHaveBeenCalledWith('site_id', site)
  expect(rpc).toHaveBeenCalledWith('current_user_site_role', { p_site_id: site }); expect(rpc).toHaveBeenCalledWith('current_user_has_location_restrictions', {})
  expect(createClient).toHaveBeenCalledWith(true); expect(createServiceClient).not.toHaveBeenCalled()
})
it.each([[null, false], ['owner', true], ['owner', null], ['invalid', false]] as const)('never queries content for role=%s restriction=%s', async (role, restricted) => {
  const { from } = db(role, restricted); expect((await getContent(site)).content).toBeNull(); expect(from).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})
it('rejects invalid sites, anonymous callers and mock clients on a real workspace', async () => {
  const { getUser, from } = db('owner', false)
  await expect(getContent('bogus')).resolves.toMatchObject({ content: null }); expect(createClient).not.toHaveBeenCalled()
  getUser.mockResolvedValueOnce({ data: { user: { id: 'x', is_anonymous: true } }, error: null })
  await expect(getContent(site)).resolves.toMatchObject({ content: null }); expect(from).not.toHaveBeenCalled()
  jest.mocked(createClient).mockResolvedValueOnce({ _isDemo: true, from })
  await expect(getContent(site)).resolves.toMatchObject({ error: 'Forbidden' }); expect(from).not.toHaveBeenCalled()
})