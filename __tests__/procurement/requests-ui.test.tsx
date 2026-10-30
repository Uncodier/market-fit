import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = jest.fn()
})
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { RequestEditor } from '@/app/purchases/requests/request-editor'
import { requestDocumentSchema } from '@/app/purchases/requests/schema'
import { RequestList } from '@/app/purchases/requests/request-list'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
const site = '00000000-0000-4000-8000-000000000001'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: site } }) }))

beforeEach(() => {
  render(<TopBarPrimaryActionsSlot />)

  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ taxes: [{ id: '00000000-0000-4000-8000-000000000301', name: 'VAT', rate: 16 }] }) } as Response)
})
test('service form saves an explicit internal estimate and selected tax IDs, not tax rates', async () => {
  const save = jest.fn(async () => undefined)
  render(<RequestEditor siteId="site" busy={false} onSave={save} />)
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save draft' })).toBeInTheDocument()
  expect(document.getElementById('page-primary-actions')).toBeEmptyDOMElement()
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Consulting request' } })
  fireEvent.change(screen.getByLabelText('Service description'), { target: { value: 'Consulting' } })
  fireEvent.change(screen.getByLabelText('Internal unit estimate (minor units)'), { target: { value: '5000' } })
  fireEvent.click(await screen.findByLabelText('VAT (16%)'))
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ lines: [{
    catalog_item_id: null, description: 'Consulting', quantity: 1, unit_estimate_minor: 5000,
    tax_ids: ['00000000-0000-4000-8000-000000000301'],
  }] })))
})
test('service estimates require explicit tax selection; catalog client prices are rejected', () => {
  const document = { title: 'Request', currency: 'USD', lines: [{ catalog_item_id: null, description: 'Service', quantity: 1, unit_estimate_minor: 100 }] }
  expect(requestDocumentSchema.safeParse(document).success).toBe(false)
  expect(requestDocumentSchema.safeParse({ ...document, lines: [{ ...document.lines[0], tax_ids: [] }] }).success).toBe(true)
  expect(requestDocumentSchema.safeParse({ ...document, lines: [{ ...document.lines[0], catalog_item_id: '00000000-0000-4000-8000-000000000300', tax_ids: [] }] }).success).toBe(false)
})
test('request list renders real rows and a read-only board without transition mutations', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ requests: [{ id: site, title: 'Office supplies', status: 'draft', currency: 'USD', net_amount_minor: 1000, revision: 1, updated_at: '2026-10-27T00:00:00Z' }], count: 1, can_manage: true }) } as Response)
  render(<RequestList />)
  expect(await screen.findByRole('link', { name: 'Office supplies' })).toHaveAttribute('href', `/purchases/requests/${site}`)
  expect(within(document.getElementById('page-primary-actions')!).getByRole('link', { name: 'Create request' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Create request' })).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Approval queue' }).compareDocumentPosition(screen.getByRole('radio', { name: 'Toggle kanban view' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle kanban view' }))
  expect(screen.getByText(/Read-only board/)).toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls.some(([, init]) => init?.method)).toBe(false)
})
test('missing request storage stays an error and does not masquerade as empty', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Purchase request storage unavailable' }) } as Response)
  render(<RequestList />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Purchase request storage unavailable')
  expect(screen.queryByText('No requests match this view.')).not.toBeInTheDocument()
})
test('shows requisition approval independently from linked tender lifecycle and filters on the server', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ requests: [
    { id: site, title: 'Office equipment', status: 'approved', currency: 'USD', net_amount_minor: 1000, revision: 2,
      updated_at: '2026-10-27T00:00:00Z', tenders: [{ id: 'tender-1', title: 'Equipment sourcing', status: 'draft' }] },
    { id: 'request-2', title: 'Internal service', status: 'draft', currency: 'USD', net_amount_minor: 500, revision: 1,
      updated_at: '2026-10-27T00:00:00Z', tenders: [] },
  ], count: 2, can_manage: true }) } as Response)
  render(<RequestList />)
  const table = await screen.findByRole('table')
  expect(within(table).getByRole('columnheader', { name: 'Approval status' })).toBeInTheDocument()
  expect(within(table).getByRole('columnheader', { name: 'Sourcing' })).toBeInTheDocument()
  expect(within(table).getByRole('link', { name: 'Equipment sourcing' })).toHaveAttribute('href', '/purchases/tenders/tender-1')
  const row = within(table).getByRole('link', { name: 'Office equipment' }).closest('tr')!
  expect(row).toHaveTextContent('Approved')
  expect(row).toHaveTextContent('Draft')
  expect(row).toHaveTextContent('Tender linked')
  fireEvent.click(screen.getByRole('combobox', { name: 'Sourcing filter' }))
  fireEvent.click(await screen.findByRole('option', { name: 'With linked tender' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('sourcing=with_tender'), expect.anything()))
})
test('does not label hidden tender relationships as direct purchasing', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ requests: [{ id: site, title: 'Assigned request', status: 'submitted', currency: 'USD', net_amount_minor: 100, revision: 1, updated_at: '2026-10-27T00:00:00Z' }], count: 1, can_manage: false }) } as Response)
  render(<RequestList />)
  const table = await screen.findByRole('table')
  expect(table).toHaveTextContent('Not available')
  expect(screen.queryByRole('combobox', { name: 'Sourcing filter' })).not.toBeInTheDocument()
  expect(within(table).queryByText('No tender linked')).not.toBeInTheDocument()
})
test('detail shows a purchase-style document beside the workflow and submits from the toolbar', async () => {
  const request = { id: site, title: 'Office supplies', description: 'For the new office', status: 'draft', currency: 'USD', net_amount_minor: 1000, revision: 3, requester_id: site, resolved_plan: null }
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? {} : { request, actor_id: site, can_manage: true, items: [{ id: 'line', revision: 3, description: 'Paper', quantity: 2, catalog_item_id: site, unit_net_minor: 500, valuation_source: 'catalog', tax_snapshot: [] }], stages: [], audit: [] } }) as Response)
  render(<RequestDetail id={site} />)
  await screen.findByText('For the new office')
  const toolbar = screen.getByRole('toolbar', { name: 'Purchase request' })
  expect(within(toolbar).getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument()
  expect(document.getElementById('page-primary-actions')).toBeEmptyDOMElement()
  const documentView = screen.getByRole('article', { name: 'Purchase request' })
  expect(within(documentView).getByText('Paper')).toBeInTheDocument()
  expect(within(documentView).getByText('For the new office')).toBeInTheDocument()
  const sidebar = screen.getByRole('complementary', { name: 'Request information' })
  expect(within(sidebar).getByRole('tab', { name: 'Approvals' })).toHaveAttribute('data-state', 'active')
  fireEvent.mouseDown(within(sidebar).getByRole('tab', { name: 'Activity' }), { button: 0, ctrlKey: false })
  expect(within(sidebar).getByText('No activity recorded.')).toBeInTheDocument()
  expect(within(documentView).getByText('Paper')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/submit?'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ expected_revision: 3 }) })))
})

test('eligible approval actions use the toolbar and retain the reason and stage revision contract', async () => {
  const request = { id: site, title: 'Equipment', description: 'Review equipment', status: 'submitted', currency: 'USD', net_amount_minor: 1000, revision: 3, requester_id: site, resolved_plan: null }
  const stage = { id: 'stage-1', revision: 3, status: 'pending', decisions: [], definition: {
    name: 'Manager review', decisionMode: 'human', execution: 'parallel', approverIds: [site], mandatoryApproverIds: [],
    quorum: { mode: 'any' }, rejectionBehavior: 'veto', resolvedDeadline: null,
  } }
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? {} : { request, actor_id: site, can_manage: false, items: [], stages: [stage, { ...stage, id: 'old-stage', revision: 2 }], audit: [] } }) as Response)
  render(<RequestDetail id={site} />)
  await screen.findByText('Review equipment')
  const toolbar = screen.getByRole('toolbar')
  const sidebar = screen.getByRole('complementary')
  const approve = within(toolbar).getByRole('button', { name: 'Approve stage' })
  expect(approve).toBeDisabled()
  expect(within(sidebar).queryByRole('button', { name: 'Approve stage' })).not.toBeInTheDocument()
  expect(within(toolbar).queryByRole('button', { name: 'Submit for approval' })).not.toBeInTheDocument()
  fireEvent.change(within(sidebar).getByRole('textbox'), { target: { value: 'Equipment is required' } })
  expect(approve).toBeEnabled()
  fireEvent.click(approve)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/decisions?'), expect.objectContaining({
    method: 'POST', body: JSON.stringify({ expected_revision: 3, stage_id: 'stage-1', decision: 'approve', reason: 'Equipment is required' }),
  })))
})

test('non-eligible reviewers cannot see decision actions or a reason field', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({
    request: { id: site, title: 'Equipment', description: 'Read-only request', status: 'submitted', currency: 'USD', net_amount_minor: 0, revision: 1, requester_id: site, resolved_plan: null },
    actor_id: site, can_manage: false, items: [], audit: [], stages: [{ id: 'stage-1', revision: 1, status: 'pending', decisions: [], definition: {
      name: 'Other reviewer', decisionMode: 'human', execution: 'parallel', approverIds: ['other-user'], mandatoryApproverIds: [], quorum: { mode: 'any' }, rejectionBehavior: 'veto', resolvedDeadline: null,
    } }],
  }) } as Response)
  render(<RequestDetail id={site} />)
  await screen.findByText('Read-only request')
  expect(within(screen.getByRole('toolbar')).queryByRole('button', { name: 'Approve stage' })).not.toBeInTheDocument()
  expect(within(screen.getByRole('complementary')).queryByRole('textbox')).not.toBeInTheDocument()
})