import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import LeadsPage from '@/app/leads/page'
import { getLeadsWithCount } from '@/app/leads/actions'
import { useLeadsData } from '@/app/leads/hooks/use-leads-data'

const site = { id: '10000000-0000-4000-8000-000000000001' }
const row = { id: 'lead-a', name: 'Recovered lead', site_id: site.id, user_id: 'fixture-user' } as
  NonNullable<Awaited<ReturnType<typeof getLeadsWithCount>>['leads']>[number]

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key === 'common.retry' ? 'Retry' : '' }),
}))
jest.mock('@/app/leads/actions', () => ({ getLeadsWithCount: jest.fn(), searchLeadsWithCount: jest.fn() }))
jest.mock('@/app/segments/actions', () => ({ getSegments: async () => ({ segments: [] }) }))
jest.mock('@/app/campaigns/actions/campaigns/read', () => ({ getCampaigns: async () => ({ data: [] }) }))
jest.mock('@/app/hooks/use-user-data', () => ({ useUserData: () => ({ userData: {} }) }))
jest.mock('@/app/leads/hooks/use-leads-page', () => ({ useLeadsPage: () => {
  const data = useLeadsData(site)
  return { ...data, activeTab: 'all', viewType: 'table', filteredLeads: data.dbLeads, companyGroups: [],
    selectedLeads: new Set(), filters: { status: [], segments: [], origin: [], journeyStages: [] } }
} }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: ReactNode }) => children }))
jest.mock('@/app/components/ui/mobile-filters-drawer', () => ({
  MobileFiltersDrawer: () => null, FilterContainer: () => null, FilterSection: () => null,
}))
jest.mock('@/app/components/ui/lead-filter-modal', () => ({ LeadFilterModal: () => null }))
jest.mock('@/app/components/kanban-view', () => ({ KanbanView: () => null }))
jest.mock('@/app/leads/components/LeadsToolbar', () => ({ LeadsToolbar: () => null }))
jest.mock('@/app/leads/components/LeadsTransferActions', () => ({ LeadsTransferActions: () => null }))
jest.mock('@/app/leads/components/grouped-leads-table', () => ({
  GroupedLeadsTable: ({ totalLeads, loadedLeadCount }: { totalLeads: number | null; loadedLeadCount: number }) => (
    <p>{totalLeads === null ? `${loadedLeadCount} loaded; total unknown` : `${totalLeads} total`}</p>
  ),
}))

function renderPage() {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnReconnect: false }}><LeadsPage /></SWRConfig>)
}

beforeEach(() => jest.clearAllMocks())

it('renders a retry instead of a false empty list and recovers same-scope rows with no total', async () => {
  jest.mocked(getLeadsWithCount)
    .mockResolvedValueOnce({ leads: [], totalCount: null, error: 'Error loading leads' })
    .mockResolvedValueOnce({ leads: [row], totalCount: null })
  renderPage()
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load leads')
  expect(screen.queryByText(/total unknown|0 total/)).not.toBeInTheDocument()
  expect(getLeadsWithCount).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('1 loaded; total unknown')).toBeVisible()
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  expect(jest.mocked(getLeadsWithCount).mock.calls).toEqual([[site.id], [site.id]])
})

it('distinguishes an authoritative zero from an unavailable read', async () => {
  jest.mocked(getLeadsWithCount).mockResolvedValue({ leads: [], totalCount: 0 })
  renderPage()
  expect(await screen.findByText('0 total')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('does not show an old failure as zero rows or allow another click while retrying', async () => {
  let finishRetry!: (value: Awaited<ReturnType<typeof getLeadsWithCount>>) => void
  jest.mocked(getLeadsWithCount)
    .mockResolvedValueOnce({ leads: [], totalCount: null, error: 'Error loading leads' })
    .mockImplementationOnce(() => new Promise(resolve => { finishRetry = resolve }))
  renderPage()
  const retry = await screen.findByRole('button', { name: 'Retry' })
  fireEvent.click(retry)
  await waitFor(() => expect(retry).toBeDisabled())
  expect(screen.queryByText(/total unknown|0 total/)).not.toBeInTheDocument()
  await act(async () => finishRetry({ leads: [row], totalCount: 21 }))
  expect(await screen.findByText('21 total')).toBeVisible()
})