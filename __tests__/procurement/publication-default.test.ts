/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicationPolicy } from '@/app/api/procurement/policy/publication-default'
import { defaultPolicyDocument } from '@/app/purchases/procurement/domain'

const site = '11111111-1111-4111-8111-111111111111'
const owner = '22222222-2222-4222-8222-222222222222'
const admin = '33333333-3333-4333-8333-333333333333'

function fixture() {
  const single = jest.fn().mockResolvedValue({ data: { user_id: owner }, error: null })
  const maybeSingle = jest.fn()
  const members = jest.fn().mockResolvedValue({ data: [{ user_id: admin }, { user_id: owner }, { user_id: admin }], error: null })
  const query = { select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(), single, maybeSingle,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => members().then(resolve, reject) }
  for (const method of [query.select, query.eq, query.order, query.limit]) method.mockReturnValue(query)
  const from = jest.fn().mockReturnValue(query)
  const rpc = jest.fn().mockImplementation(async (_name, params) => ({ data: [{ revision: 1, document: params.p_document }], error: null }))
  return { client: { from, rpc } as unknown as SupabaseClient, from, rpc, single, maybeSingle, query, members }
}

describe('publication policy bootstrap', () => {
  test('uses the trusted site owner and persists conservative defaults through user-scoped CAS', async () => {
    const { client, rpc, query } = fixture()
    const result = await publicationPolicy(client, site, null)
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('Expected valid policy')
    expect(result.data.document.settings).toMatchObject({ visibility: 'private', allowGlobalListing: false,
      participation: 'invitation_only', offerOpening: 'after_close', fallback: { mode: 'approval', stages: [{
        approverIds: [owner, admin], mandatoryApproverIds: [], quorum: { mode: 'first_response' }, decisionMode: 'human', allowSelfApproval: true,
      }] } })
    expect(query.eq).toHaveBeenCalledWith('id', site)
    for (const [key, value] of [['site_id', site], ['role', 'admin'], ['status', 'active'], ['license_suspended', false], ['manually_disabled', false]]) {
      expect(query.eq).toHaveBeenCalledWith(key, value)
    }
    expect(rpc).toHaveBeenCalledWith('save_procurement_policy', { p_site_id: site, p_expected_revision: 0, p_document: result.data.document })
  })
  test.each([defaultPolicyDocument(), { version: 1, settings: { fallback: { mode: 'invalid' } }, rules: [] }])(
    'never bootstraps over an existing policy %#', async document => {
      const { client, from, rpc } = fixture()
      await publicationPolicy(client, site, { revision: 7, document })
      expect(from).not.toHaveBeenCalled()
      expect(rpc).not.toHaveBeenCalled()
    },
  )
  test('uses the winning blocking policy after a concurrent save instead of overwriting rules', async () => {
    const { client, rpc, maybeSingle } = fixture()
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } })
    const saved = { revision: 2, document: defaultPolicyDocument() }
    maybeSingle.mockResolvedValue({ data: saved, error: null })
    const result = await publicationPolicy(client, site, null)
    expect(result.success && result.data).toEqual(saved)
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  test.each([{ data: null, error: null }, { data: { user_id: 'invalid' }, error: null }, { data: null, error: { code: '42501' } }])(
    'fails closed when owner lookup cannot be trusted %#', async result => {
      const { client, single, rpc } = fixture()
      single.mockResolvedValue(result)
      await expect(publicationPolicy(client, site, null)).rejects.toThrow('Workspace owner')
      expect(rpc).not.toHaveBeenCalled()
    },
  )
  test('save failures cannot manufacture an unsaved policy revision', async () => {
    const { client, rpc } = fixture()
    rpc.mockResolvedValue({ data: null, error: { code: '42501' } })
    await expect(publicationPolicy(client, site, null)).rejects.toThrow('could not be saved')
  })
  test('owner remains sufficient when the workspace has no admins', async () => {
    const { client, members } = fixture()
    members.mockResolvedValue({ data: [], error: null })
    const result = await publicationPolicy(client, site, null)
    expect(result.success && result.data.document.settings.fallback).toMatchObject({
      mode: 'approval', stages: [{ approverIds: [owner], mandatoryApproverIds: [], quorum: { mode: 'first_response' } }],
    })
  })
  test.each([{ data: null, error: { code: '42501' } }, { data: [{ user_id: 'invalid' }], error: null }])(
    'fails closed on unreadable or malformed admin membership %#', async result => {
      const { client, members, rpc } = fixture()
      members.mockResolvedValue(result)
      await expect(publicationPolicy(client, site, null)).rejects.toThrow('administrators')
      expect(rpc).not.toHaveBeenCalled()
    },
  )
  test('a failed concurrent-policy read fails closed', async () => {
    const { client, rpc, maybeSingle } = fixture()
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } })
    maybeSingle.mockResolvedValue({ data: null, error: { code: '503' } })
    await expect(publicationPolicy(client, site, null)).rejects.toThrow('could not be verified')
  })
})