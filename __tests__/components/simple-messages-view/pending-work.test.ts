import { enqueuePendingWork } from '@/app/components/simple-messages-view/hooks/pending-work'

const fromMock = jest.fn()

jest.mock('../../../lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  }),
}))

jest.mock('../../../app/services/context-service', () => ({
  contextService: {
    getContextData: jest.fn().mockResolvedValue(null),
  },
}))

function createChain(result: { data?: any; error?: any } = {}) {
  const chain: any = {}
  chain.select = jest.fn().mockReturnValue(chain)
  chain.eq = jest.fn().mockReturnValue(chain)
  chain.insert = jest.fn().mockReturnValue(chain)
  chain.update = jest.fn().mockReturnValue(chain)
  chain.single = jest.fn().mockResolvedValue(result)
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return chain
}

describe('enqueuePendingWork', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('inserts pending work and does not write a chat log', async () => {
    const insert = createChain({ data: { id: 'pending-1' }, error: null })
    fromMock.mockReturnValue(insert)

    const result = await enqueuePendingWork({
      instanceId: 'inst-1',
      siteId: 'site-1',
      userId: 'user-1',
      message: 'follow up later',
      activity: 'ask',
      context: { selected_context: {} },
      systemPrompt: 'answer',
    })

    expect(result).toEqual({ id: 'pending-1' })
    expect(fromMock).toHaveBeenCalledWith('instance_pending_work')
    expect(fromMock).not.toHaveBeenCalledWith('instance_logs')
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        instance_id: 'inst-1',
        site_id: 'site-1',
        message: 'follow up later',
        activity: 'ask',
        status: 'pending',
      })
    )
  })

  it('returns null when the pending insert fails', async () => {
    fromMock.mockReturnValue(createChain({ data: null, error: { message: 'rls' } }))

    const result = await enqueuePendingWork({
      instanceId: 'inst-1',
      siteId: 'site-1',
      message: 'follow up later',
      activity: 'ask',
    })

    expect(result).toBeNull()
  })
})
