import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'
import { notifyScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))

const fetchMock = jest.mocked(fetch)
const option = { tender_id: 'tender-a', title: 'Equipment', publication_id: 'revision-a', currency: 'USD',
  suppliers: [{ id: 'supplier-a', name: 'Eligible supplier' }], requirements: [{ id: 'req', description: 'Printer', quantity: 2, unit: 'each' }] }
const quote = { id: 'quote-a', supplier_name: 'Opened supplier', reference: 'REF', tender_id: 'tender-a', tender_title: 'Equipment',
  recorded_at: '2026-10-29', source: 'buyer_recorded', currency: 'USD', net_amount_minor: 100, tax_amount_minor: 0, lines: [] }
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body }) as Response
function pending() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(done => { resolve = done })
  return { promise, resolve }
}
const choices = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/options?'))
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
const record = () => fireEvent.click(screen.getByRole('button', { name: 'Record external quotation' }))
const close = () => fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
beforeEach(() => { fetchMock.mockReset() })
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => '00000000-0000-4000-8000-000000000099' })
})

test('an option failure stays in the dialog; dismiss aborts the read and reopening cannot show a late result', async () => {
  const old = pending()
  let reads = 0
  fetchMock.mockImplementation(async url => !String(url).includes('/options?') ? response({ data: [quote], envelopes: [] })
    : ++reads === 1 ? old.promise : reads === 2 ? response({ error: 'Forbidden' }, 403) : response({ data: [] }))
  render(<ProcurementQuotesPanel siteId="buyer" embedded />)
  await screen.findByText('Opened supplier')
  expect(fetch).toHaveBeenCalledTimes(1)
  record()
  expect(screen.getByRole('status', { name: 'Loading records' })).toBeInTheDocument()
  const firstSignal = choices()[0][1]!.signal!
  close()
  expect(firstSignal.aborted).toBe(true)
  record()
  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Forbidden')
  await act(async () => old.resolve(response({ data: [option] })))
  expect(screen.queryByLabelText('Tender')).not.toBeInTheDocument()
  expect(screen.queryByText('No eligible open tender is available.')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('No eligible open tender is available.')
  close()
  expect(screen.getByText('Opened supplier')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(4)
  expect(posts()).toHaveLength(0)
})

test.each(['site', 'tender', 'permission'])('changing the %s retires the open form and ignores its pending options', async kind => {
  const old = pending()
  fetchMock.mockImplementation(async url => !String(url).includes('/options?') ? response({ data: [] })
    : choices().length === 1 ? old.promise : response({ data: [] }))
  const tree = (site: string, tender: string) => <ProcurementQuotesPanel siteId={site} tenderId={tender} embedded />
  const view = render(tree('buyer-a', 'tender-a'))
  await screen.findByText('No procurement quotations recorded.')
  record()
  const signal = choices()[0][1]!.signal!
  if (kind === 'permission') act(() => notifyScreenScopeChanged('buyer-a'))
  else view.rerender(tree(kind === 'site' ? 'buyer-b' : 'buyer-a', kind === 'tender' ? 'tender-b' : 'tender-a'))
  expect(signal.aborted).toBe(true)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await screen.findByText('No procurement quotations recorded.')
  expect(choices()).toHaveLength(1)
  record()
  await screen.findByText('No eligible open tender is available.')
  await act(async () => old.resolve(response({ data: [option] })))
  expect(screen.queryByLabelText('Tender')).not.toBeInTheDocument()
  expect(posts()).toHaveLength(0)
})

test('a retained draft retries only the original publication and payload; success refreshes only the list', async () => {
  let publication = 'revision-a'
  fetchMock.mockImplementation(async (url, init) => init?.method === 'POST'
    ? posts().length === 1 ? response({ error: 'Unconfirmed' }, 503) : response({ data: 'saved' })
    : String(url).includes('/options?') ? response({ data: [{ ...option, publication_id: publication }] }) : response({ data: [] }))
  render(<ProcurementQuotesPanel siteId="buyer" tenderId="tender-a" embedded />)
  await screen.findByText('No procurement quotations recorded.')
  record()
  fireEvent.click(await screen.findByLabelText('Invited supplier'))
  fireEvent.click(await screen.findByText('Eligible supplier'))
  fireEvent.change(screen.getByLabelText('External quotation reference'), { target: { value: 'Supplier-ref' } })
  fireEvent.change(screen.getByLabelText(/Printer \(2 each\)/), { target: { value: '500' } })
  fireEvent.click(screen.getByRole('button', { name: 'Record quotation' }))
  await screen.findByText('Unconfirmed')
  close()
  expect(posts()).toHaveLength(1)
  publication = 'revision-b'
  record()
  await screen.findByLabelText('Tender')
  const retryChanged = screen.getByRole('button', { name: 'Retry the same quotation' })
  expect(retryChanged).toBeDisabled()
  fireEvent.submit(retryChanged.closest('form')!)
  expect(posts()).toHaveLength(1)
  close()
  publication = 'revision-a'
  record()
  expect(await screen.findByDisplayValue('Supplier-ref')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry the same quotation' }))
  await screen.findByText('No procurement quotations recorded.')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(posts()).toHaveLength(2)
  expect(posts()[1][1]?.body).toBe(posts()[0][1]?.body)
  expect(JSON.parse(String(posts()[1][1]?.body))).toMatchObject({ publication_id: 'revision-a', supplier_id: 'supplier-a', lines: [{ requirement_id: 'req', unit_net_minor: 500 }] })
  expect(choices()).toHaveLength(3)
})