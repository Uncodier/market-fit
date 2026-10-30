import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import Page from '@/app/purchases/procurement/approvals/page'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: '11111111-1111-4111-8111-111111111111' } }) }))
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = jest.fn()
})
const id = '22222222-2222-4222-8222-222222222222'
test('labels deprecated approvals in the inbox and keeps their review read-only', async () => {
  jest.mocked(fetch).mockImplementation(async url => ({ ok: true, json: async () => String(url).includes('/inbox?')
    ? { rows: [{ id: `event:${id}`, target_id: id, title: 'Old tender', stage: 'publication', status: 'pending', revision: 1, date: '2026-10-28', is_deprecated: true }], count: 1 }
    : { approvals: [{ id, status: 'pending', event: 'publication', target_version: 1, is_deprecated: true,
      procurement_event_stages: [{ id, status: 'pending', position: 1, definition: { name: 'Review', decisionMode: 'human' } }] }] },
  }) as Response)
  render(<Page />)
  expect(await screen.findByText('Deprecated')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Review' }))
  const dialog = await screen.findByRole('dialog')
  expect(await within(dialog).findByText('Deprecated')).toBeInTheDocument()
  expect(within(dialog).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
})
test('keeps the approvals toolbar above the skeleton while the inbox request is pending', () => {
  jest.mocked(fetch).mockReturnValue(new Promise(() => {}))
  const { container } = render(<Page />)
  const header = container.querySelector('[data-toolbar-font]')!
  expect(container.querySelectorAll('[data-toolbar-font]')).toHaveLength(1)
  expect(header).toHaveClass('sticky', 'shrink-0', 'top-[var(--topbar-height,64px)]', 'min-h-[71px]')
  const content = header.nextElementSibling!
  expect(content).toHaveClass('overflow-auto', 'min-h-0')
  expect(content.contains(screen.getByRole('status', { name: 'Loading records' }))).toBe(true)
  expect(header.contains(screen.getByRole('combobox', { name: 'Approval stage' }))).toBe(true)
  expect(screen.queryByRole('button', { name: 'Refresh approvals' })).not.toBeInTheDocument()
  const table = screen.getByRole('table', { name: 'Purchase approvals' })
  expect(table).toHaveAttribute('aria-busy', 'true')
  expect(table.querySelectorAll('thead th')).toHaveLength(6)
  expect(table.querySelectorAll('tbody tr')).toHaveLength(6)
  expect(table.querySelectorAll('tbody .animate-pulse')).toHaveLength(36)
  // No standalone skeleton card can push the column headers below the loading rows.
  expect(content.querySelectorAll('.animate-pulse')).toHaveLength(36)
  for (const skeleton of content.querySelectorAll('.animate-pulse')) expect(skeleton.closest('tbody')).not.toBeNull()
  expect(table.querySelector('thead')!.compareDocumentPosition(table.querySelector('tbody')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
test('loading rows are replaced in place without moving or remounting the column headers', async () => {
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockReturnValue(new Promise<Response>(done => { resolve = done }))
  render(<Page />)
  const table = screen.getByRole('table', { name: 'Purchase approvals' })
  const header = table.querySelector('thead')
  resolve({ ok: true, json: async () => ({ rows: [{ id: 'request:1', target_id: id, title: 'Office supplies', stage: 'requisition', status: 'pending', revision: 1, date: '2026-10-28' }], count: 1 }) } as Response)
  await screen.findByText('Office supplies')
  expect(screen.getByRole('table')).toBe(table)
  expect(table.querySelector('thead')).toBe(header)
  expect(table).toHaveAttribute('aria-busy', 'false')
  expect(table.querySelectorAll('.animate-pulse')).toHaveLength(0)
  expect(table.querySelectorAll('tbody tr')).toHaveLength(1)
  expect(screen.queryByRole('status', { name: 'Loading records' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Refresh approvals' })).not.toBeInTheDocument()
})
test('stage and status filter the same table without swapping requisition/event screens', async () => {
  jest.mocked(fetch).mockImplementation(async url => {
    const stage = new URL(String(url), 'http://localhost').searchParams.get('stage')
    const rows = [{ id: 'request:1', target_id: id, title: 'Office supplies', stage: 'requisition', status: 'pending', revision: 1, date: '2026-10-28' },
      { id: 'event:2', target_id: id, title: 'Tender publication', stage: 'publication', status: 'pending', revision: 1, date: '2026-10-28' }]
    return { ok: true, json: async () => ({ rows: stage === 'all' ? rows : rows.filter(row => row.stage === stage), count: stage === 'all' ? 2 : 1 }) } as Response
  })
  render(<Page />)
  await screen.findByText('Office supplies')
  const table = screen.getByRole('table', { name: 'Purchase approvals' })
  const headers = within(table).getAllByRole('columnheader').map(node => node.textContent)
  expect(screen.queryByRole('tab', { name: 'Publication and commitments' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('combobox', { name: 'Approval stage' }))
  fireEvent.click(await screen.findByRole('option', { name: 'Tender publication' }))
  await waitFor(() => expect(screen.queryByText('Office supplies')).not.toBeInTheDocument())
  expect(screen.getByRole('table')).toBe(table)
  expect(within(table).getAllByRole('columnheader').map(node => node.textContent)).toEqual(headers)
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('stage=publication&status=pending'), expect.anything())
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Approved' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('stage=publication&status=approved'), expect.anything()))
  expect(screen.getByRole('table')).toBe(table)
})
test('keeps the table structure on unavailable storage and never shows partial rows', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false } as Response)
  render(<Page />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load approvals')
  expect(screen.getByRole('columnheader', { name: 'Stage' })).toBeInTheDocument()
  expect(screen.queryByText('No approvals match these filters.')).not.toBeInTheDocument()
})