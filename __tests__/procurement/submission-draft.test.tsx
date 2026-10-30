import { act, renderHook, waitFor } from '@testing-library/react'
import { useSubmissionDraft } from '@/app/home/submissions/use-submission-draft'
import type { Draft, DraftResponse } from '@/app/home/submissions/draft-schema'
import type { Opportunity } from '@/app/home/submissions/types'

const endpoint = '/api/procurement/credentials/drafts'
const opportunity = { site_id: 'buyer', publication_id: 'publication', version: 1, acting_as_self: true, supplier_id: null } as Opportunity
const response = (body: DraftResponse, status = 200) => ({ ok: status === 200, status, json: async () => body }) as Response
const empty = (): Draft => ({ reference: '', prices: {}, evidence: {}, key: 'receipt-key', attempted: false,
  registeredSupplier: null, proposalRevision: '', holderName: '' })
let account: string
let rows: Map<string, DraftResponse>
let storage: jest.SpyInstance[]

beforeEach(() => {
  jest.resetAllMocks()
  account = 'account'; rows = new Map()
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => 'receipt-key' })
  storage = ['getItem', 'setItem', 'removeItem', 'clear', 'key'].map(method => jest.spyOn(Storage.prototype, method as 'getItem'))
  jest.mocked(fetch).mockImplementation(async (input, options) => {
    const url = new URL(String(input), 'http://localhost')
    const body = options?.body ? JSON.parse(String(options.body)) : Object.fromEntries(url.searchParams)
    const key = `${account}:${body.publication_id}:${body.version}:${body.applicant_key}`
    const current = rows.get(key) ?? { draft: null, draft_revision: null }
    if (options?.method === 'PUT') {
      if (body.expected_revision !== current.draft_revision) return response(current, 409)
      const saved = { draft: body.draft, draft_revision: (current.draft_revision ?? 0) + 1 }
      rows.set(key, saved); return response(saved)
    }
    if (options?.method === 'DELETE') {
      expect(Number(body.expected_revision)).toBe(current.draft_revision)
      rows.delete(key); return response({ draft: null, draft_revision: null })
    }
    return response(current)
  })
})
afterEach(() => {
  storage.forEach(spy => { expect(spy).not.toHaveBeenCalled(); spy.mockRestore() })
})

test('loads no-store and explicitly saves incomplete fields to the endpoint for remount', async () => {
  const first = renderHook(() => useSubmissionDraft('account', opportunity))
  expect(first.result.current.ready).toBe(false)
  await waitFor(() => expect(first.result.current.ready).toBe(true))
  const [url, options] = jest.mocked(fetch).mock.calls[0]
  expect(Object.fromEntries(new URL(String(url), 'http://localhost').searchParams)).toEqual({ publication_id: 'publication', version: '1', applicant_key: 'personal' })
  expect(options).toMatchObject({ cache: 'no-store' })
  act(() => {
    first.result.current.setReference('Draft offer')
    first.result.current.setPrices({ line: '12' })
    first.result.current.setEvidence({ line: 'certificate' })
    first.result.current.setProposalRevision('proposal')
    first.result.current.setHolderName('Bidder')
  })
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => { await expect(first.result.current.save()).resolves.toBe(true) })
  expect(first.result.current.notice).toBe('procurement.portal.draft.saved')
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[1][1]?.body))).toMatchObject({
    publication_id: 'publication', version: 1, applicant_key: 'personal', expected_revision: null,
  })
  first.unmount()
  const restored = renderHook(() => useSubmissionDraft('account', opportunity))
  await waitFor(() => expect(restored.result.current.reference).toBe('Draft offer'))
  expect(restored.result.current).toMatchObject({ prices: { line: '12' }, evidence: { line: 'certificate' }, proposalRevision: 'proposal', holderName: 'Bidder' })
  expect(restored.result.current.notice).toBe('procurement.portal.draft.restored')
})

test('accounts, businesses, suppliers, publications and versions have separate endpoint selectors', async () => {
  const first = renderHook(() => useSubmissionDraft(account, opportunity))
  await waitFor(() => expect(first.result.current.ready).toBe(true))
  act(() => first.result.current.setReference('Private offer'))
  await act(async () => { await expect(first.result.current.save()).resolves.toBe(true) })
  first.unmount()
  for (const [user, row, applicant] of [
    ['other', opportunity, 'personal'],
    ['account', { ...opportunity, acting_site_id: 'business' }, 'business:business'],
    ['account', { ...opportunity, acting_as_self: false, supplier_id: 'supplier' }, 'supplier:supplier'],
    ['account', { ...opportunity, version: 2 }, 'personal'],
    ['account', { ...opportunity, publication_id: 'another' }, 'personal'],
  ] as const) {
    account = user
    const other = renderHook(() => useSubmissionDraft(user, row))
    await waitFor(() => expect(other.result.current.ready).toBe(true))
    expect(other.result.current.reference).toBe('')
    const calls = jest.mocked(fetch).mock.calls
    const params = new URL(String(calls[calls.length - 1][0]), 'http://localhost').searchParams
    expect(params.get('applicant_key')).toBe(applicant)
    expect(params.get('version')).toBe(String(row.version))
    other.unmount()
  }
})

test('canonical saved response and revision are used for the next write and delete', async () => {
  const hook = renderHook(() => useSubmissionDraft('account', opportunity))
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  jest.mocked(fetch).mockResolvedValueOnce(response({ draft: { ...empty(), reference: 'Canonical' }, draft_revision: 7 }))
  await act(async () => { await expect(hook.result.current.save()).resolves.toBe(true) })
  expect(hook.result.current.reference).toBe('Canonical')
  jest.mocked(fetch).mockResolvedValueOnce(response({ draft: { ...empty(), reference: 'Canonical' }, draft_revision: 8 }))
  await act(async () => { await expect(hook.result.current.save()).resolves.toBe(true) })
  expect(JSON.parse(String(jest.mocked(fetch).mock.calls[2][1]?.body)).expected_revision).toBe(7)
  jest.mocked(fetch).mockResolvedValueOnce(response({ draft: null, draft_revision: null }))
  await act(async () => { await hook.result.current.clear() })
  expect(fetch).toHaveBeenLastCalledWith(`${endpoint}?publication_id=publication&version=1&applicant_key=personal&expected_revision=8`, { method: 'DELETE', cache: 'no-store' })
})

test('attempt receipt survives remount, locks payload edits and deletes the saved revision', async () => {
  const first = renderHook(() => useSubmissionDraft('account', opportunity))
  await waitFor(() => expect(first.result.current.ready).toBe(true))
  act(() => { first.result.current.setReference('Immutable'); first.result.current.setPrices({ line: '100' }) })
  await act(async () => { await first.result.current.recordAttempt('registered') })
  first.unmount()
  const retry = renderHook(() => useSubmissionDraft('account', opportunity))
  await waitFor(() => expect(retry.result.current.attempted).toBe(true))
  act(() => { retry.result.current.setReference('Changed'); retry.result.current.setPrices({ line: '999' }) })
  expect(retry.result.current).toMatchObject({ key: 'receipt-key', reference: 'Immutable', prices: { line: '100' }, registeredSupplier: 'registered' })
  await act(async () => { await retry.result.current.clear() })
  expect(rows.size).toBe(0)
})

test.each(['network', 'http', 'malformed'])('failed %s load stays unready until explicit reload', async failure => {
  if (failure === 'network') jest.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
  else jest.mocked(fetch).mockResolvedValueOnce(response({ draft: failure === 'malformed' ? {} as Draft : null, draft_revision: null }, failure === 'http' ? 500 : 200))
  const hook = renderHook(() => useSubmissionDraft('account', opportunity))
  await waitFor(() => expect(hook.result.current.notice).toBe('procurement.portal.draft.loadFailed'))
  expect(hook.result.current.ready).toBe(false)
  act(() => hook.result.current.setReference('Unsafe'))
  expect(hook.result.current.reference).toBe('')
  act(() => hook.result.current.reload())
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
})

test('save failure reports failure; revision conflict blocks attempts until reload', async () => {
  const hook = renderHook(() => useSubmissionDraft('account', opportunity))
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  jest.mocked(fetch).mockRejectedValueOnce(new Error('Offline'))
  await act(async () => { await expect(hook.result.current.save()).resolves.toBe(false) })
  expect(hook.result.current.notice).toBe('procurement.portal.draft.saveFailed')
  expect(hook.result.current.ready).toBe(true)
  rows.set('account:publication:1:personal', { draft: { ...empty(), reference: 'Other tab' }, draft_revision: 2 })
  await act(async () => { await expect(hook.result.current.save()).resolves.toBe(false) })
  expect(hook.result.current.ready).toBe(false)
  await act(async () => { await expect(hook.result.current.recordAttempt('supplier')).rejects.toThrow() })
  expect(fetch).toHaveBeenCalledTimes(3)
  act(() => hook.result.current.reload())
  await waitFor(() => expect(hook.result.current.reference).toBe('Other tab'))
  expect(hook.result.current.ready).toBe(true)
})

test('late account load cannot overwrite the newly selected account', async () => {
  let resolveOld!: (value: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const hook = renderHook(({ user }) => useSubmissionDraft(user, opportunity), { initialProps: { user: 'account' } })
  act(() => hook.result.current.setReference('Not loaded'))
  expect(hook.result.current.reference).toBe('')
  hook.rerender({ user: 'other' })
  expect(hook.result.current.ready).toBe(false)
  await waitFor(() => expect(hook.result.current.ready).toBe(true))
  await act(async () => { resolveOld(response({ draft: { ...empty(), reference: 'Private old account' }, draft_revision: 1 })) })
  expect(hook.result.current.reference).toBe('')
  expect((jest.mocked(fetch).mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true)
})

test('no authenticated account makes no draft request and cannot edit', () => {
  const hook = renderHook(() => useSubmissionDraft(undefined, opportunity))
  expect(hook.result.current.ready).toBe(false)
  act(() => hook.result.current.setReference('Guest'))
  expect(hook.result.current.reference).toBe('')
  expect(fetch).not.toHaveBeenCalled()
})
