import { deleteAccountingSource, hasSourceJournal } from '@/app/accounting/source-lifecycle'
import { requireAccountingAccess } from '@/app/accounting/access'

jest.mock('server-only', () => ({}))
jest.mock('@/app/accounting/access', () => ({ requireAccountingAccess: jest.fn() }))
const siteId = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'

describe('source lifecycle boundary', () => {
  let client: any
  beforeEach(() => {
    jest.resetAllMocks()
    client = { rpc: jest.fn(async () => ({ error: null })), from: jest.fn() }
    jest.mocked(requireAccountingAccess).mockResolvedValue(client)
  })
  it.each(['sale','purchase','expense'] as const)('deletes %s and its journals through one authorized RPC', async type => {
    await deleteAccountingSource(siteId,type,sourceId)
    expect(requireAccountingAccess).toHaveBeenCalledWith(siteId,'delete')
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith('accounting_delete_source', { p_site_id: siteId, p_source_type: type, p_source_id: sourceId })
    expect(client.from).not.toHaveBeenCalled()
  })
  it('returns a preserved-history error on a source foreign key failure', async () => {
    client.rpc.mockResolvedValue({ error: { code: '23503' } })
    await expect(deleteAccountingSource(siteId,'sale',sourceId)).rejects.toThrow('journal was preserved')
    expect(client.from).not.toHaveBeenCalled()
  })
  it('never invokes the RPC on denied access', async () => {
    jest.mocked(requireAccountingAccess).mockRejectedValue(new Error('Forbidden'))
    await expect(deleteAccountingSource(siteId,'sale',sourceId)).rejects.toThrow('Forbidden')
    expect(client.rpc).not.toHaveBeenCalled()
  })
  it('fails closed when checking whether a pending source already has a journal', async () => {
    const query: any = { select: () => query, eq: jest.fn(() => query), limit: async () => ({ error: {} }) }
    client.from.mockReturnValue(query)
    await expect(hasSourceJournal(client,siteId,'purchase',sourceId)).rejects.toThrow('Unable to verify')
    expect(query.eq).toHaveBeenCalledWith('site_id',siteId)
  })
})