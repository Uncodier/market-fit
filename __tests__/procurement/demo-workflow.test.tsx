import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { RequestList } from '@/app/purchases/requests/request-list'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import NewRequest from '@/app/purchases/requests/new/page'
import { TenderList } from '@/app/purchases/tenders/tender-list'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
import { TenderEditor } from '@/app/purchases/tenders/tender-editor'
import { demoRequestDocument, demoRequestSummaries, getDemoRequestDetail, getDemoTenderDetail, getDemoTenders } from '@/lib/demo-data/procurement-workflow'
import { demoImportOptions, demoProcurementQuotes, demoProcurementOrders } from '@/lib/demo-data/procurement-commerce'

let mockSiteId = 'demo-saas-en-123'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: mockSiteId, name: 'Workplace demo' } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => {
  mockSiteId = 'demo-saas-en-123'
  localStorage.clear()
  document.cookie = 'market_fit_demo_site_id=; max-age=0; path=/'
  jest.clearAllMocks()
  jest.mocked(fetch).mockRejectedValue(new Error('Demo must not call the backend'))
  render(<TopBarPrimaryActionsSlot />)
})
afterEach(() => { expect(fetch).not.toHaveBeenCalled() })

function tab(name: string) {
  fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
}

test('fixtures keep request, tender and supplier relationships and minor-unit totals consistent', () => {
  const request = getDemoRequestDetail(mockSiteId, 'demo-request-workplace')!
  const tender = getDemoTenderDetail(mockSiteId, 'demo-tender-workplace')!
  expect(request.request.tenders?.[0].id).toBe(tender.tender.id)
  expect(tender.tender.request_id).toBe(request.request.id)
  expect(request.items.reduce((total, line) => total + line.net_amount_minor!, 0)).toBe(request.request.net_amount_minor)
  expect(tender.tender.requirements.reduce((total, line) => total + line.quantity * line.unit_net_minor, 0)).toBe(tender.tender.net_amount_minor)
  expect(tender.participants.map(row => row.supplier_id)).toEqual(['demo-supplier-northstar', 'demo-supplier-summit', 'demo-supplier-cedar'])
  expect(demoRequestDocument.currency).toBe('USD')
  expect(getDemoRequestDetail(mockSiteId, 'unknown')).toBeNull()
  expect(getDemoTenderDetail(mockSiteId, 'unknown')).toBeNull()
  expect(tender.tender.requirements.map(line => line.id)).toEqual(demoImportOptions[0].requirements.map(line => line.id))
  for (const quote of demoProcurementQuotes) {
    const linked = getDemoTenderDetail(mockSiteId, quote.tender_id!)!
    expect(linked.tender.title).toBe(quote.tender_title)
    expect(linked.publications[0].id).toBe(quote.publication_id)
    expect(linked.participants.find(row => row.supplier_id === quote.supplier_id)?.suppliers?.name).toBe(quote.supplier_name)
  }
  expect(demoProcurementOrders[0].quotation_id).toBe(demoProcurementQuotes[2].id)
  const sealed = getDemoTenderDetail(mockSiteId, 'demo-tender-sealed')!
  expect(sealed.tender.opening_policy).toBe('after_close')
  expect(sealed.publications[0].snapshot.opening_policy).toBe('after_close')
  expect(sealed.receipt_activity).toHaveLength(2)
})

test('request list supports local searching, board and linked tender navigation', () => {
  render(<RequestList />)
  expect(screen.getByRole('link', { name: 'Workplace technology refresh' })).toHaveAttribute('href', '/purchases/requests/demo-request-workplace')
  expect(screen.getByRole('link', { name: 'Workplace technology procurement' })).toHaveAttribute('href', '/purchases/tenders/demo-tender-workplace')
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'starter' } })
  expect(screen.getByRole('link', { name: 'New starter accessories' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Workplace technology refresh' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle kanban view' }))
  expect(screen.getByText(/Read-only board/)).toBeInTheDocument()
})

test('request detail uses existing lines, approval stages, activity and a safe editor', () => {
  render(<RequestDetail id="demo-request-workplace" />)
  expect(screen.getByRole('link', { name: 'Workplace technology procurement' })).toBeInTheDocument()
  expect(screen.getByText('Annual workplace support')).toBeInTheDocument()
  tab('Approvals')
  expect(screen.getAllByText(/IT security review/).length).toBeGreaterThan(0)
  tab('Activity')
  expect(screen.getAllByText(/Revision 1/).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'Edit request' }))
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Local preview edit' } })
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
})

test('new request is populated, editable locally and cannot save or load catalog/taxes', () => {
  render(<NewRequest />)
  expect(screen.getByLabelText('Title')).toHaveValue('Workplace technology refresh')
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  expect(screen.queryByRole('combobox', { name: /Catalog/ })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Local draft title' } })
  expect(screen.getByLabelText('Title')).toHaveValue('Local draft title')
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
})

test('tender list shows navigable published, draft and completed stages', () => {
  render(<TenderList />)
  for (const tender of getDemoTenders(mockSiteId)) expect(screen.getByRole('link', { name: tender.title })).toHaveAttribute('href', `/purchases/tenders/${tender.id}`)
  fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'sourcing draft' } })
  expect(screen.queryByRole('link', { name: 'Workplace technology procurement' })).not.toBeInTheDocument()
})

test.each([undefined, 'demo-tender-workplace'])('tender editor %s previews existing form without catalog or save requests', id => {
  render(<TenderEditor id={id} />)
  expect(screen.getByLabelText('Title')).toHaveValue('Workplace technology procurement')
  expect(screen.getByRole('button', { name: 'Save working version' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
})

test('tender detail tabs including real nested commerce/approval panels stay local', async () => {
  render(<TenderDetail id="demo-tender-workplace" />)
  expect(screen.getByRole('link', { name: 'Open latest public publication' })).toHaveAttribute('href', '/tenders/demo-procurement/demo-tender-workplace')
  expect(screen.getByRole('link', { name: 'Linked purchase request' })).toHaveAttribute('href', '/purchases/requests/demo-request-workplace')
  tab('Lines')
  expect(screen.getByText('Annual workplace support')).toBeInTheDocument()
  tab('Suppliers')
  expect(screen.getByRole('link', { name: 'Northstar Technology' })).toHaveAttribute('href', '/suppliers/demo-supplier-northstar')
  expect(screen.getByRole('button', { name: 'Register invitation' })).toBeDisabled()
  tab('Received quotations')
  await waitFor(() => expect(screen.getAllByText(/Northstar/).length).toBeGreaterThan(0))
  tab('Approvals')
  await waitFor(() => expect(fetch).not.toHaveBeenCalled())
})

test('stale real site with an active demo cookie is also backend-free', () => {
  mockSiteId = '00000000-0000-4000-8000-000000000001'
  document.cookie = 'market_fit_demo_site_id=demo-saas-en-123; path=/'
  render(<RequestList />)
  expect(screen.getByRole('link', { name: demoRequestSummaries[0].title })).toBeInTheDocument()
})

test('unknown demo records render explicit errors without fallback backend access', () => {
  const request = render(<RequestDetail id="unknown" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Demo request not found.')
  request.unmount()
  render(<TenderDetail id="unknown" />)
  expect(screen.getByRole('alert')).toHaveTextContent('Demo tender not found.')
})

test('stale real site cannot fetch from nested tender tabs or editors', async () => {
  mockSiteId = '00000000-0000-4000-8000-000000000001'
  document.cookie = 'market_fit_demo_site_id=demo-saas-en-123; path=/'
  const detail = render(<TenderDetail id="demo-tender-workplace" />)
  tab('Received quotations')
  await waitFor(() => expect(screen.getAllByText(/Northstar/).length).toBeGreaterThan(0))
  tab('Approvals')
  await waitFor(() => expect(fetch).not.toHaveBeenCalled())
  detail.unmount()
  const editor = render(<TenderEditor />)
  expect(screen.getByRole('button', { name: 'Save working version' })).toBeDisabled()
  editor.unmount()
  render(<NewRequest />)
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
})