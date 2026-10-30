jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'account' } }) }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import SubmissionsPage from '@/app/home/submissions/page'
import { toast } from 'sonner'
import type { Opportunity, SavedDraft } from '@/app/home/submissions/types'

const personal: Opportunity = { site_id: 'buyer', supplier_id: null, supplier_name: 'Self', acting_as_self: true,
  tender_id: 'tender', publication_id: 'publication', version: 1, title: 'Public open tender', description: '', currency: 'USD',
  visibility: 'public', participation: 'open', participation_deadline: '2027-01-01T00:00:00Z',
  opening_at: '2027-01-02T00:00:00Z', opening_policy: 'after_deadline',
  requirements: [{ id: 'line', description: 'Equipment', quantity: 2, unit: 'each' }] }
const business = { ...personal, acting_as_self: false, acting_site_id: 'business', supplier_name: 'Business One' }
const mutateDrafts = jest.fn()
function opportunities(rows: Opportunity[], drafts: SavedDraft[] = []) {
  jest.mocked(useSWR).mockImplementation(key => ({ data: Array.isArray(key) && key[0] === 'supplier-opportunities'
    ? { opportunities: rows } : Array.isArray(key) && key[0] === 'supplier-drafts' ? { drafts } : { credentials: [], submissions: [] },
    isLoading: false, mutate: Array.isArray(key) && key[0] === 'supplier-drafts' ? mutateDrafts : jest.fn() }) as never)
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never)
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => 'receipt' })
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ draft: null, draft_revision: null }) } as Response)
})
function selectDrafts() {
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Drafts' }), { button: 0, ctrlKey: false })
}

test('submitted free-text quotations show net and pending taxes, not zero taxes or a final total', () => {
  jest.mocked(useSWR).mockImplementation(key => ({ data: Array.isArray(key) && key[0] === 'supplier-submissions'
    ? { submissions: [{ id: 'receipt', reference: 'FREE-TEXT', tender_title: 'Custom service', currency: 'USD',
      net_amount_minor: 1234, tax_amount_minor: null, submitted_at: '2026-10-29T00:00:00Z' }] }
    : { opportunities: [], drafts: [] }, isLoading: false, mutate: jest.fn() }) as never)
  render(<SubmissionsPage />)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Submitted quotations' }), { button: 0, ctrlKey: false })
  expect(screen.getByText('FREE-TEXT')).toBeInTheDocument()
  expect(screen.getByText(/Taxes pending/)).toHaveTextContent('$12.34')
  expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument()
})

test('general activity lists only explicitly directly invited entries, including public open invitations', () => {
  const invited = { ...business, directly_invited: true, title: 'Direct open invitation' }
  const closed = { ...business, directly_invited: true, publication_id: 'closed', title: 'Closed invitation', participation: 'invitation_only', visibility: 'private', supplier_id: 'invited' }
  opportunities([personal, { ...business, directly_invited: false }, invited, closed,
    { ...business, publication_id: 'approved', title: 'Approved but not invited', participation: 'approved_suppliers' },
    { ...closed, publication_id: 'implicit', title: 'Private but not directly invited', directly_invited: undefined }])
  render(<SubmissionsPage />)
  expect(screen.getByRole('tab', { name: 'Direct invitations' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('Direct open invitation')).toBeInTheDocument()
  expect(screen.getByText('Closed invitation')).toBeInTheDocument()
  expect(screen.queryByText('Public open tender')).not.toBeInTheDocument()
  expect(screen.queryByText('Approved but not invited')).not.toBeInTheDocument()
  expect(screen.queryByText('Private but not directly invited')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Public opportunities' })).not.toBeInTheDocument()
  expect(screen.queryByText('account', { selector: 'code' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Prepare quotation' })).toHaveLength(2)
  expect(screen.getByRole('link', { name: 'Manage private credentials' }).closest('.bg-transparent')).toHaveClass('bg-transparent')
})

test('public direct publication link still opens personal form and offers authorized business applicant', async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams('publication=publication') as never)
  opportunities([business, personal, { ...business }])
  render(<SubmissionsPage />)
  const pickerName = 'Who are you applying on behalf of?'
  await waitFor(() => expect(screen.getByRole('combobox', { name: pickerName })).toBeEnabled())
  expect(screen.getByRole('combobox', { name: pickerName })).toHaveTextContent('Personal account')
  fireEvent.keyDown(screen.getByRole('combobox', { name: pickerName }), { key: 'Enter' })
  expect(screen.getAllByRole('option', { name: 'Business One' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('option', { name: 'Business One' }))
  await waitFor(() => expect(screen.getByRole('combobox', { name: pickerName })).toBeEnabled())
  expect(screen.getByRole('combobox', { name: pickerName })).toHaveTextContent('Business One')
  const params = jest.mocked(fetch).mock.calls.map(([url]) => new URL(String(url), 'http://localhost').searchParams.get('applicant_key'))
  expect(params).toEqual(['personal', 'business:business'])
})

const saved: SavedDraft = { publication_id: 'publication', publication_version: 1, applicant_key: 'personal',
  updated_at: '2026-10-29T10:00:00Z', draft_revision: 2, reference: 'Saved quotation', attempted: false, opportunity: personal, can_resume: true }

test('draft tab loads persisted rows separately and resumes a public draft without an invitation', async () => {
  opportunities([], [saved, { ...saved, publication_id: 'pending', reference: 'Pending quotation', attempted: true },
    { ...saved, publication_id: 'expired', reference: 'Expired quotation', opportunity: null, can_resume: false }])
  render(<SubmissionsPage />)
  expect(screen.queryByText('Saved quotation')).not.toBeInTheDocument()
  selectDrafts()
  expect(screen.getByText('Saved quotation')).toBeInTheDocument()
  expect(screen.getByText('Pending submission confirmation')).toBeInTheDocument()
  expect(screen.getByText('This publication is no longer available for editing.')).toBeInTheDocument()
  for (const label of ['Reference', 'Last saved', 'Status']) expect(screen.getByRole('columnheader', { name: label })).toBeInTheDocument()
  const row = within(screen.getByText('Saved quotation').closest('tr')!)
  expect(row.getByText('Draft')).toBeInTheDocument()
  fireEvent.click(row.getByRole('button', { name: 'Resume draft' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls[0][0]).toContain('publication_id=publication')
  expect(jest.mocked(fetch).mock.calls[0][0]).toContain('applicant_key=personal')
  const call = jest.mocked(useSWR).mock.calls.find(([key]) => Array.isArray(key) && key[0] === 'supplier-drafts')!
  expect(call[0]).toEqual(['supplier-drafts', 'account'])
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ drafts: [saved] }) } as Response)
  await expect((call[1] as () => Promise<unknown>)()).resolves.toEqual({ drafts: [saved] })
  expect(fetch).toHaveBeenLastCalledWith('/api/procurement/credentials/drafts/list', { cache: 'no-store' })
})

test('empty saved drafts have their own empty state', () => {
  opportunities([])
  render(<SubmissionsPage />)
  selectDrafts()
  expect(screen.getByText('No saved quotation drafts.')).toBeInTheDocument()
})

test('saving switches to drafts, closes form, refreshes persisted rows and leaves visible confirmation', async () => {
  const invited = { ...personal, directly_invited: true }
  opportunities([invited])
  render(<SubmissionsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare quotation' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Incomplete draft' } })
  jest.mocked(fetch).mockImplementationOnce(async (_url, options) => ({ ok: true, json: async () => ({ draft: JSON.parse(String(options?.body)).draft, draft_revision: 1 }) }) as Response)
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(mutateDrafts).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Drafts' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('Draft saved to your account.')
  expect(toast.success).toHaveBeenCalledWith('Draft saved to your account.')
})

test('confirmed send closes the account panel and selects sent quotations', async () => {
  opportunities([{ ...personal, directly_invited: true }])
  render(<SubmissionsPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Prepare quotation' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Offer' } })
  fireEvent.change(screen.getByLabelText(/Unit net price/), { target: { value: '150' } })
  jest.mocked(fetch).mockImplementation(async (url, options) => {
    if (options?.method === 'PUT') return { ok: true, json: async () => ({ draft: JSON.parse(String(options.body)).draft, draft_revision: 1 }) } as Response
    if (String(url).endsWith('/register')) return { ok: true, json: async () => ({ supplier_id: 'supplier' }) } as Response
    return { ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response
  })
  fireEvent.submit(screen.getByRole('button', { name: 'Submit immutable quotation' }).closest('form')!)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('tab', { name: 'Submitted quotations' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('submitted')
  expect(toast.success).toHaveBeenCalled()
  expect(mutateDrafts).toHaveBeenCalled()
})
