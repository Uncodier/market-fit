import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { SupplierBoard } from '@/app/suppliers/components/supplier-board'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { sendTeamMemberIntervention } from '@/app/services/chat-send'
import { emptySupplier, type Supplier } from '@/app/suppliers/schema'

const mockSite = { id: '00000000-0000-4000-8000-000000000001', settings: { channels: { email: { enabled: true, status: 'connected' } } } }
jest.mock('@/app/context/SiteContext', () => ({ useOptionalSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/services/chat-send', () => ({ sendTeamMemberIntervention: jest.fn() }))

const supplier: Supplier = { ...emptySupplier, id: '00000000-0000-4000-8000-000000000002', site_id: mockSite.id,
  name: 'Acme Supply', version: 3, created_at: '2026-11-20', updated_at: '2026-11-20', contacts: [] }
const wrapper = ({ children }: { children: ReactNode }) => <SWRConfig value={{ provider: () => new Map() }}>
  <LocalizationProvider preferredLocale="en">{children}</LocalizationProvider>
</SWRConfig>

it('opens from the supplier card footer without navigating and sends to the saved primary contact', async () => {
  jest.mocked(fetch).mockClear().mockResolvedValue({ ok: true, json: async () => ({ supplier: { ...supplier, contacts: [
    { name: 'Alternate', email: 'alt@example.test', phone: '', role: '', is_primary: false },
    { name: 'Primary Contact', email: 'primary@example.test', phone: '', role: '', is_primary: true },
  ] } }) } as Response)
  jest.mocked(sendTeamMemberIntervention).mockResolvedValue({ success: true })
  render(<SupplierBoard suppliers={[supplier]} status="all" canMessage />, { wrapper })
  const options = screen.getByRole('button', { name: 'Options for Acme Supply' })
  expect(options.closest('[data-slot="supplier-card-footer"]')).not.toBeNull()
  expect(options.closest('a')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
  fireEvent.keyDown(options, { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: 'New Message' }))
  expect(await screen.findByText(/Primary Contact.*primary@example.test/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Purchase order' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sendTeamMemberIntervention).toHaveBeenCalledWith(undefined, 'Hello', undefined, undefined, expect.objectContaining({
    new_supplier_message: { supplier_id: supplier.id, channel: 'email', subject: 'Purchase order', version: 3 },
  }))
})

it('hides the menu on a read-only board', () => {
  render(<SupplierBoard suppliers={[supplier]} status="all" canMessage={false} />, { wrapper })
  expect(screen.queryByRole('button', { name: 'Options for Acme Supply' })).not.toBeInTheDocument()
})