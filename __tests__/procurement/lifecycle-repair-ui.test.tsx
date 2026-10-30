import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

const site = '00000000-0000-4000-8000-000000000001'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: site } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => { jest.mocked(fetch).mockClear() })
function setup(status = 'approved', canManage = true) {
  const record = { id: site, title: 'Approved equipment', description: 'Preserved content', status,
    currency: 'USD', net_amount_minor: 2468, revision: 2, requester_id: site, resolved_plan: null, revalidation_of_revision: 1 }
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? {} : {
    request: record, actor_id: site, can_manage: canManage, items: [], stages: [], audit: [],
  } }) as Response)
  render(<><TopBarPrimaryActionsSlot /><RequestDetail id={site} /></>)
}
test('revalidation requires explicit confirmation, revision and no financial edits', async () => {
  setup()
  fireEvent.click(await screen.findByRole('button', { name: 'Revalidate approval' }))
  expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
  const dialog = screen.getByRole('alertdialog')
  expect(dialog).toHaveTextContent('Previous decisions remain in history and are not reused')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Start revalidation' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/revalidate?'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ expected_revision: 2 }) })))
  expect(await screen.findByRole('status')).toHaveTextContent('Submit the new draft for fresh approval')
})
test('returned revalidation can restart but revalidated drafts cannot change approved lines', async () => {
  setup('draft')
  expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit request' })).not.toBeInTheDocument()
})
test('ordinary approvers do not receive the manager revalidation action', async () => {
  setup('approved', false)
  await screen.findByText('Preserved content')
  expect(screen.queryByRole('button', { name: 'Revalidate approval' })).not.toBeInTheDocument()
})