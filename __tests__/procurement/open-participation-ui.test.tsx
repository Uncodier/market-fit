jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'account' } }) }))
jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import useSWR from 'swr'
import { SubmissionForm } from '@/app/home/submissions/submission-form'
import SubmissionsPage from '@/app/home/submissions/page'
import type { Draft } from '@/app/home/submissions/draft-schema'
import type { Opportunity } from '@/app/home/submissions/types'

const opportunity: Opportunity = {
  site_id: 'buyer', supplier_id: null, supplier_name: 'On behalf of myself', acting_as_self: true,
  tender_id: '00000001-1111-4111-8111-111111111111', publication_id: '00000002-1111-4111-8111-111111111111', version: 1, title: 'Open tender', description: '', currency: 'USD',
  participation_deadline: '2027-01-01T00:00:00Z', opening_at: '2027-01-02T00:00:00Z', opening_policy: 'after_deadline',
  visibility: 'public', participation: 'open',
  requirements: [{ id: 'line', description: 'Equipment', quantity: 2, unit: 'each' }],
}
const mutations = jest.fn()

test.each([
  ['overlength reference', { reference: 'x'.repeat(200) }],
  ['whitespace reference', { reference: '   ' }],
  ['malformed proposal', { proposalRevision: 'not-a-uuid' }],
  ['malformed evidence revision', { evidence: { '11111111-1111-4111-8111-111111111111': 'invalid' } }],
  ['malformed evidence requirement', { evidence: { invalid: '11111111-1111-4111-8111-111111111111' } }],
  ['malformed retry key', { key: 'invalid' }],
  ['malformed supplier', { registeredSupplier: 'invalid' }],
] as const)('preflight rejects %s without recording an attempt or registering', async (_name, invalid) => {
  const restored = { reference: 'Offer', prices: { line: '100' }, evidence: {},
    key: '11111111-1111-4111-8111-111111111111', attempted: false,
    registeredSupplier: null, proposalRevision: '', holderName: '', ...invalid }
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ draft: restored, draft_revision: 1 }) } as Response)
  render(<SubmissionForm opportunity={opportunity} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  const reference = screen.getByLabelText('Your quotation reference')
  await waitFor(() => expect(reference).toHaveValue(restored.reference))
  expect(reference).toHaveAttribute('maxlength', '120')
  fireEvent.submit(reference.closest('form')!)
  expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
  expect(reference).toBeEnabled()
  // recordAttempt persists via PUT: the only request must remain the initial read.
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(mutations).not.toHaveBeenCalled()
})

test.each(['x'.repeat(200), '   '])('an invalid restored reference remains correctable before the first attempt: %s', async reference => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ draft: {
    reference, prices: { line: '100' }, evidence: {}, key: '11111111-1111-4111-8111-111111111111',
    attempted: false, registeredSupplier: null, proposalRevision: '', holderName: '',
  }, draft_revision: null }) } as Response)
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '11111111-1111-4111-8111-111111111112' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  const submitted = jest.fn()
  render(<SubmissionForm opportunity={opportunity} onSubmitted={submitted} onCancel={jest.fn()} />)
  const input = screen.getByLabelText('Your quotation reference')
  await waitFor(() => expect(input).toHaveValue(reference))
  fireEvent.submit(input.closest('form')!)
  await screen.findByRole('alert')
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.change(input, { target: { value: `  ${'x'.repeat(120)}  ` } })
  fireEvent.submit(input.closest('form')!)
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
  expect(JSON.parse(mutations.mock.calls[1][1].body).reference).toBe('x'.repeat(120))
})

test.each(['tender_id', 'publication_id'] as const)('invalid %s fails before registration and recording the attempt', async field => {
  render(<SubmissionForm opportunity={{ ...opportunity, [field]: 'invalid' }} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await screen.findByRole('alert')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(mutations).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Your quotation reference')).toBeEnabled()
})

test('invalid registration response cannot record an immutable attempt', async () => {
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: 'invalid' }) } as Response)
  render(<SubmissionForm opportunity={opportunity} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await screen.findByRole('alert')
  expect(jest.mocked(fetch).mock.calls.map(([, options]) => options?.method ?? 'GET')).toEqual(['GET', 'POST'])
  expect(screen.getByLabelText('Your quotation reference')).toBeEnabled()
})

test('an empty requirement payload is rejected before any mutation', async () => {
  render(<SubmissionForm opportunity={{ ...opportunity, requirements: [] }} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  const reference = screen.getByLabelText('Your quotation reference')
  await waitFor(() => expect(reference).toBeEnabled())
  fireEvent.change(reference, { target: { value: 'Offer' } })
  fireEvent.submit(reference.closest('form')!)
  await screen.findByRole('alert')
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(mutations).not.toHaveBeenCalled()
})

test('preflight failure never unlocks an already attempted legacy draft', async () => {
  const reference = 'x'.repeat(200)
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ draft: {
    reference, prices: { line: '100' }, evidence: {}, key: '11111111-1111-4111-8111-111111111111',
    attempted: true, registeredSupplier: '11111111-1111-4111-8111-111111111112', proposalRevision: '', holderName: '',
  }, draft_revision: 1 }) } as Response)
  render(<SubmissionForm opportunity={opportunity} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  const input = screen.getByLabelText('Your quotation reference')
  await waitFor(() => expect(input).toHaveValue(reference))
  fireEvent.submit(input.closest('form')!)
  await screen.findByRole('alert')
  expect(input).toBeDisabled()
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.change(input, { target: { value: 'Changed' } })
  expect(input).toHaveValue(reference)
})
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
  jest.mocked(useSWR).mockReturnValue({ data: { credentials: [] }, isLoading: false } as never)
})
async function fillAndSubmit() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'My offer' } })
  fireEvent.change(screen.getByLabelText(/unit net price/i), { target: { value: '100' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
}
test('does not list public opportunities without a direct invitation', () => {
  jest.mocked(useSWR).mockImplementation(key => ({ data: Array.isArray(key) && key[0] === 'supplier-opportunities'
    ? { opportunities: [opportunity] } : { submissions: [] }, isLoading: false, mutate: jest.fn() }) as never)
  render(<SubmissionsPage />)
  expect(screen.queryByText('Open tender')).not.toBeInTheDocument()
  expect(screen.queryByText(/without prior buyer registration/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Prepare quotation' })).not.toBeInTheDocument()
})
test.each([null, '00000004-1111-4111-8111-111111111111'])('registers self participation for each publication even with cached supplier ID %s', async supplierId => {
  const submitted = jest.fn()
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000005-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<SubmissionForm opportunity={{ ...opportunity, supplier_id: supplierId }} onSubmitted={submitted} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
  expect(mutations).toHaveBeenNthCalledWith(1, '/api/procurement/credentials/participation/register', expect.objectContaining({
    body: JSON.stringify({ publication_id: '00000002-1111-4111-8111-111111111111' }),
  }))
  expect(JSON.parse(String(mutations.mock.calls[1][1]?.body))).toMatchObject({ supplier_id: '00000005-1111-4111-8111-111111111111', publication_id: '00000002-1111-4111-8111-111111111111' })
  const calls = jest.mocked(fetch).mock.calls
  expect(calls.map(([, options]) => options?.method ?? 'GET')).toEqual(['GET', 'POST', 'PUT', 'POST', 'DELETE'])
  expect(JSON.parse(String(calls[2][1]?.body))).toMatchObject({ expected_revision: null,
    draft: { attempted: true, registeredSupplier: '00000005-1111-4111-8111-111111111111', key: '00000003-1111-4111-8111-111111111111', reference: 'My offer', prices: { line: '100' } } })
  expect(String(calls[4][0])).toContain('expected_revision=1')
})
test('does not self-register an authorized representative', async () => {
  const submitted = jest.fn()
  mutations.mockResolvedValue({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<SubmissionForm opportunity={{ ...opportunity, supplier_id: '00000006-1111-4111-8111-111111111111', acting_as_self: false }} onSubmitted={submitted} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await waitFor(() => expect(submitted).toHaveBeenCalled())
  expect(mutations).toHaveBeenCalledTimes(1)
  expect(JSON.parse(String(mutations.mock.calls[0][1]?.body)).supplier_id).toBe('00000006-1111-4111-8111-111111111111')
})

test('business applicant uses its selected workspace registration, never the personal path', async () => {
  const submitted = jest.fn()
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000007-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<SubmissionForm opportunity={{ ...opportunity, acting_as_self: false, acting_site_id: 'my-business', supplier_name: 'My business' }} onSubmitted={submitted} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
  expect(JSON.parse(String(mutations.mock.calls[0][1]?.body))).toEqual({ publication_id: '00000002-1111-4111-8111-111111111111', acting_site_id: 'my-business' })
  expect(JSON.parse(String(mutations.mock.calls[1][1]?.body)).supplier_id).toBe('00000007-1111-4111-8111-111111111111')
})
test('registration failure cannot submit a quotation and an ambiguous quote retry keeps identity and payload', async () => {
  const submitted = jest.fn()
  mutations.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Registration unavailable' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000005-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Not confirmed' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<SubmissionForm opportunity={opportunity} onSubmitted={submitted} onCancel={jest.fn()} />)
  await fillAndSubmit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Registration unavailable')
  expect(mutations).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Not confirmed')
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
  const calls = mutations.mock.calls
  expect(calls[2][1]?.body).toBe(calls[3][1]?.body)
  expect(calls.filter(([url]) => String(url).endsWith('/register'))).toHaveLength(2)
})

test('load failure disables edits, save and submit until the reload button succeeds', async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
  render(<SubmissionForm opportunity={opportunity} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Unable to restore/))
  expect(screen.getByLabelText('Your quotation reference')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeDisabled()
  expect(mutations).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh opportunities' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled())
})

test('awaits persisted attempted receipt after registration before sending the quotation', async () => {
  const submitted = jest.fn()
  let resolveSave!: (response: Response) => void
  let savedBody: { draft: Draft } | undefined
  const endpointFetch = jest.mocked(fetch).getMockImplementation()!
  jest.mocked(fetch).mockImplementation((url, options) => {
    if (options?.method === 'PUT') {
      savedBody = JSON.parse(String(options.body))
      return new Promise(resolve => { resolveSave = resolve })
    }
    return endpointFetch(url, options)
  })
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000008-1111-4111-8111-111111111111' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  render(<SubmissionForm opportunity={opportunity} onSubmitted={submitted} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await waitFor(() => expect(savedBody?.draft.attempted).toBe(true))
  expect(savedBody!.draft).toMatchObject({ registeredSupplier: '00000008-1111-4111-8111-111111111111', key: '00000003-1111-4111-8111-111111111111', reference: 'My offer', prices: { line: '100' } })
  expect(mutations).toHaveBeenCalledTimes(1)
  expect(submitted).not.toHaveBeenCalled()
  await act(async () => { resolveSave({ ok: true, json: async () => ({ draft: savedBody!.draft, draft_revision: 1 }) } as Response) })
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
})

test('attempt-save conflict prevents quotation POST and requires reload before submit', async () => {
  const endpointFetch = jest.mocked(fetch).getMockImplementation()!
  jest.mocked(fetch).mockImplementation((url, options) => options?.method === 'PUT'
    ? Promise.resolve({ ok: false, status: 409, json: async () => ({ error: 'Draft changed' }) } as Response)
    : endpointFetch(url, options))
  mutations.mockResolvedValue({ ok: true, json: async () => ({ supplier_id: '00000008-1111-4111-8111-111111111111' }) } as Response)
  render(<SubmissionForm opportunity={opportunity} onSubmitted={jest.fn()} onCancel={jest.fn()} />)
  await fillAndSubmit()
  await screen.findByRole('alert')
  expect(mutations).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
  expect(mutations).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Refresh opportunities' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeEnabled())
})

test('ambiguous submission survives remount and retries identical immutable payload without registering again', async () => {
  const submitted = jest.fn()
  mutations.mockResolvedValueOnce({ ok: true, json: async () => ({ supplier_id: '00000008-1111-4111-8111-111111111111' }) } as Response)
    .mockRejectedValueOnce(new Error('Connection lost'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { quotation_id: 'quote' } }) } as Response)
  const view = render(<SubmissionForm opportunity={opportunity} onSubmitted={submitted} onCancel={jest.fn()} />)
  await fillAndSubmit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
  expect(screen.getByLabelText('Your quotation reference')).toBeDisabled()
  expect(jest.mocked(fetch).mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
  const original = mutations.mock.calls[1][1].body
  view.unmount()
  render(<SubmissionForm opportunity={opportunity} onSubmitted={submitted} onCancel={jest.fn()} />)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Submit immutable quotation' })).toBeEnabled())
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('My offer')
  fireEvent.change(screen.getByLabelText('Your quotation reference'), { target: { value: 'Tampered' } })
  expect(screen.getByLabelText('Your quotation reference')).toHaveValue('My offer')
  fireEvent.click(screen.getByRole('button', { name: 'Submit immutable quotation' }))
  await waitFor(() => expect(submitted).toHaveBeenCalledTimes(1))
  expect(mutations.mock.calls[2][1].body).toBe(original)
  expect(mutations.mock.calls.filter(([url]) => String(url).endsWith('/register'))).toHaveLength(1)
})
