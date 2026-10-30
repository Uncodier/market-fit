import React from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { SuppliersWorkspace } from '@/app/suppliers/components/workspace'
import { ProcurementPage } from '@/app/purchases/procurement/components/procurement-page'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { demoProcurementPolicy, demoSuppliers } from '@/lib/demo-data/procurement-suppliers'
import { policyDocumentSchema } from '@/app/purchases/procurement/domain'
import { usePolicyDocument } from '@/app/purchases/procurement/components/use-policy-document'

let mockSite = { id: 'demo-saas-en-123', name: 'Demo workplace' }
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'demo-user' } }) }))

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver
})
beforeEach(() => {
  localStorage.clear()
  document.cookie = 'market_fit_demo_site_id=; Max-Age=0; path=/'
  mockSite = { id: 'demo-saas-en-123', name: 'Demo workplace' }
  global.fetch = jest.fn(() => { throw new Error('Demo must not fetch') })
  render(<TopBarPrimaryActionsSlot />)
})
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)) }) }

test('fixtures follow policy schema and use connected supplier IDs', () => {
  expect(policyDocumentSchema.safeParse(demoProcurementPolicy()).success).toBe(true)
  expect(demoSuppliers(mockSite.id).map(item => item.id)).toEqual(['demo-supplier-northstar', 'demo-supplier-summit', 'demo-supplier-cedar'])
  expect(demoProcurementPolicy().rules.filter(rule => rule.amount).every(rule => rule.amount?.currency === 'USD')).toBe(true)
})

test('demo directory supports search, status and board navigation without reads or writes', async () => {
  render(<SuppliersWorkspace />)
  expect(await screen.findByRole('link', { name: 'Northstar Technology' })).toHaveAttribute('href', '/suppliers/demo-supplier-northstar')
  expect(screen.getByRole('button', { name: 'Create supplier' })).toBeEnabled()
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Search suppliers' })[0], { target: { value: 'Cedar' } })
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Northstar Technology' })).not.toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'Cedar Services' })).toBeInTheDocument()
  fireEvent.change(screen.getAllByRole('textbox', { name: 'Search suppliers' })[0], { target: { value: '' } })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Under review' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(screen.queryByRole('link', { name: 'Northstar Technology' })).not.toBeInTheDocument())
  expect(await screen.findByRole('link', { name: 'Summit Solutions' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle kanban view' }))
  expect(screen.getByRole('region', { name: 'Under review' })).toBeInTheDocument()
  await settle()
  expect(fetch).not.toHaveBeenCalled()
})

test('all supplier tabs including nested references, representatives and activity stay local', async () => {
  render(<SuppliersWorkspace id="demo-supplier-cedar" />)
  await screen.findByRole('heading', { name: 'Cedar Services', level: 2 })
  expect(screen.queryByRole('textbox', { name: 'Supplier name' })).not.toBeInTheDocument()
  for (const name of ['Contacts', 'Representatives', 'Activity']) {
    fireEvent.mouseDown(screen.getAllByRole('tab', { name })[0], { button: 0, ctrlKey: false })
    await settle()
  }
  expect(screen.getByRole('link', { name: 'Awarded purchase order' })).toHaveAttribute('href', '/purchases/orders/demo-order-workplace')
  expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})

test('unknown demo supplier does not fall through to backend', async () => {
  render(<SuppliersWorkspace id="unknown" />)
  expect(await screen.findByText('This supplier is not available in the demo.')).toBeInTheDocument()
  await settle()
  expect(fetch).not.toHaveBeenCalled()
})

test.each(['directory', 'direct'])('demo creation from %s shows a safe prefilled preview without fetching or saving', async entry => {
  render(<SuppliersWorkspace id={entry === 'direct' ? 'new' : undefined} />)
  if (entry === 'directory') fireEvent.click(screen.getByRole('button', { name: 'Create supplier' }))
  const dialog = await screen.findByRole('dialog', { name: 'Create supplier' })
  await waitFor(() => expect(within(dialog).getByLabelText('Supplier name')).toHaveValue('Northstar Technology'))
  expect(within(dialog).getByLabelText('Supplier name')).toBeDisabled()
  expect(within(dialog).queryByText(/Creation preview only/)).not.toBeInTheDocument()
  expect(within(dialog).getByRole('button', { name: 'Create supplier' })).toBeDisabled()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  fireEvent.submit(within(dialog).getByLabelText('Supplier name').closest('form')!)
  await settle()
  expect(fetch).not.toHaveBeenCalled()
  if (entry === 'directory') {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  }
})

test('settings hydrate local portal and references; only explicit simulation is interactive', async () => {
  render(<ProcurementPage screen="settings" />)
  expect(await screen.findByLabelText('Workspace time zone')).toHaveValue('America/Chicago')
  expect(screen.getByLabelText('Workspace time zone')).toBeDisabled()
  expect(screen.getByRole('link', { name: 'Preview demo tenders' })).toBeInTheDocument()
  for (const button of screen.getAllByRole('button', { name: 'Save policy' })) expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Run simulation' }))
  expect(screen.getByText('Matched rules: Finance review above $5,000.')).toBeInTheDocument()
  await settle()
  expect(fetch).not.toHaveBeenCalled()
})

test('rules remain expandable while editing, archive and save are disabled', async () => {
  render(<ProcurementPage screen="rules" />)
  const toggle = await screen.findByRole('button', { name: /Edit Finance review above/ })
  expect(toggle).toBeEnabled()
  fireEvent.click(toggle)
  expect(screen.getByDisplayValue('IT specification sign-off')).toBeDisabled()
  expect(screen.getByDisplayValue('Budget and payment approval')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Edit Workplace technology evidence/ }))
  expect(screen.getByDisplayValue('Information security certification')).toBeDisabled()
  await settle()
  expect(fetch).not.toHaveBeenCalled()
})

test('a real workspace with a lingering demo cookie remains blocked', async () => {
  mockSite = { id: '11111111-1111-4111-8111-111111111111', name: 'Real' }
  document.cookie = 'market_fit_demo_site_id=demo-saas-en-123; path=/'
  render(<><SuppliersWorkspace /><ProcurementPage screen="settings" /></>)
  await settle()
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByLabelText('Workspace time zone')).not.toBeInTheDocument()
})

test('demo policy hook rejects programmatic edits and saves, including after reload', async () => {
  const { result } = renderHook(() => usePolicyDocument('demo-ecom-es-456'))
  await waitFor(() => expect(result.current.draft).not.toBeNull())
  await act(async () => {
    result.current.edit({ ...result.current.draft!, rules: [] })
    await result.current.save()
    await result.current.reload()
    await result.current.save('demo-rule-finance')
  })
  expect(result.current.draft?.rules).toHaveLength(4)
  expect(result.current.dirty).toBe(false)
  expect(fetch).not.toHaveBeenCalled()
})