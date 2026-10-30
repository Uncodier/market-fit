import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { SupplierDetail } from '@/app/suppliers/components/supplier-detail'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))

const siteId = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const supplier = {
  id, site_id: siteId, version: 3, name: 'Northstar supplier', status: 'prospect', company_id: null,
  category_ids: [], contacts: [{ name: 'Alex Buyer', role: 'Sales', email: 'alex@example.test', phone: '', is_primary: true }],
  commercial_terms: 'Net 30', private_notes: 'Workspace only',
  created_at: '2026-10-27T00:00:00Z', updated_at: '2026-10-27T00:00:00Z',
}
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn(async (url, init) => {
    if (String(url).includes('/references')) return response({ options: [], has_more: false })
    if (String(url).includes('/activity')) return response({ activity: [{ version: 3, action: 'updated', previous_status: 'prospect', status: 'prospect', created_at: supplier.updated_at }] })
    if (init?.method === 'PUT') return response({ supplier: { ...supplier, ...JSON.parse(init.body as string), version: 4 } })
    return response({ supplier, can_edit: true })
  })
})

function openDetail() {
  return render(<><TopBarPrimaryActionsSlot /><SupplierDetail siteId={siteId} id={id} /></>)
}

test('uses a compact identity header, unpadded sections and lead-sized persistent properties aside', async () => {
  openDetail()
  await screen.findByRole('heading', { name: supplier.name, level: 2 })
  const aside = screen.getByRole('complementary', { name: 'Supplier identity' })
  fireEvent.click(within(aside).getByText(supplier.name))
  const name = within(aside).getByLabelText('Supplier name')
  const heading = screen.getByRole('heading', { name: supplier.name, level: 2 })
  expect(heading).toHaveClass('text-xl', 'leading-tight', 'truncate')
  expect(heading).toHaveAttribute('title', supplier.name)
  expect(heading.closest('header')?.querySelector('.h-11.w-11')).toBeInTheDocument()
  const header = heading.closest('header')!
  expect(within(header).getByRole('link', { name: 'Email' })).toHaveAttribute('href', 'mailto:alex%40example.test')
  expect(within(header).getByRole('button', { name: 'Call' })).toBeDisabled()
  expect(within(header).getByRole('button', { name: 'WhatsApp' })).toBeDisabled()
  expect(within(header).queryByRole('button', { name: 'Back to suppliers' })).not.toBeInTheDocument()
  expect(within(document.getElementById('page-primary-actions')!).queryByRole('link', { name: 'Email' })).not.toBeInTheDocument()
  expect(aside).toHaveClass('lg:w-[340px]', 'xl:w-[380px]', 'lg:border-l', 'lg:pl-8')
  expect(aside.parentElement).toHaveClass('lg:flex-row', 'border-t')
  expect(aside.closest('.overflow-auto')).toHaveClass('!px-4', '!py-5', 'lg:!px-8')
  const toolbar = screen.getByLabelText('Supplier navigation and status')
  expect(toolbar).toHaveClass('flex-nowrap', 'items-center')
  expect(toolbar).not.toHaveClass('flex-wrap')
  expect(within(toolbar).getByRole('group', { name: 'Supplier status' })).toHaveClass('shrink-0', 'max-w-[55%]', 'overflow-x-auto')
  expect(within(toolbar).getByRole('tablist').parentElement).toHaveClass('min-w-0', 'flex-1')
  expect(within(aside).getByRole('heading', { name: 'Supplier identity' })).toHaveClass('text-xs', 'uppercase', 'tracking-wider')
  expect(name).toHaveClass('h-8', 'text-sm')
  expect(name.closest('.group')).toHaveClass('gap-2.5', 'min-h-8')
  expect(aside.querySelector('form')).toHaveClass('lg:sticky', 'lg:overflow-y-auto')
  expect(screen.getByText('Net 30', { selector: 'div[title]' }).closest('.rounded-none')).toHaveClass('border-0', 'bg-transparent')
  fireEvent.mouseDown(screen.getAllByRole('tab', { name: 'Contacts' })[0], { button: 0, ctrlKey: false })
  expect(within(aside).getByLabelText('Supplier name')).toBe(name)
  expect(screen.getByRole('heading', { name: 'Contacts' }).closest('.rounded-none')).toHaveClass('border-0', 'bg-transparent')
  expect(screen.getByRole('button', { name: 'Save changes' })).toHaveAttribute('form', 'supplier-edit-form')
})

test('keeps compact property changes in the versioned draft until explicit save', async () => {
  openDetail()
  await screen.findByRole('heading', { name: supplier.name, level: 2 })
  fireEvent.click(within(screen.getByRole('complementary')).getByText(supplier.name))
  fireEvent.change(screen.getByLabelText('Supplier name'), { target: { value: 'Renamed supplier' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save supplier name' }))
  fireEvent.click(screen.getByText('Workspace only', { selector: 'div[title]' }))
  fireEvent.change(screen.getByLabelText('Private workspace notes'), { target: { value: 'Revised notes' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save private workspace notes' }))
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  fireEvent.submit(document.getElementById('supplier-edit-form')!)
  await screen.findByText('Supplier saved.')
  const save = jest.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'PUT')!
  expect(save[0]).toBe(`/api/procurement/suppliers/${id}?site_id=${siteId}`)
  expect(JSON.parse(save[1]?.body as string)).toMatchObject({ name: 'Renamed supplier', private_notes: 'Revised notes', expected_version: 3, contacts: supplier.contacts })
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
})

test('retains read-only controls and hides mutations in compact detail', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ supplier, can_edit: false, options: [], has_more: false }))
  openDetail()
  await screen.findByRole('heading', { name: supplier.name, level: 2 })
  expect(within(screen.getByRole('complementary')).getByText(supplier.name)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Supplier name' })).not.toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Supplier status' })).toHaveAttribute('aria-disabled', 'true')
  expect(within(screen.getByRole('complementary')).queryByText('Workspace approval status')).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Net 30', { selector: 'div[title]' }))
  expect(screen.queryByRole('textbox', { name: 'Commercial terms' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Archive supplier' })).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getAllByRole('tab', { name: 'Contacts' })[0], { button: 0, ctrlKey: false })
  expect(screen.queryByRole('button', { name: 'Add contact' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit Alex Buyer' })).not.toBeInTheDocument()
})

test('shows real activity in the flat main section without removing the identity form', async () => {
  openDetail()
  await screen.findByRole('heading', { name: supplier.name, level: 2 })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/procurement/suppliers/${id}/activity?site_id=${siteId}`, expect.any(Object)))
  const heading = screen.getByRole('heading', { name: 'Activity' })
  expect(heading.closest('.rounded-none')).toHaveClass('border-0', 'bg-transparent')
  expect(within(screen.getByRole('complementary')).getByText(supplier.name)).toBeInTheDocument()
})