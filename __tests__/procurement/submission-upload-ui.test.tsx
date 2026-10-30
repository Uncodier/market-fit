jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'account' } }) }))
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import { SubmissionForm } from '@/app/home/submissions/submission-form'
import SubmissionsPage from '@/app/home/submissions/page'
import type { Opportunity } from '@/app/home/submissions/types'

const row: Opportunity = { site_id: 'buyer', supplier_id: null, supplier_name: 'On behalf of myself', acting_as_self: true,
  tender_id: '00000001-1111-4111-8111-111111111111', publication_id: '00000002-1111-4111-8111-111111111111', version: 1, title: 'Open tender', description: '', currency: 'USD',
  participation_deadline: '2027-01-01T00:00:00Z', opening_at: '2027-01-02T00:00:00Z', opening_policy: 'after_deadline',
  requirements: [{ id: '00000007-1111-4111-8111-111111111111', description: 'Equipment', quantity: 2, unit: 'each' }] }
const mutate = jest.fn()
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
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => '00000003-1111-4111-8111-111111111111' })
  jest.mocked(useSWR).mockReturnValue({ data: { credentials: [] }, isLoading: false, mutate } as never)
})
test('publication deep link opens proposal editor without another action', async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams('publication=00000002-1111-4111-8111-111111111111') as never)
  jest.mocked(useSWR).mockImplementation(key => ({ data: Array.isArray(key) && key[0] === 'supplier-opportunities'
    ? { opportunities: [row] } : { credentials: [], submissions: [] }, mutate, isLoading: false }) as never)
  render(<SubmissionsPage />)
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Proposal PDF (optional, maximum 8 MiB)')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Upload certification' })).toBeInTheDocument()
})
test('selected PDF blocks submission until uploaded and attaches the returned private revision', async () => {
  const submitted = jest.fn()
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ revision_id: '00000004-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000006-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<SubmissionForm opportunity={row} onSubmitted={submitted} onCancel={jest.fn()} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Offer' } })
  fireEvent.change(screen.getByLabelText(/unit net price/i), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('Your legal name'), { target: { value: 'Independent bidder' } })
  fireEvent.change(screen.getByLabelText(/Proposal PDF/), { target: { files: [new File(['%PDF-document'], 'offer.pdf', { type: 'application/pdf' })] } })
  expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Upload proposal' }))
  await screen.findByRole('link', { name: 'View uploaded proposal' })
  const upload = mutations.mock.calls[0][1]?.body as FormData
  expect(JSON.parse(String(upload.get('metadata'))).metadata).toMatchObject({ holder_name: 'Independent bidder', type: 'tender_proposal' })
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
  await waitFor(() => expect(submitted).toHaveBeenCalled())
  expect(JSON.parse(String(mutations.mock.calls[2][1]?.body)).proposal_revision_id).toBe('00000004-1111-4111-8111-111111111111')
})
test('certification upload returns to the preserved proposal and automatically selects its revision', async () => {
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ revision_id: '00000005-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000006-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  const submitted = jest.fn()
  render(<SubmissionForm opportunity={row} onSubmitted={submitted} onCancel={jest.fn()} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Preserved offer' } })
  fireEvent.change(screen.getByLabelText(/unit net price/i), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload certification' }))
  fireEvent.change(screen.getByLabelText('Your legal name'), { target: { value: 'Bidder' } })
  fireEvent.change(screen.getByLabelText('Credential title'), { target: { value: 'License' } })
  fireEvent.change(screen.getByLabelText('Issuer'), { target: { value: 'Board' } })
  fireEvent.change(screen.getByLabelText(/Private file/), { target: { files: [new File(['%PDF-license'], 'license.pdf', { type: 'application/pdf' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Save revision' }))
  await waitFor(() => expect(screen.getByLabelText('Your quotation reference')).toHaveValue('Preserved offer'))
  expect(mutate).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
  await waitFor(() => expect(submitted).toHaveBeenCalled())
  expect(JSON.parse(String(mutations.mock.calls[2][1]?.body)).evidence).toEqual([{ requirement_id: '00000007-1111-4111-8111-111111111111', revision_id: '00000005-1111-4111-8111-111111111111' }])
})