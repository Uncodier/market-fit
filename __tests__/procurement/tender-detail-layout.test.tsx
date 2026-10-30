import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
import type { Tender } from '@/app/purchases/tenders/schema'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: '00000000-0000-4000-8000-000000000001', name: 'Workspace' } }) }))

const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const supplierId = '00000000-0000-4000-8000-000000000003'
const tender: Tender = {
  id, site_id: site, title: 'Equipment sourcing', description: 'Durable office chairs', version: 7,
  status: 'draft', request_id: site, currency: 'USD', net_amount_minor: 5000,
  visibility: 'private', global_visible: false, participation: 'invitation_only', opening_policy: 'after_close',
  participation_deadline: '2090-01-01T00:00:00Z', opening_at: '2090-01-02T00:00:00Z',
  portal_slug: 'chairs', created_by: site, updated_at: '2026-01-01T00:00:00Z',
  requirements: [{ id: site, description: 'Office chair', quantity: 1, unit: 'each', unit_net_minor: 5000, catalog_item_id: null }],
}
const baseDetail = { tender, publications: [], participants: [], site_slug: 'workspace', portal_enabled: false }
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response
const mutations = () => jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method)
const selectTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
async function mount(detail: object = baseDetail) {
  jest.mocked(fetch).mockImplementation(async url => response(String(url).includes('/suppliers?') ? { suppliers: [{ id: supplierId, name: 'Chair supplier' }] } : detail))
  const view = render(<><TopBarPrimaryActionsSlot /><TenderDetail id={id} /></>)
  await screen.findByRole('heading', { name: tender.title, level: 2 })
  return view
}
async function openAction(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Actions' }), { key: 'ArrowDown' })
  fireEvent.click(await screen.findByRole('menuitem', { name }))
}
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => { jest.clearAllMocks() })

test('publication stays disabled after submission and automatic reload while approval is pending', async () => {
  await mount()
  let resolvePublication!: (value: Response) => void
  jest.mocked(fetch).mockImplementation(async (url, init) => {
    if (init?.method === 'POST') return new Promise<Response>(resolve => { resolvePublication = resolve })
    return response(String(url).includes('/suppliers?') ? { suppliers: [] } : { ...baseDetail, publication_pending: true })
  })
  const button = screen.getByRole('button', { name: 'Request publication' })
  fireEvent.click(button)
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(mutations()).toHaveLength(1)
  resolvePublication(response({ status: 'pending' }))
  expect(await screen.findByRole('button', { name: 'Pending' })).toBeDisabled()
  await waitFor(() => expect(jest.mocked(fetch).mock.calls.filter(([url]) => String(url) === `/api/procurement/tenders/${id}?site_id=${site}`).length).toBeGreaterThanOrEqual(2))
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pending' })).toBeDisabled()
  expect(mutations()).toHaveLength(1)
})

test('existing pending approval disables publication on entry and reopening loads a new working version', async () => {
  const view = await mount({ ...baseDetail, publication_pending: true })
  expect(screen.getByRole('button', { name: 'Pending' })).toBeDisabled()
  jest.mocked(fetch).mockImplementation(async url => response(String(url).includes('/suppliers?') ? { suppliers: [] } : {
    ...baseDetail, tender: { ...tender, version: 8 }, publication_pending: false,
  }))
  view.unmount()
  render(<><TopBarPrimaryActionsSlot /><TenderDetail id={id} /></>)
  expect(await screen.findByRole('button', { name: 'Request publication' })).toBeEnabled()
  expect(screen.getByText('Working version 8')).toBeInTheDocument()
  expect(mutations()).toHaveLength(0)
})

test('failed publication can be retried instead of remaining pending', async () => {
  await mount()
  jest.mocked(fetch).mockResolvedValueOnce(response({ error: 'Publication policy is unresolved' }, false))
  fireEvent.click(screen.getByRole('button', { name: 'Request publication' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Request publication' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Pending' })).not.toBeInTheDocument()
})

test('Leads composition puts tabs and readable noninteractive status above compact identity and sticky properties', async () => {
  await mount()
  const toolbar = document.querySelector('[data-toolbar-font]') as HTMLElement
  expect(within(toolbar).getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Activity', 'Lines', 'Suppliers', 'Received quotations', 'Approvals'])
  expect(screen.getByRole('tab', { name: 'Activity' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('tab', { name: 'About' })).not.toBeInTheDocument()
  expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Activity' })).toBeInTheDocument()
  const segments = within(toolbar).getByRole('list')
  expect(within(segments).getAllByRole('listitem')).toHaveLength(4)
  expect(within(segments).getByText('Draft')).toHaveAttribute('aria-current', 'step')
  expect(segments.querySelector('button')).toBeNull()
  expect(segments.outerHTML).not.toMatch(/opacity-|disabled/)
  fireEvent.click(within(segments).getByText('Published'))
  expect(mutations()).toHaveLength(0)
  const heading = screen.getByRole('heading', { name: tender.title, level: 2 })
  expect(toolbar.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(heading.closest('header')).toHaveTextContent('Working version 7')
  expect(within(heading.closest('header')!).getByRole('link', { name: 'Edit working version' })).toHaveAttribute('href', `/purchases/tenders/${id}/edit`)
  const aside = screen.getByRole('complementary', { name: 'Details' })
  expect(within(aside).getByRole('link', { name: 'Linked purchase request' })).toHaveAttribute('href', `/purchases/requests/${tender.request_id}`)
  expect(aside).toHaveTextContent('Publication runs its own policy approval')
  expect(aside).toHaveClass('lg:w-[340px]', 'xl:w-[380px]', 'lg:border-l')
  expect(aside.firstElementChild).toHaveClass('lg:sticky', 'lg:overflow-y-auto')
  expect(aside.parentElement).toHaveClass('lg:flex-row', 'border-t')
  expect(aside.parentElement?.parentElement).toHaveClass('px-4', 'lg:px-8', 'py-5')
  for (const text of ['Durable office chairs', 'Internal net estimate: $50.00', 'Visibility', 'Private', 'Participation', 'Invitation only', 'Offer opening policy']) {
    expect(within(aside).getByText(text)).toBeInTheDocument()
  }
  expect(within(aside).getByText(/Participation closes:/)).toBeInTheDocument()
  expect(within(aside).getByText(/Opening:/)).toBeInTheDocument()
  selectTab('Lines')
  expect(within(screen.getByRole('main')).getByRole('cell', { name: 'Office chair' })).toBeInTheDocument()
  expect(within(screen.getByRole('main')).queryByText(tender.description)).not.toBeInTheDocument()
  expect(aside).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete draft' })).not.toBeInTheDocument()
})


test.each([['Cancel tender', 'Cancel this tender?', 'cancel'], ['Delete draft', 'Delete this unpublished draft?', 'delete']])('menu %s requires confirmation and sends the loaded revision', async (label, title, action) => {
  const push = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  await mount()
  await openAction(label)
  const dialog = await screen.findByRole('alertdialog', { name: title })
  expect(mutations()).toHaveLength(0)
  expect(dialog).toHaveTextContent('The audit record is retained.')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(mutations()).toHaveLength(0)
  await openAction(label)
  jest.mocked(fetch).mockResolvedValueOnce(response({ status: 'cancelled' }))
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }))
  await waitFor(() => expect(mutations()).toHaveLength(1))
  expect(mutations()[0]).toEqual([`/api/procurement/tenders/${id}?site_id=${site}`, expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action, expected_version: 7 }) })])
  if (action === 'delete') await waitFor(() => expect(push).toHaveBeenCalledWith('/purchases/tenders'))
})

test('publication stays only in TopBar, honors busy state and surfaces server errors without inventing publication', async () => {
  await mount()
  const publish = screen.getByRole('button', { name: 'Request publication' })
  expect(publish.closest('#page-primary-actions')).not.toBeNull()
  expect(screen.getAllByRole('button', { name: 'Request publication' })).toHaveLength(1)
  let resolve!: (value: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.click(publish)
  expect(publish).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Actions' })).toBeDisabled()
  resolve(response({ error: 'Tender access denied' }, false))
  expect(await screen.findByRole('alert')).toHaveTextContent('Tender access denied')
  await waitFor(() => expect(publish).toBeEnabled())
  expect(mutations()[0]).toEqual([`/api/procurement/tenders/${id}/publish?site_id=${site}`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ expected_version: 7 }) })])
  selectTab('Activity')
  expect(screen.getByText('Not published. No public access is available.')).toBeInTheDocument()
})

test('portal and invitation controls keep their endpoint payloads inside existing tabs', async () => {
  await mount({ ...baseDetail, participants: [{ id: site, supplier_id: supplierId, status: 'invited', suppliers: { name: 'Chair supplier' } }] })
  selectTab('Suppliers')
  expect(screen.getByRole('link', { name: 'Chair supplier' })).toHaveAttribute('href', `/suppliers/${supplierId}`)
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw invitation' }))
  await waitFor(() => expect(mutations()).toHaveLength(1))
  expect(mutations()[0]).toEqual([`/api/procurement/tenders/${id}/participants?site_id=${site}`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ supplier_id: supplierId, status: 'withdrawn', expected_version: 7 }) })])
  await waitFor(() => expect(screen.getByRole('button', { name: 'Withdraw invitation' })).toBeEnabled())
  selectTab('Activity')
  fireEvent.click(screen.getByRole('button', { name: 'Enable workspace portal' }))
  await waitFor(() => expect(mutations()).toHaveLength(2))
  expect(mutations()[1]).toEqual([`/api/procurement/tenders/portal?site_id=${site}`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ enabled: true }) })])
})

test('closing eligibility uses published deadline, not working terms; published version cannot republish', async () => {
  await mount({ ...baseDetail, tender: { ...tender, status: 'published' }, publications: [{ id: site, version: 7, published_at: '2020-01-01T00:00:00Z', snapshot: { ...tender, participation_deadline: '2020-01-01T00:00:00Z' } }] })
  expect(screen.queryByRole('button', { name: 'Request publication' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close participation' }))
  await waitFor(() => expect(mutations()).toHaveLength(1))
  expect(mutations()[0]).toEqual([`/api/procurement/tenders/${id}?site_id=${site}`, expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ action: 'close', expected_version: 7 }) })])
})

test.each(['closed', 'cancelled'])('%s tender keeps content but removes lifecycle mutations', async status => {
  await mount({ ...baseDetail, tender: { ...tender, status } })
  expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Request publication' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Edit working version' })).not.toBeInTheDocument()
  selectTab('Suppliers')
  expect(screen.queryByRole('button', { name: 'Register invitation' })).not.toBeInTheDocument()
  expect(screen.getByRole('complementary')).toHaveTextContent(tender.description)
  expect(mutations()).toHaveLength(0)
})


test('Approvals retains real stage decisions and refreshes tender data after confirmation', async () => {
  await mount()
  jest.mocked(fetch).mockImplementation(async url => response(String(url).includes('/approvals?') ? { approvals: [{ id: site, status: 'pending', event: 'publication', target_version: 7, procurement_event_stages: [{ id, status: 'pending', position: 0, definition: { name: 'Manager review', decisionMode: 'human' } }] }] } : String(url).includes('/suppliers?') ? { suppliers: [] } : baseDetail))
  selectTab('Approvals')
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Reviewed current terms' } })
  jest.mocked(fetch).mockResolvedValueOnce(response({ id: site, status: 'approved' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm decision' }))
  await waitFor(() => expect(mutations()).toHaveLength(1))
  expect(mutations()[0]).toEqual([`/api/procurement/approvals/${site}/decisions?site_id=${site}`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ stage_id: id, decision: 'approve', reason: 'Reviewed current terms' }) })])
  await waitFor(() => expect(jest.mocked(fetch).mock.calls.filter(([url]) => String(url) === `/api/procurement/tenders/${id}?site_id=${site}`).length).toBeGreaterThan(1))
})
