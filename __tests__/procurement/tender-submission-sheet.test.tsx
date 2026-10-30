jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: jest.fn() }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/tenders/public-header', () => ({ TenderHeader: () => <header />, TenderFooter: () => <footer /> }))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { TenderSubmissionEntry } from '@/app/tenders/submission-entry'
import { TenderDetailView } from '@/app/tenders/detail-view'
import type { PublicTenderRow } from '@/app/tenders/public-data'

const row = { site_id: 'buyer', supplier_id: null, supplier_name: 'Self', acting_as_self: true,
  tender_id: 'tender', publication_id: 'publication', version: 1, title: 'Tender', description: 'Published details', currency: 'USD',
  participation_deadline: '2027-01-01T00:00:00Z', opening_at: '2027-01-02T00:00:00Z', opening_policy: 'after_deadline',
  requirements: [{ id: 'line', description: 'Equipment', quantity: 2, unit: 'each' }] }
const props = { publicationId: 'publication', open: true, onClose: jest.fn(), returnTo: '/tenders/buyer/tender?submit=1' }
const mutations = jest.fn()
function mockDraftEndpoint() {
  const drafts = new Map<string, { draft: unknown; draft_revision: number }>()
  jest.mocked(fetch).mockImplementation(async (url, options) => {
    if (!String(url).startsWith('/api/procurement/credentials/drafts')) return mutations(url, options)
    const selector = options?.body ? JSON.parse(String(options.body)) : Object.fromEntries(new URL(String(url), 'http://localhost').searchParams)
    const key = `${selector.publication_id}:${selector.version}:${selector.applicant_key}`
    if (options?.method === 'PUT') drafts.set(key, { draft: selector.draft, draft_revision: (drafts.get(key)?.draft_revision ?? 0) + 1 })
    if (options?.method === 'DELETE') drafts.delete(key)
    return { ok: true, json: async () => drafts.get(key) ?? { draft: null, draft_revision: null } } as Response
  })
}
beforeEach(() => {
  jest.clearAllMocks()
  mutations.mockReset()
  mockDraftEndpoint()
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => 'retry-key' })
  jest.mocked(useAuthContext).mockReturnValue({ user: { id: 'account' } } as never)
  jest.mocked(useSWR).mockReturnValue({ data: { opportunities: [row], credentials: [] }, isLoading: false, mutate: jest.fn() } as never)
})
test('checkout sheet shows published details and net total while preserving a closed draft', async () => {
  const view = render(<TenderSubmissionEntry {...props} />)
  expect(screen.getByRole('dialog')).toHaveAttribute('data-submission-checkout')
  expect(screen.getByRole('dialog')).toHaveClass('w-full', 'h-dvh', 'sm:max-w-[720px]')
  expect(screen.getByRole('dialog')).toHaveClass('bg-gray-50')
  expect(screen.getByRole('dialog')).not.toHaveClass('bg-gray-50/30')
  const overlay = document.querySelector('[data-backdrop-blur="false"]')
  expect(overlay).toBeInTheDocument()
  expect(overlay?.className).not.toContain('backdrop-blur')
  expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toHaveClass('!h-12', 'min-h-12', '!py-0')
  expect(screen.getByText('Published details')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Draft offer' } })
  fireEvent.change(screen.getByLabelText(/Unit net price/), { target: { value: '150' } })
  expect(screen.getByText('$3.00')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  expect(props.onClose).toHaveBeenCalled()
  view.rerender(<TenderSubmissionEntry {...props} open={false} />)
  view.rerender(<TenderSubmissionEntry {...props} />)
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('Draft offer')
})
test('guest signs in with a return URL to the same tender', () => {
  jest.mocked(useAuthContext).mockReturnValue({ user: null } as never)
  render(<TenderSubmissionEntry {...props} />)
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/auth?returnTo=${encodeURIComponent(props.returnTo)}`)
  expect(screen.queryByLabelText('Your quotation reference')).not.toBeInTheDocument()
})

test('save draft footer action restores entered fields after a new mount', async () => {
  const view = render(<TenderSubmissionEntry {...props} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Saved proposal' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Draft saved to your account.'))
  expect(toast.success).toHaveBeenCalledWith('Draft saved to your account.')
  expect(props.onClose).toHaveBeenCalledTimes(1)
  view.rerender(<TenderSubmissionEntry {...props} open={false} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(toast.error).not.toHaveBeenCalled()
  view.unmount()
  render(<TenderSubmissionEntry {...props} />)
  await waitFor(() => expect(screen.getByLabelText('Your quotation reference')).toHaveValue('Saved proposal'))
})
test('account change clears private draft state', async () => {
  const view = render(<TenderSubmissionEntry {...props} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Private offer' } })
  jest.mocked(useAuthContext).mockReturnValue({ user: { id: 'other' } } as never)
  view.rerender(<TenderSubmissionEntry {...props} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('')
})
test('ineligible and failed reads do not fabricate a submission form', () => {
  jest.mocked(useSWR).mockReturnValue({ data: { opportunities: [] }, isLoading: false, mutate: jest.fn() } as never)
  const view = render(<TenderSubmissionEntry {...props} />)
  expect(screen.getByRole('alert')).toHaveTextContent('not available for your account')
  expect(screen.queryByLabelText('Your quotation reference')).not.toBeInTheDocument()
  jest.mocked(useSWR).mockReturnValue({ error: new Error('Unavailable'), isLoading: false, mutate: jest.fn() } as never)
  view.rerender(<TenderSubmissionEntry {...props} />)
  expect(screen.getByRole('alert')).toHaveTextContent('Unavailable')
})

test('inline dropdown switches accounts immediately and retains separate drafts', async () => {
  const business = { ...row, acting_as_self: false, acting_site_id: 'business-one', supplier_name: 'Business One' }
  const other = { ...business, acting_site_id: 'business-two', supplier_name: 'Business Two' }
  jest.mocked(useSWR).mockReturnValue({ data: { opportunities: [business, row, other], credentials: [] }, isLoading: false, mutate: jest.fn() } as never)
  render(<TenderSubmissionEntry {...props} />)
  const label = 'Who are you applying on behalf of?'
  expect(screen.getByRole('combobox', { name: label })).toHaveTextContent('Personal account')
  expect(screen.getByLabelText('Your quotation reference')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Continue with this account' })).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Personal draft' } })
  async function choose(name: string) {
    await waitFor(() => expect(screen.getByRole('combobox', { name: label })).toBeEnabled())
    fireEvent.keyDown(screen.getByRole('combobox', { name: label }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  }
  await choose('Business One')
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Business One draft' } })
  await choose('Business Two')
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('')
  await choose('Business One')
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('Business One draft')
  await choose('Personal account')
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('Personal draft')
})

test('failed save shows error toast and keeps the draft form open', async () => {
  render(<TenderSubmissionEntry {...props} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Unable to save the draft.'))
  expect(toast.success).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(props.onClose).not.toHaveBeenCalled()
})

async function fillProposal() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Offer' } })
  fireEvent.change(screen.getByLabelText(/Unit net price/), { target: { value: '150' } })
}

test('confirmed submission shows progress, success and replacement CTA without waiting for draft cleanup', async () => {
  const submitted = jest.fn()
  let resolveSubmission!: (value: Response) => void
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: 'supplier' }) } as Response)
    .mockImplementationOnce(() => new Promise(resolve => { resolveSubmission = resolve }))
  const draftFetch = jest.mocked(fetch).getMockImplementation()!
  jest.mocked(fetch).mockImplementation((url, options) => options?.method === 'DELETE'
    ? new Promise<Response>(() => {}) : draftFetch(url, options))
  render(<TenderSubmissionEntry {...props} onSubmitted={submitted} />)
  await fillProposal()
  const button = screen.getByRole('button', { name: 'Submit immutable quotation' })
  expect(button).toHaveAttribute('type', 'submit')
  fireEvent.submit(button.closest('form')!)
  await waitFor(() => expect(mutations).toHaveBeenCalledTimes(2))
  expect(screen.getByRole('button', { name: 'Submitting…' })).toBeDisabled()
  expect(toast.success).not.toHaveBeenCalled()
  await act(async () => resolveSubmission({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response))
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
  expect(toast.success).toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('submitted')
  expect(screen.getByRole('link', { name: 'My submissions' })).toHaveAttribute('href', '/home/submissions')
  expect(screen.queryByRole('button', { name: 'Submit immutable quotation' })).not.toBeInTheDocument()
})

test.each(['failed', 'unconfirmed'])('%s submission reports an error and keeps retry available', async kind => {
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: 'supplier' }) } as Response)
    .mockResolvedValueOnce({ ok: kind === 'unconfirmed', json: async () => ({ error: 'Submission failed' }) } as Response)
  const submitted = jest.fn()
  render(<TenderSubmissionEntry {...props} onSubmitted={submitted} />)
  await fillProposal()
  fireEvent.submit(screen.getByRole('button', { name: 'Submit immutable quotation' }).closest('form')!)
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(toast.success).not.toHaveBeenCalled()
  expect(submitted).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeEnabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Submission failed')
})

test('invalid required fields announce the browser validation error', async () => {
  render(<TenderSubmissionEntry {...props} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.invalid(screen.getByLabelText('Your quotation reference'))
  expect(toast.error).toHaveBeenCalled()
  expect(mutations).not.toHaveBeenCalled()
})

test('public detail replaces desktop and mobile submit actions after confirmation', async () => {
  const tender = { publication_id: row.publication_id, version: 1, snapshot: { ...row, participation: 'open' } } as unknown as PublicTenderRow
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: 'supplier' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<TenderDetailView tender={tender} siteSlug="buyer" tenderSlug="tender" closed={false} />)
  fireEvent.click(screen.getAllByRole('button', { name: 'Submit proposal' })[0])
  await fillProposal()
  fireEvent.submit(screen.getByRole('button', { name: 'Submit immutable quotation' }).closest('form')!)
  await waitFor(() => expect(screen.getByRole('link', { name: 'My submissions' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Close and keep draft' }))
  expect(screen.queryByRole('button', { name: 'Submit proposal' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'My submissions' })).toHaveLength(2)
})
