jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProcurementTab } from '@/app/catalog/procurement/ProcurementTab'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

const siteId = '00000000-0000-4000-8000-000000000001', itemId = '00000000-0000-4000-8000-000000000070'
const data = { item: { id: itemId, name: 'Stock', status: 'active', procurement_enabled: false }, offers: [], suppliers: [], total: 0, can_edit: true, can_add_offer: true }
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn(); render(<TopBarPrimaryActionsSlot />) })

it('requires a persisted item rather than inventing a procurement record', () => {
  render(<ProcurementTab siteId={siteId} />)
  expect(screen.getByText(/Save the catalog item/)).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})
it('explains supported scope and links to real request and tender creation', async () => {
  jest.mocked(fetch).mockResolvedValue(response(data))
  render(<ProcurementTab siteId={siteId} itemId={itemId} />)
  expect(await screen.findByText(/Procurement-only items and sales disabling are not available yet/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Create purchase request' })).toHaveAttribute('href', '/purchases/requests/new')
  expect(screen.getByRole('link', { name: 'Create tender' })).toHaveAttribute('href', '/purchases/tenders/new')
  expect(screen.queryByText('Record supplier offer')).not.toBeInTheDocument()
})
it('does not expose mutations for read-only users', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ ...data, can_edit: false, can_add_offer: false }))
  render(<ProcurementTab siteId={siteId} itemId={itemId} />)
  expect(await screen.findByRole('switch')).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Save dated offer' })).not.toBeInTheDocument()
})
it('saves the capability independently without changing sale flags', async () => {
  jest.mocked(fetch).mockResolvedValue(response(data))
  render(<ProcurementTab siteId={siteId} itemId={itemId} />)
  fireEvent.click(await screen.findByRole('switch'))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/catalog/${itemId}`), expect.objectContaining({ method: 'PATCH' })))
  const call = jest.mocked(fetch).mock.calls.find(([, options]) => options?.method === 'PATCH')
  expect(JSON.parse(call?.[1]?.body as string)).toEqual({ procurement_enabled: true, expected_enabled: false })
})
it('shows access errors instead of a fake empty sourcing list', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ error: 'Forbidden' }, 403))
  render(<ProcurementTab siteId={siteId} itemId={itemId} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  expect(screen.queryByText('No supplier offers recorded.')).not.toBeInTheDocument()
})

it('adds sourcing relations in a dialog with shared date controls and preserves draft edits', async () => {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/suppliers?')
    ? response({ suppliers: [], total: 0 }) : response({ ...data, item: { ...data.item, procurement_enabled: true } }))
  render(<ProcurementTab siteId={siteId} itemId={itemId} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Add supplier offer' }))
  const unit = screen.getByLabelText('Purchase unit (for example, box)')
  fireEvent.change(unit, { target: { value: 'Case' } })
  expect(screen.getByRole('dialog').querySelector('select, input[type="date"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  fireEvent.click(screen.getByRole('button', { name: 'Add supplier offer' }))
  expect(screen.getByLabelText('Purchase unit (for example, box)')).toHaveValue('Case')
})