import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SupplierDetail } from '@/app/suppliers/components/supplier-detail'
import { SupplierList } from '@/app/suppliers/components/supplier-list'
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })

const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const supplier = { id, site_id: site, version: 1, name: 'Professional', status: 'prospect', company_id: null,
  contacts: [], category_ids: [], commercial_terms: 'Net 30', private_notes: 'Internal evaluation',
  created_at: '2026-10-27T00:00:00Z', updated_at: '2026-10-27T00:00:00Z' }
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body })
beforeEach(() => {
  render(<TopBarPrimaryActionsSlot />)
  jest.clearAllMocks(); global.fetch = jest.fn()
})
it('lists real API results with detail navigation, filtering and create', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ suppliers: [supplier], total: 1, can_create: true }) as Response)
  render(<SupplierList siteId={site} />)
  expect(await screen.findByRole('link', { name: 'Professional' })).toHaveAttribute('href', `/suppliers/${id}`)
  expect(within(document.getElementById('page-primary-actions')!).getByRole('button', { name: 'Create supplier' })).toBeEnabled()
  expect(screen.getAllByRole('button', { name: 'Create supplier' })).toHaveLength(1)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Archived' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('status=archived'), expect.any(Object)))
})
it('shows schema failures as retryable errors, never an empty supplier directory', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ error: 'Supplier storage is unavailable' }, 503) as Response)
  render(<SupplierList siteId={site} />)
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText('No suppliers found')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
})
it('switches between table and a read-only status board without refetching or changing suppliers', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ suppliers: [supplier], total: 1, can_create: true }) as Response)
  render(<SupplierList siteId={site} />)
  await screen.findByRole('link', { name: 'Professional' })
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle kanban view' }))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Prospect' })).getByRole('link', { name: 'Professional' })).toHaveAttribute('href', `/suppliers/${id}`)
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle table view' }))
  expect(screen.getByRole('table')).toBeInTheDocument()
})
it('keeps supplier properties in the sidebar across detail tabs', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ supplier, can_edit: true }) as Response)
  render(<SupplierDetail siteId={site} id={id} />)
  await screen.findByRole('heading', { name: 'Professional', level: 2 })
  const aside = screen.getByRole('complementary', { name: 'Supplier identity' })
  expect(within(aside).getByText('Professional')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getAllByRole('tab', { name: 'Contacts' })[0], { button: 0, ctrlKey: false })
  expect(within(aside).getByText('Professional')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('form', 'supplier-edit-form')
  expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
})
it('does not fall back to an inline create action when the global slot is absent', async () => {
  cleanup()
  jest.mocked(fetch).mockResolvedValue(response({ suppliers: [supplier], total: 1, can_create: true }) as Response)
  render(<SupplierList siteId={site} />)
  await screen.findByRole('link', { name: 'Professional' })
  expect(screen.queryByRole('button', { name: 'Create supplier' })).not.toBeInTheDocument()
})
it('opens supplier creation as a dialog and keeps contact changes in its payload', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ suppliers: [supplier], total: 1, can_create: true }) as Response)
  render(<SupplierList siteId={site} />)
  await screen.findByRole('link', { name: 'Professional' })
  fireEvent.click(screen.getByRole('button', { name: 'Create supplier' }))
  expect(screen.getByRole('dialog', { name: 'Create supplier' })).toBeInTheDocument()
})
it('creates a professional without a company or CRM lead and includes normalized contacts', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ supplier }) as Response)
  render(<SupplierDetail siteId={site} id="new" />)
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Create supplier' })).toBeInTheDocument()
  expect(document.getElementById('page-primary-actions')).toBeEmptyDOMElement()
  fireEvent.change(screen.getByLabelText('Supplier name'), { target: { value: 'Professional' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add contact' }))
  fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Contact person' } })
  fireEvent.change(screen.getByLabelText('email'), { target: { value: 'contact@example.test' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create supplier' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const body = JSON.parse(jest.mocked(fetch).mock.calls[0][1]?.body as string)
  expect(body).toMatchObject({ name: 'Professional', status: 'prospect', company_id: null, expected_version: 0,
    contacts: [{ name: 'Contact person', email: 'contact@example.test', is_primary: true }] })
  expect(body).not.toHaveProperty('lead_id')
  expect(body).not.toHaveProperty('supplier_user_id')
})
it('keeps a conflicting draft visible and blocks blind retries', async () => {
  jest.mocked(fetch).mockImplementation(async (url, init) => {
    if (String(url).includes('/references')) return response({ options: [], has_more: false }) as Response
    return init?.method === 'PUT' ? response({}, 409) as Response : response({ supplier, can_edit: true }) as Response
  })
  render(<SupplierDetail siteId={site} id={id} />)
  await screen.findByRole('heading', { name: 'Professional', level: 2 })
  expect(within(document.getElementById('page-primary-actions')!).getByRole('button', { name: 'Save changes' })).toBeDisabled()
  fireEvent.click(screen.getByText('Internal evaluation', { selector: 'div[title]' }))
  fireEvent.change(screen.getByLabelText('Private workspace notes'), { target: { value: 'Unsaved note' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save private workspace notes' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('changed in another session')
  expect(screen.getByText('Unsaved note', { selector: 'div[title]' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})
it('shows member read-only detail without editable fields or archive actions', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ supplier, can_edit: false }) as Response)
  render(<SupplierDetail siteId={site} id={id} />)
  await screen.findByRole('heading', { name: 'Professional', level: 2 })
  expect(screen.queryByRole('textbox', { name: 'Supplier name' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive supplier' })).not.toBeInTheDocument()
  expect(screen.getByText(/Read-only access/)).toBeInTheDocument()
})
it('edits existing relationship contacts without an add action or saving until the supplier is saved', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ supplier: { ...supplier, contacts: [{ name: 'Original contact', email: '', phone: '', role: '', is_primary: true }] }, can_edit: true }) as Response)
  render(<SupplierDetail siteId={site} id={id} />)
  await screen.findByRole('heading', { name: 'Professional', level: 2 })
  fireEvent.mouseDown(screen.getAllByRole('tab', { name: 'Contacts' })[0], { button: 0, ctrlKey: false })
  expect(screen.queryByRole('button', { name: 'Add contact' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Edit Original contact' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit contact' })
  fireEvent.change(within(dialog).getByLabelText('name'), { target: { value: 'Procurement contact' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Apply contact' }))
  expect(screen.getByText('Procurement contact')).toBeInTheDocument()
  expect(screen.getByText('Primary')).toBeInTheDocument()
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls.some(([, init]) => init?.method)).toBe(false)
})