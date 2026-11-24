import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import ExperimentsPage from '@/app/experiments/page'
import { readExperimentIndex } from '@/app/experiments/read-experiment-index'
import { createClient } from '@/lib/supabase/client'

let mockSite = 'one', mockActor = 'alice', mockLoading = false, mockVersion = 0
jest.mock('@/app/components/auth/auth-context', () => ({ useAuthContext: () => ({ user: { id: mockActor }, isLoading: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSite, name: `Site ${mockVersion}` },
  requestScope: { actorId: mockActor, siteId: mockSite }, isLoading: mockLoading }) }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: React.PropsWithChildren) => <header>{children}</header> }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/experiments/actions', () => ({ startExperiment: jest.fn(), stopExperiment: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const experiment = { id: 'exp', name: 'Experiment A', status: 'active', campaign_id: 'campaign',
  experiment_segments: [{ segment: { id: 'segment', site_id: 'one', name: 'Audience' }, participants: 4 },
    { segment: { id: 'other', site_id: 'foreign', name: 'Hidden label' }, participants: 8 }, { segment: null }] }
type Reply = { data: unknown[] | null; error: unknown }
type Call = { table: string; columns: string; site: string; ids?: string[]; signal: AbortSignal }
function database(read: (call: Call) => Promise<Reply>) {
  const calls: Call[] = []
  jest.mocked(createClient).mockReturnValue({ from: (table: string) => {
    const entry = { table } as Call
    const q = { select: (columns: string) => { entry.columns = columns; return q },
      eq: (column: string, id: string) => { if (column === 'site_id') entry.site = id; return q },
      in: (_: string, ids: string[]) => { entry.ids = ids; return q }, order: () => q,
      abortSignal: (signal: AbortSignal) => { entry.signal = signal; calls.push(entry); return read(entry) } }
    return q
  } })
  return calls
}
beforeEach(() => {
  mockSite = 'one'; mockActor = 'alice'; mockLoading = false; mockVersion = 0
  localStorage.clear(); jest.clearAllMocks()
})

it('loads one index plus only its referenced same-site campaign labels; no creation directories or metadata refetch', async () => {
  const calls = database(async ({ table }) => ({ data: table === 'experiments' ? [experiment] : [{ id: 'campaign', title: 'Campaign search' }], error: null }))
  const push = jest.fn(); jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  mockLoading = true
  const view = render(<ExperimentsPage />)
  expect(calls).toHaveLength(0)
  mockLoading = false; view.rerender(<ExperimentsPage />)
  const row = await screen.findByRole('heading', { name: experiment.name })
  expect(calls.map(({ table, site, ids }) => ({ table, site, ids }))).toEqual([
    { table: 'experiments', site: 'one', ids: undefined }, { table: 'campaigns', site: 'one', ids: ['campaign'] }])
  expect(calls[1].columns).toBe('id,title')
  mockVersion++; view.rerender(<ExperimentsPage />); await act(async () => {})
  expect(calls).toHaveLength(2)
  fireEvent.click(row); expect(push).toHaveBeenCalledWith('/experiments/exp')
})

it('does not start campaign reads for a retired selection or publish late rows in another account', async () => {
  let finish!: (result: Reply) => void
  const calls = database(call => call.site === 'one' ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ data: [], error: null }))
  const view = render(<ExperimentsPage />)
  mockSite = 'two'; mockActor = 'bob'; view.rerender(<ExperimentsPage />)
  await screen.findByText('No experiments yet')
  expect(calls[0].signal.aborted).toBe(true)
  await act(async () => finish({ data: [experiment], error: null }))
  expect(calls.map(c => c.table)).toEqual(['experiments', 'experiments'])
  expect(screen.queryByText(experiment.name)).toBeNull()
})

it('keeps the visible experiment when an optional label is unavailable; does not reveal foreign or hidden segments', async () => {
  database(async ({ table }) => table === 'experiments' ? { data: [experiment], error: null } : { data: null, error: { code: '42501' } })
  await expect(readExperimentIndex('one', new AbortController().signal)).resolves.toMatchObject([{ id: 'exp', campaign: null,
    segments: [{ id: 'segment', name: 'Audience', participants: 4 }] }])
})